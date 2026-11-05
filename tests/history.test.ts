import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {
  createHashHistory,
  createMemoryHistory,
  createWebHistory,
  type RouterHistory,
} from "../src/history";

describe("createMemoryHistory", () => {
  it("starts at the initial location", () => {
    expect(createMemoryHistory().location).toBe("/");
    expect(createMemoryHistory("a?x=1").location).toBe("/a?x=1");
  });

  it("pushes, replaces and drops forward entries", () => {
    const h = createMemoryHistory();
    h.push("/a");
    h.push("/b");
    h.go(-1);
    h.push("/c");
    expect(h.location).toBe("/c");
    h.go(1);
    expect(h.location).toBe("/c");
    h.replace("/d");
    h.go(-1);
    expect(h.location).toBe("/a");
    h.go(1);
    expect(h.location).toBe("/d");
  });

  it("moves silently when triggerListeners is false", () => {
    const h = createMemoryHistory();
    const cb = vi.fn();
    h.listen(cb);
    h.push("/a");
    h.go(-1, false);
    expect(h.location).toBe("/");
    expect(cb).not.toHaveBeenCalled();
  });

  it("notifies listeners on go() only, and clamps", () => {
    const h = createMemoryHistory();
    const cb = vi.fn();
    const stop = h.listen(cb);
    h.push("/a");
    expect(cb).not.toHaveBeenCalled();
    h.go(-5);
    expect(cb).toHaveBeenCalledWith("/", "/a", {delta: -1});
    h.go(-1);
    expect(cb).toHaveBeenCalledTimes(1);
    stop();
    h.go(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("browser histories", () => {
  let h: RouterHistory | undefined;

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    h?.destroy();
    h = undefined;
  });

  const pop = (url: string): void => {
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  describe("createWebHistory", () => {
    it("reads and writes the URL under a base", () => {
      window.history.replaceState(null, "", "/app/users?x=1#top");
      h = createWebHistory("/app/");
      expect(h.location).toBe("/users?x=1#top");
      h.push("/about");
      expect(window.location.pathname).toBe("/app/about");
      expect(h.location).toBe("/about");
      h.replace("/");
      expect(window.location.pathname).toBe("/app/");
      expect(h.createHref("/x")).toBe("/app/x");
    });

    it("works without a base", () => {
      h = createWebHistory();
      h.push("/a?b=1");
      expect(window.location.pathname + window.location.search).toBe("/a?b=1");
      expect(h.location).toBe("/a?b=1");
    });

    it("notifies listeners on popstate and stops after destroy", () => {
      h = createWebHistory();
      const cb = vi.fn();
      h.listen(cb);
      h.push("/a");
      pop("/b");
      expect(cb).toHaveBeenCalledWith("/b", "/a", {delta: 0});
      expect(h.location).toBe("/b");
      h.destroy();
      pop("/c");
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe("positions", () => {
    const popTo = (url: string, position: number): void => {
      window.history.replaceState({upuautPosition: position}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    };

    it("stores a position in history.state and keeps user state", () => {
      h = createWebHistory();
      expect(window.history.state).toEqual({upuautPosition: 0});
      h.push("/a", {mine: 1});
      expect(window.history.state).toEqual({mine: 1, upuautPosition: 1});
      h.replace("/b");
      expect(window.history.state).toEqual({upuautPosition: 1});
    });

    it("reports the delta of back and forward moves", () => {
      h = createWebHistory();
      const cb = vi.fn();
      h.listen(cb);
      h.push("/a");
      h.push("/b");
      popTo("/", 0);
      expect(cb).toHaveBeenLastCalledWith("/", "/b", {delta: -2});
      popTo("/a", 1);
      expect(cb).toHaveBeenLastCalledWith("/a", "/", {delta: 1});
    });

    it("skips listeners for a silent go()", () => {
      h = createWebHistory();
      const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
      const cb = vi.fn();
      h.listen(cb);
      h.push("/a");
      h.go(-1, false);
      expect(go).toHaveBeenCalledWith(-1);
      popTo("/", 0);
      expect(cb).not.toHaveBeenCalled();
      expect(h.location).toBe("/");
      popTo("/a", 1);
      expect(cb).toHaveBeenCalledWith("/a", "/", {delta: 1});
      go.mockRestore();
    });

    it("treats a pop without state as a new entry", () => {
      h = createHashHistory();
      h.push("/a");
      pop("/#/manual");
      expect(window.history.state).toEqual({upuautPosition: 2});
    });
  });

  describe("createHashHistory", () => {
    it("stores the location in the hash", () => {
      h = createHashHistory();
      expect(h.location).toBe("/");
      h.push("/users/1?x=1");
      expect(window.location.hash).toBe("#/users/1?x=1");
      expect(h.location).toBe("/users/1?x=1");
      expect(h.createHref("/a")).toBe("/#/a");
    });

    it("notifies listeners when the hash changes", () => {
      h = createHashHistory();
      const cb = vi.fn();
      h.listen(cb);
      pop("/#/b");
      expect(cb).toHaveBeenCalledWith("/b", "/", {delta: 0});
    });
  });
});

describe("history edge cases", () => {
  let h: RouterHistory | undefined;
  beforeEach(() => window.history.replaceState(null, "", "/"));
  afterEach(() => {
    h?.destroy();
    h = undefined;
  });

  it("memory destroy keeps the location and drops listeners", () => {
    const m = createMemoryHistory();
    const cb = vi.fn();
    m.listen(cb);
    m.push("/a");
    m.push("/b");
    m.destroy();
    expect(m.location).toBe("/b");
    m.go(-1);
    expect(m.location).toBe("/b");
    expect(cb).not.toHaveBeenCalled();
  });

  it("accepts a base without slashes and maps the base itself to /", () => {
    window.history.replaceState(null, "", "/app");
    h = createWebHistory("app");
    expect(h.location).toBe("/");
    expect(h.createHref("/x")).toBe("/app/x");
  });

  it("keeps locations outside the base unchanged", () => {
    window.history.replaceState(null, "", "/other/page");
    h = createWebHistory("/app");
    expect(h.location).toBe("/other/page");
  });

  it("reuses an existing position after a reload", () => {
    window.history.replaceState({upuautPosition: 5}, "", "/");
    h = createWebHistory();
    h.push("/a");
    expect(window.history.state).toEqual({upuautPosition: 6});
  });

  it("ignores a second event for the same location and supports unlisten", () => {
    h = createWebHistory();
    const cb = vi.fn();
    const stop = h.listen(cb);
    window.history.replaceState({upuautPosition: 0}, "", "/b");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(cb).toHaveBeenCalledTimes(1);
    stop();
    window.history.replaceState({upuautPosition: 0}, "", "/c");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("a normal go() is not silent", () => {
    h = createWebHistory();
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const cb = vi.fn();
    h.listen(cb);
    h.push("/a");
    h.go(-1);
    window.history.replaceState({upuautPosition: 0}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(cb).toHaveBeenCalledWith("/", "/a", {delta: -1});
    go.mockRestore();
  });
});
