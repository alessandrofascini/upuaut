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

  it("notifies listeners on go() only, and clamps", () => {
    const h = createMemoryHistory();
    const cb = vi.fn();
    const stop = h.listen(cb);
    h.push("/a");
    expect(cb).not.toHaveBeenCalled();
    h.go(-5);
    expect(cb).toHaveBeenCalledWith("/", "/a");
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
      expect(cb).toHaveBeenCalledWith("/b", "/a");
      expect(h.location).toBe("/b");
      h.destroy();
      pop("/c");
      expect(cb).toHaveBeenCalledTimes(1);
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
      expect(cb).toHaveBeenCalledWith("/b", "/");
    });
  });
});
