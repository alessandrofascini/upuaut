/// <reference types="vite/client" />
import html from "../demo/index.html?raw";
import {beforeAll, describe, expect, it, vi} from "vitest";
import type {Router, UpuautRouter} from "upuaut";

let router: Router;
const main = () => document.querySelector("main") as HTMLElement;
const go = async (path: string, expected = path) => {
  await router.push(path);
  await vi.waitFor(() => expect(router.currentRoute.path).toBe(expected));
};

beforeAll(async () => {
  const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  await import("../demo/main");
  router = (document.querySelector("upuaut-router") as UpuautRouter).router!;
  await router.isReady();
});

describe("demo SPA", () => {
  it("renders home and nested users", async () => {
    expect(main().querySelector("demo-home")).not.toBeNull();
    await go("/users/2");
    expect(main().querySelector("demo-users demo-user")?.textContent).toBe("User #2");
  });

  it("lazy loads about", async () => {
    await go("/about");
    await vi.waitFor(() => expect(main().querySelector("demo-about")).not.toBeNull());
  });

  it("redirects /old-home and unknown paths go to 404", async () => {
    await go("/old-home", "/");
    await go("/nope");
    expect(main().querySelector("demo-not-found")).not.toBeNull();
  });

  it("guards /admin behind login", async () => {
    await go("/admin", "/login");
    expect(router.currentRoute.query).toEqual({redirect: "/admin"});
    (main().querySelector("demo-login button") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(router.currentRoute.path).toBe("/admin"));
    expect(main().querySelector("demo-admin")).not.toBeNull();
  });
});
