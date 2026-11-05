import {describe, expect, it, vi} from "vitest";
import {isNavigationFailure, UpuautError} from "../src/errors";
import {createMemoryHistory} from "../src/history";
import {createRouter, START_LOCATION} from "../src/router";
import type {RouteRecord} from "../src/types";

const routes = (): RouteRecord[] => [
  {path: "/", name: "home", component: "home-page"},
  {
    path: "/users",
    component: "users-page",
    meta: {section: "users"},
    children: [
      {path: "", name: "users", component: "users-index"},
      {path: "new", name: "user-new", component: "user-new"},
      {path: ":id", name: "user", component: "user-page", meta: {detail: true}},
    ],
  },
  {path: "/old", redirect: "/"},
  {path: "/files/:rest*", name: "files", component: "file-page"},
  {path: "*", name: "not-found", component: "not-found"},
];

const setup = async (initial = "/", records = routes()) => {
  const history = createMemoryHistory(initial);
  const router = createRouter({history, routes: records});
  await router.start();
  return {history, router};
};

describe("resolve", () => {
  it("matches nested routes with params, query, hash and merged meta", async () => {
    const {router} = await setup();
    const loc = router.resolve("/users/42?tab=info&x=1&x=2#top");
    expect(loc.name).toBe("user");
    expect(loc.params).toEqual({id: "42"});
    expect(loc.query).toEqual({tab: "info", x: ["1", "2"]});
    expect(loc.hash).toBe("#top");
    expect(loc.meta).toEqual({section: "users", detail: true});
    expect(loc.matched.map((r) => r.component)).toEqual(["users-page", "user-page"]);
    expect(loc.fullPath).toBe("/users/42?tab=info&x=1&x=2#top");
    expect(loc.href).toBe("/users/42?tab=info&x=1&x=2#top");
  });

  it("prefers static over dynamic and dynamic over catch-all", async () => {
    const {router} = await setup();
    expect(router.resolve("/users/new").name).toBe("user-new");
    expect(router.resolve("/users").name).toBe("users");
    expect(router.resolve("/nope/deep").name).toBe("not-found");
    expect(router.resolve("/files/a/b").params).toEqual({rest: "a/b"});
  });

  it("resolves named and path objects", async () => {
    const {router} = await setup();
    const loc = router.resolve({name: "user", params: {id: "7"}, query: {q: "x"}, hash: "h"});
    expect(loc.fullPath).toBe("/users/7?q=x#h");
    expect(router.resolve({path: "/users?a=1", query: {b: "2"}}).fullPath).toBe("/users?a=1&b=2");
  });

  it("returns an empty match when nothing matches", () => {
    const router = createRouter({history: createMemoryHistory(), routes: [{path: "/a"}]});
    expect(router.resolve("/b").matched).toEqual([]);
  });

  it("throws on unknown names and duplicate names", () => {
    const router = createRouter({history: createMemoryHistory(), routes: routes()});
    expect(() => router.resolve({name: "nope"})).toThrow(UpuautError);
    expect(() =>
      createRouter({
        history: createMemoryHistory(),
        routes: [
          {path: "/a", name: "x"},
          {path: "/b", name: "x"},
        ],
      }),
    ).toThrow(UpuautError);
  });
});

describe("start", () => {
  it("navigates to the history location and resolves isReady", async () => {
    const history = createMemoryHistory("/users/3");
    const router = createRouter({history, routes: routes()});
    expect(router.currentRoute).toBe(START_LOCATION);
    await router.start();
    await router.isReady();
    expect(router.currentRoute.params).toEqual({id: "3"});
  });

  it("applies redirects on the initial location", async () => {
    const {router, history} = await setup("/old");
    expect(router.currentRoute.path).toBe("/");
    expect(history.location).toBe("/");
  });
});

describe("push / replace / pop", () => {
  it("pushes history entries and notifies subscribers and afterEach", async () => {
    const {router, history} = await setup();
    const sub = vi.fn();
    const after = vi.fn();
    router.subscribe(sub);
    router.afterEach(after);
    await router.push("/users/1");
    expect(history.location).toBe("/users/1");
    expect(sub).toHaveBeenCalledWith(router.currentRoute, expect.objectContaining({path: "/"}));
    expect(after).toHaveBeenCalledTimes(1);
    await router.replace("/users/2");
    router.back();
    await vi.waitFor(() => expect(router.currentRoute.path).toBe("/"));
  });

  it("returns a duplicated failure for the current location", async () => {
    const {router} = await setup();
    const after = vi.fn();
    router.afterEach(after);
    const result = await router.push("/");
    expect(isNavigationFailure(result, "duplicated")).toBe(true);
    expect(after).toHaveBeenCalledWith(expect.anything(), expect.anything(), result);
  });

  it("follows record redirects, including functions", async () => {
    const {router} = await setup("/", [
      {path: "/", component: "x"},
      {path: "/a", redirect: (to) => ({path: "/b", query: to.query})},
      {path: "/b", component: "b"},
    ]);
    await router.push("/a?k=v");
    expect(router.currentRoute.fullPath).toBe("/b?k=v");
  });

  it("throws after too many redirects", async () => {
    const history = createMemoryHistory("/");
    const router = createRouter({
      history,
      routes: [
        {path: "/", component: "x"},
        {path: "/a", redirect: "/b"},
        {path: "/b", redirect: "/a"},
      ],
    });
    await router.start();
    await expect(router.push("/a")).rejects.toThrow(UpuautError);
  });
});

describe("guards", () => {
  it("runs beforeEach then beforeEnter of entered records only", async () => {
    const calls: string[] = [];
    const {router} = await setup("/", [
      {path: "/", component: "x"},
      {
        path: "/p",
        component: "p",
        beforeEnter: () => void calls.push("parent"),
        children: [
          {path: "a", component: "a", beforeEnter: [() => void calls.push("a")]},
          {path: "b", component: "b"},
        ],
      },
    ]);
    router.beforeEach(() => void calls.push("global"));
    await router.push("/p/a");
    await router.push("/p/b");
    expect(calls).toEqual(["global", "parent", "a", "global"]);
  });

  it("aborts on false", async () => {
    const {router, history} = await setup();
    router.beforeEach((to) => to.path !== "/users/1");
    const result = await router.push("/users/1");
    expect(isNavigationFailure(result, "aborted")).toBe(true);
    expect(router.currentRoute.path).toBe("/");
    expect(history.location).toBe("/");
  });

  it("redirects on a returned location and replaces the entry", async () => {
    const {router, history} = await setup();
    const stop = router.beforeEach((to) => (to.path === "/users/1" ? {name: "home"} : undefined));
    await router.push("/users/2");
    await router.push("/users/1");
    expect(router.currentRoute.path).toBe("/");
    history.go(-1);
    await vi.waitFor(() => expect(router.currentRoute.path).toBe("/"));
    stop();
    await router.push("/users/1");
    expect(router.currentRoute.path).toBe("/users/1");
  });

  it("propagates guard errors", async () => {
    const {router} = await setup();
    router.beforeEach(() => {
      throw new Error("boom");
    });
    await expect(router.push("/users")).rejects.toThrow("boom");
  });

  it("cancels a pending navigation when a newer one starts", async () => {
    const {router} = await setup();
    let release!: () => void;
    router.beforeEach((to) =>
      to.path === "/users/slow" ? new Promise<void>((r) => (release = r)) : undefined,
    );
    const slow = router.push("/users/slow");
    await router.push("/users/fast");
    release();
    expect(isNavigationFailure(await slow, "cancelled")).toBe(true);
    expect(router.currentRoute.path).toBe("/users/fast");
  });

  it("restores the URL when a pop navigation is aborted", async () => {
    const {router, history} = await setup();
    await router.push("/users/1");
    const stop = router.beforeEach(() => false);
    history.go(-1);
    await vi.waitFor(() => expect(history.location).toBe("/users/1"));
    expect(router.currentRoute.path).toBe("/users/1");
    stop();
    history.go(-1);
    await vi.waitFor(() => expect(router.currentRoute.path).toBe("/"));
  });
});

describe("lazy components", () => {
  it("loads once before committing and caches the result", async () => {
    const loader = vi.fn(async () => ({default: "lazy-page"}));
    const record: RouteRecord = {path: "/lazy", component: loader};
    const {router} = await setup("/", [{path: "/", component: "x"}, record]);
    await router.push("/lazy");
    expect(record.component).toBe("lazy-page");
    await router.push("/");
    await router.push("/lazy");
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe("plain custom element classes", () => {
  it("are not treated as lazy loaders", async () => {
    class Plain extends HTMLElement {}
    const record: RouteRecord = {path: "/plain", component: Plain};
    const {router} = await setup("/", [{path: "/", component: "x"}, record]);
    await router.push("/plain");
    expect(record.component).toBe(Plain);
    expect(router.currentRoute.path).toBe("/plain");
  });
});

describe("stop", () => {
  it("stops reacting to history pops", async () => {
    const {router, history} = await setup();
    await router.push("/users");
    router.stop();
    history.go(-1);
    await Promise.resolve();
    expect(router.currentRoute.path).toBe("/users");
  });
});

describe("router edge cases", () => {
  it("accepts paths without a leading slash and a bare #", async () => {
    const {router} = await setup();
    await router.push("users/4#");
    expect(router.currentRoute.fullPath).toBe("/users/4");
    expect(router.currentRoute.hash).toBe("");
  });

  it("accepts a lazy loader that returns the component directly", async () => {
    const record: RouteRecord = {path: "/lazy", component: async () => "direct-page"};
    const {router} = await setup("/", [{path: "/", component: "x"}, record]);
    await router.push("/lazy");
    expect(record.component).toBe("direct-page");
  });

  it("cancels a navigation that is still loading a lazy component", async () => {
    let release!: () => void;
    const slow = new Promise<string>((r) => (release = () => r("slow-page")));
    const {router} = await setup("/", [
      {path: "/", component: "x"},
      {path: "/slow", component: () => slow},
      {path: "/fast", component: "fast"},
    ]);
    const pending = router.push("/slow");
    await router.push("/fast");
    release();
    expect(isNavigationFailure(await pending, "cancelled")).toBe(true);
    expect(router.currentRoute.path).toBe("/fast");
  });

  it("forward() and go() move through the history", async () => {
    const {router} = await setup();
    await router.push("/users/1");
    await router.push("/users/2");
    router.go(-2);
    await vi.waitFor(() => expect(router.currentRoute.path).toBe("/"));
    router.forward();
    await vi.waitFor(() => expect(router.currentRoute.path).toBe("/users/1"));
  });

  it("start() returns the same promise until stop()", async () => {
    const history = createMemoryHistory();
    const router = createRouter({history, routes: routes()});
    const first = router.start();
    expect(router.start()).toBe(first);
    await first;
    router.stop();
    expect(router.start()).not.toBe(first);
  });

  it("rewrites the URL when an aborted pop has an unknown delta", async () => {
    const memory = createMemoryHistory();
    const history = {
      ...memory,
      get location() {
        return memory.location;
      },
      listen: (cb: Parameters<typeof memory.listen>[0]) =>
        memory.listen((to, from) => cb(to, from, {delta: 0})),
    };
    const replace = vi.spyOn(history, "replace");
    const router = createRouter({history, routes: routes()});
    await router.start();
    await router.push("/users/1");
    router.beforeEach(() => false);
    memory.go(-1);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/users/1"));
  });

  it("reports errors thrown during pop navigations to the console", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const {router, history} = await setup();
    await router.push("/users/1");
    router.beforeEach(() => {
      throw new Error("pop boom");
    });
    history.go(-1);
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith(new Error("pop boom")));
    error.mockRestore();
  });

  it("rejects start() and isReady() when the initial navigation throws", async () => {
    const router = createRouter({history: createMemoryHistory(), routes: routes()});
    router.beforeEach(() => {
      throw new Error("init boom");
    });
    await expect(router.start()).rejects.toThrow("init boom");
    await expect(router.isReady()).rejects.toThrow("init boom");
  });
});
