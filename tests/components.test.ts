import {Shape, type Vessel} from "khnum";
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {UpuautRouter} from "../src/components/router-element";
import {UpuautView} from "../src/components/view";
import {UpuautLink} from "../src/components/link";
import {createMemoryHistory} from "../src/history";
import {createRouter, type Router} from "../src/router";
import type {RouteLocation, RouteRecord} from "../src/types";

let renders = 0;

class UserPage extends Shape("test-user-page") {
  route: RouteLocation | undefined;
  override render(): void {
    renders++;
  }
}

class UsersLayout extends Shape("test-users-layout") {
  override render(): void {
    this.replaceChildren(document.createElement("upuaut-view"));
  }
}

const routes = (): RouteRecord[] => [
  {path: "/", component: "test-home"},
  {
    path: "/users",
    component: UsersLayout as unknown as Vessel,
    children: [{path: ":id", component: UserPage as unknown as Vessel}],
  },
];

const mount = async (initial = "/", html = "<upuaut-view></upuaut-view>") => {
  const router = createRouter({history: createMemoryHistory(initial), routes: routes()});
  const host = document.createElement("upuaut-router") as UpuautRouter;
  host.innerHTML = html;
  document.body.append(host);
  host.router = router;
  await router.isReady();
  return {router, host};
};

const settle = (router: Router, path: string) =>
  vi.waitFor(() => expect(router.currentRoute.path).toBe(path));

beforeAll(() => {
  UpuautRouter.fire();
});

afterEach(() => {
  document.body.replaceChildren();
  renders = 0;
});

describe("<upuaut-router>", () => {
  it("fires its view and link dependencies", () => {
    expect(customElements.get("upuaut-router")).toBe(UpuautRouter);
    expect(customElements.get("upuaut-view")).toBe(UpuautView);
    expect(customElements.get("upuaut-link")).toBe(UpuautLink);
  });

  it("dispatches upuaut-navigated with the new and old location", async () => {
    const {router, host} = await mount();
    const seen: string[] = [];
    document.body.addEventListener("upuaut-navigated", (e) => {
      const ev = e as Event & {newVal: RouteLocation; oldVal: RouteLocation};
      seen.push(`${ev.oldVal.path}->${ev.newVal.path}`);
    });
    await router.push("/users/1");
    expect(seen).toEqual(["/->/users/1"]);
    host.remove();
    await router.push("/");
    expect(seen).toHaveLength(1);
  });

  it("adopts a router set before the element was upgraded", async () => {
    const router = createRouter({history: createMemoryHistory("/"), routes: routes()});
    const host = new UpuautRouter();
    Object.defineProperty(host, "router", {value: router, configurable: true, writable: true});
    host.innerHTML = "<upuaut-view></upuaut-view>";
    document.body.append(host);
    await router.isReady();
    expect(host.router).toBe(router);
    expect(host.querySelector("test-home")).not.toBeNull();
  });
});

describe("<upuaut-view>", () => {
  it("throws outside <upuaut-router>", () => {
    const view = new UpuautView();
    expect(() => view.render()).toThrow(/upuaut-router/);
  });

  it("renders the matched component by depth and passes the route", async () => {
    const {router, host} = await mount("/users/7");
    const layout = host.querySelector("test-users-layout");
    const page = host.querySelector("test-user-page") as UserPage | null;
    expect(layout).not.toBeNull();
    expect(page?.route?.params).toEqual({id: "7"});
    expect((host.querySelectorAll("upuaut-view")[1] as UpuautView).depth).toBe(1);

    await router.push("/");
    expect(host.querySelector("test-users-layout")).toBeNull();
    expect(host.querySelector("test-home")).not.toBeNull();
  });

  it("keeps the same element when only params change", async () => {
    const {router, host} = await mount("/users/1");
    const first = host.querySelector("test-user-page") as UserPage;
    await router.push("/users/2");
    const second = host.querySelector("test-user-page") as UserPage;
    expect(second).toBe(first);
    expect(second.route?.params).toEqual({id: "2"});
    expect(renders).toBe(1);
  });

  it("renders a registered plain custom element class", async () => {
    class PlainPage extends HTMLElement {}
    customElements.define("test-plain-page", PlainPage);
    const {router, host} = await mount("/users/1");
    router.resolve("/").matched[0].component = PlainPage;
    const view = host.querySelector("upuaut-view") as UpuautView;
    await router.push("/");
    expect(view.firstElementChild).toBeInstanceOf(PlainPage);
  });

  it("throws for an unregistered plain class", async () => {
    class Unregistered extends HTMLElement {}
    const {router} = await mount("/users/1");
    router.resolve("/").matched[0].component = Unregistered;
    await expect(router.push("/")).rejects.toThrow(/not registered/);
  });

  it("renders nothing when no record matches its depth", async () => {
    const {router, host} = await mount("/");
    await router.push("/missing");
    expect(host.querySelector("upuaut-view")?.childElementCount).toBe(0);
  });
});

describe("<upuaut-link>", () => {
  const linkHtml = `
    <upuaut-link to="/users/1" id="a"><span>User</span></upuaut-link>
    <upuaut-link to="/users" id="b" active-class="on" exact-active-class="here">Users</upuaut-link>
    <upuaut-link to="/" id="c" replace>Home</upuaut-link>
    <upuaut-link to="/users/1" id="d" target="_blank">New tab</upuaut-link>`;
  const anchor = (id: string) => document.querySelector(`#${id} > a`) as HTMLAnchorElement;
  const click = (id: string, init: MouseEventInit = {}) => {
    const ev = new MouseEvent("click", {bubbles: true, cancelable: true, button: 0, ...init});
    let preventedByLink = false;
    // Record the link's decision, then stop happy-dom from following the href.
    const record = (e: Event): void => {
      preventedByLink = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener("click", record, {once: true});
    anchor(id).dispatchEvent(ev);
    return {defaultPrevented: preventedByLink};
  };

  it("wraps its children in an anchor with a resolved href", async () => {
    await mount("/", linkHtml);
    expect(anchor("a").getAttribute("href")).toBe("/users/1");
    expect(anchor("a").querySelector("span")?.textContent).toBe("User");
    expect(anchor("d").target).toBe("_blank");
  });

  it("navigates on plain left click and prevents the default", async () => {
    const {router} = await mount("/", linkHtml);
    const ev = click("a");
    expect(ev.defaultPrevented).toBe(true);
    await settle(router, "/users/1");
  });

  it("uses replace when the replace attribute is set", async () => {
    const {router} = await mount("/users/1", linkHtml);
    const replace = vi.spyOn(router, "replace");
    const push = vi.spyOn(router, "push");
    click("c");
    expect(replace).toHaveBeenCalledWith("/");
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores modified clicks, other buttons and target=_blank", async () => {
    const {router} = await mount("/", linkHtml);
    const push = vi.spyOn(router, "push");
    expect(click("a", {ctrlKey: true}).defaultPrevented).toBe(false);
    expect(click("a", {metaKey: true}).defaultPrevented).toBe(false);
    expect(click("a", {button: 1}).defaultPrevented).toBe(false);
    expect(click("d").defaultPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("sets active classes and aria-current", async () => {
    const {router} = await mount("/users/1", linkHtml);
    expect(anchor("a").className).toBe("upuaut-link-active upuaut-link-exact-active");
    expect(anchor("a").getAttribute("aria-current")).toBe("page");
    expect(anchor("b").className).toBe("on");
    expect(anchor("b").hasAttribute("aria-current")).toBe(false);
    expect(anchor("c").className).toBe("");

    await router.push("/users");
    expect(anchor("a").className).toBe("");
    expect(anchor("b").className).toBe("on here");
  });

  it("updates href when the to attribute changes", async () => {
    await mount("/", linkHtml);
    document.querySelector("#a")?.setAttribute("to", "/users/9");
    expect(anchor("a").getAttribute("href")).toBe("/users/9");
  });
});

describe("component edge cases", () => {
  it("link: exposes its anchor and keeps it across reconnects", async () => {
    await mount("/", `<upuaut-link to="/users" id="x">Users</upuaut-link>`);
    const link = document.querySelector("#x") as UpuautLink;
    const anchor = link.anchor;
    expect(anchor?.textContent).toBe("Users");
    const parent = link.parentElement!;
    link.remove();
    parent.append(link);
    expect(link.anchor).toBe(anchor);
    expect(link.querySelectorAll("a")).toHaveLength(1);
  });

  it("link: reacts to target, active-class and exact-active-class changes", async () => {
    await mount("/users", `<upuaut-link to="/users/" id="x">Users</upuaut-link>`);
    const link = document.querySelector("#x") as UpuautLink;
    expect(link.anchor?.className).toBe("upuaut-link-active upuaut-link-exact-active");
    link.setAttribute("target", "_blank");
    expect(link.anchor?.target).toBe("_blank");
    link.removeAttribute("target");
    expect(link.anchor?.hasAttribute("target")).toBe(false);
    link.setAttribute("active-class", "on");
    link.setAttribute("exact-active-class", "here");
    expect(link.anchor?.className).toBe("on here");
  });

  it("link: leaves clicks alone without a router or with download", async () => {
    const host = document.createElement("upuaut-router") as UpuautRouter;
    host.innerHTML = `<upuaut-link to="/a" id="x">A</upuaut-link><upuaut-link to="/a" id="y" download>B</upuaut-link>`;
    document.body.append(host);
    const prevented = (id: string): boolean => {
      const ev = new MouseEvent("click", {bubbles: true, cancelable: true, button: 0});
      let result = true;
      document.addEventListener(
        "click",
        (e) => {
          result = e.defaultPrevented;
          e.preventDefault();
        },
        {once: true},
      );
      (document.querySelector(`#${id} a`) as HTMLAnchorElement).dispatchEvent(ev);
      return result;
    };
    expect(prevented("x")).toBe(false);
    host.router = createRouter({history: createMemoryHistory("/"), routes: routes()});
    await host.router.isReady();
    expect(prevented("y")).toBe(false);
  });

  it("link: logs a rejected navigation", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const {router} = await mount("/", `<upuaut-link to="/users/1" id="x">A</upuaut-link>`);
    router.beforeEach(() => {
      throw new Error("link boom");
    });
    const ev = new MouseEvent("click", {bubbles: true, cancelable: true, button: 0});
    (document.querySelector("#x a") as HTMLAnchorElement).dispatchEvent(ev);
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith(new Error("link boom")));
    error.mockRestore();
  });

  it("router element: ignores the same router, clears on undefined, listens after connect", async () => {
    const router = createRouter({history: createMemoryHistory("/"), routes: routes()});
    const host = document.createElement("upuaut-router") as UpuautRouter;
    host.router = router;
    host.router = router;
    const seen: string[] = [];
    host.addEventListener("upuaut-navigated", () => seen.push(router.currentRoute.path));
    document.body.append(host);
    await router.isReady();
    await router.push("/users/1");
    expect(seen).toContain("/users/1");
    host.router = undefined;
    expect(host.router).toBeUndefined();
    const before = seen.length;
    await router.push("/");
    expect(seen).toHaveLength(before);
  });

  it("router element: logs a failing start", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = createRouter({history: createMemoryHistory("/"), routes: routes()});
    router.beforeEach(() => {
      throw new Error("start boom");
    });
    const host = document.createElement("upuaut-router") as UpuautRouter;
    host.router = router;
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith(new Error("start boom")));
    error.mockRestore();
  });

  it("view: names an anonymous unregistered class in the error", async () => {
    const Anonymous = (() => class extends HTMLElement {})();
    const {router} = await mount("/users/1");
    router.resolve("/").matched[0].component = Anonymous;
    await expect(router.push("/")).rejects.toThrow("component is not registered");
  });
});

describe("link: object to and exact", () => {
  it("accepts a named location through the to property", async () => {
    const {router} = await mount("/", `<upuaut-link id="x">User</upuaut-link>`);
    const link = document.querySelector("#x") as UpuautLink;
    expect(link.anchor?.hasAttribute("href")).toBe(false);
    link.to = {path: "/users/5", query: {tab: "info"}};
    expect(link.anchor?.getAttribute("href")).toBe("/users/5?tab=info");
    link.anchor?.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(router.currentRoute.fullPath).toBe("/users/5?tab=info"));
    expect(link.anchor?.getAttribute("aria-current")).toBe("page");
  });

  it("keeps the to attribute working and lets it override the property", async () => {
    await mount("/", `<upuaut-link id="x" to="/users">Users</upuaut-link>`);
    const link = document.querySelector("#x") as UpuautLink;
    expect(link.to).toBe("/users");
    link.to = {path: "/users/2"};
    expect(link.anchor?.getAttribute("href")).toBe("/users/2");
    link.setAttribute("to", "/");
    expect(link.anchor?.getAttribute("href")).toBe("/");
  });

  it("adopts a to property set before the element was upgraded", async () => {
    const {router, host} = await mount("/");
    const link = new UpuautLink();
    Object.defineProperty(link, "to", {value: "/users/3", configurable: true, writable: true});
    host.append(link);
    expect(link.to).toBe("/users/3");
    expect(link.anchor?.getAttribute("href")).toBe(router.resolve("/users/3").href);
    // The accessor must be back in charge: a later assignment updates the href.
    link.to = "/users/4";
    expect(link.anchor?.getAttribute("href")).toBe("/users/4");
  });

  it("renders a dead link for an unknown route name", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await mount("/", `<upuaut-link id="x">Nope</upuaut-link>`);
    const link = document.querySelector("#x") as UpuautLink;
    link.to = {name: "nope"};
    expect(link.anchor?.hasAttribute("href")).toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("exact limits the active class to an exact match", async () => {
    const {router} = await mount(
      "/users/1",
      `<upuaut-link id="x" to="/users" exact>Users</upuaut-link>`,
    );
    const link = document.querySelector("#x") as UpuautLink;
    expect(link.anchor?.className).toBe("");
    await router.push("/users");
    expect(link.anchor?.className).toBe("upuaut-link-active upuaut-link-exact-active");
    link.removeAttribute("exact");
    await router.push("/users/2");
    expect(link.anchor?.className).toBe("upuaut-link-active");
  });
});
