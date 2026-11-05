import {expect, test, type Page} from "@playwright/test";

const nav = (page: Page, name: string) =>
  page.locator("nav").getByRole("link", {name, exact: true});
const heading = (page: Page) => page.locator("main h1");

test.beforeEach(async ({page}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("renders home and marks the exact-active link", async ({page}) => {
  await expect(heading(page)).toHaveText("Home");
  await expect(nav(page, "Home")).toHaveAttribute("aria-current", "page");
  await expect(nav(page, "Users")).not.toHaveAttribute("aria-current");
});

test("navigates without reloading the document", async ({page}) => {
  await page.evaluate(() => ((window as unknown as {marker: number}).marker = 1));
  await nav(page, "Users").click();
  await expect(page).toHaveURL("/users");
  await expect(heading(page).first()).toHaveText("Users");
  expect(await page.evaluate(() => (window as unknown as {marker?: number}).marker)).toBe(1);
});

test("nested routes reuse the page element when only params change", async ({page}) => {
  await nav(page, "Users").click();
  await page.locator("demo-users upuaut-link a", {hasText: "Ada"}).click();
  await expect(page).toHaveURL("/users/1");
  await expect(page.locator("demo-user h1")).toHaveText("User #1");
  await page.evaluate(
    () => ((document.querySelector("demo-user") as HTMLElement).dataset.tag = "x"),
  );

  await page.locator("demo-users upuaut-link a", {hasText: "Grace"}).click();
  await expect(page.locator("demo-user h1")).toHaveText("User #2");
  await expect(page.locator("demo-user")).toHaveAttribute("data-tag", "x");
  await expect(nav(page, "Users")).toHaveClass(/upuaut-link-active/);
  await expect(nav(page, "Users")).not.toHaveAttribute("aria-current");
});

test("back and forward buttons", async ({page}) => {
  await nav(page, "Users").click();
  await page.locator("demo-users upuaut-link a", {hasText: "Ada"}).click();
  await expect(page.locator("demo-user h1")).toHaveText("User #1");
  await page.goBack();
  await expect(page).toHaveURL("/users");
  await expect(page.locator("demo-user")).toHaveCount(0);
  await page.goBack();
  await expect(heading(page)).toHaveText("Home");
  await page.goForward();
  await expect(page).toHaveURL("/users");
});

test("deep links load through the server fallback", async ({page}) => {
  await page.goto("/users/3");
  await expect(page.locator("demo-user h1")).toHaveText("User #3");
});

test("lazy route loads its own chunk", async ({page}) => {
  const chunk = page.waitForRequest((req) => /about-.*\.js$/.test(req.url()));
  await nav(page, "About").click();
  await chunk;
  await expect(heading(page)).toHaveText("About (lazy loaded)");
});

test("record redirect and catch-all", async ({page}) => {
  await nav(page, "Missing").click();
  await expect(page).toHaveURL("/does-not-exist");
  await expect(heading(page)).toHaveText("404");
  await nav(page, "Old home").click();
  await expect(page).toHaveURL("/");
  await expect(heading(page)).toHaveText("Home");
});

test("auth guard redirects to login and back", async ({page}) => {
  await nav(page, "Admin").click();
  await expect(page).toHaveURL("/login?redirect=%2Fadmin");
  await page.getByRole("button", {name: "Log in"}).click();
  await expect(page).toHaveURL("/admin");
  await expect(heading(page)).toHaveText("Admin");

  await page.getByRole("button", {name: "Log out"}).click();
  await expect(page).toHaveURL("/");
  await page.goBack();
  await expect(page).toHaveURL("/login?redirect=%2Fadmin");
});

test("ctrl-click opens a new tab instead of navigating in place", async ({page, context}) => {
  const popup = context.waitForEvent("page");
  await nav(page, "Users").click({modifiers: ["ControlOrMeta"]});
  const opened = await popup;
  await opened.waitForLoadState();
  await expect(opened.locator("main h1").first()).toHaveText("Users");
  await expect(page).toHaveURL("/");
});
