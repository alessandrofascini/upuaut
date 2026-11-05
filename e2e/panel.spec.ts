import {expect, test, type Page} from "@playwright/test";

const panel = (page: Page) => page.locator("demo-panel");
const card = (page: Page, title: string) =>
  panel(page).locator("section.card", {has: page.locator("h3", {hasText: title})});
const log = (page: Page) => card(page, "Navigation log").locator("ol.log li");
const nav = (page: Page, name: string) =>
  page.locator("nav.app-nav").getByRole("link", {name, exact: true});
const heading = (page: Page) => page.locator("main h1").first();

test.beforeEach(async ({page}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("inspector shows the current route", async ({page}) => {
  await nav(page, "Search").click();
  const inspector = card(page, "Current route").locator("pre");
  await expect(inspector).toContainText('"name": "search"');
  await expect(inspector).toContainText('"matched"');
});

test("switches history mode live", async ({page}) => {
  await nav(page, "Users").click();
  await card(page, "History").getByRole("button", {name: "hash"}).click();
  await expect(page).toHaveURL("/#/users");
  await nav(page, "Posts").click();
  await expect(page).toHaveURL("/#/posts");
  await card(page, "History").getByRole("button", {name: "memory"}).click();
  await nav(page, "Docs").click();
  await expect(heading(page)).toHaveText("Docs");
  await expect(page).toHaveURL("/#/posts");
  await card(page, "History").getByRole("button", {name: "web"}).click();
  await expect(page).toHaveURL("/docs");
});

test("block toggle aborts navigation and logs it", async ({page}) => {
  await card(page, "Guards").getByLabel("Block every navigation").check();
  await nav(page, "Users").click();
  await expect(heading(page)).toHaveText("Home");
  await expect(log(page).first()).toContainText("aborted: / → /users");
});

test("slow guard: a second click cancels the first navigation", async ({page}) => {
  await card(page, "Guards").locator('input[type="range"]').first().fill("1000");
  await nav(page, "Users").click();
  await nav(page, "Posts").click();
  await expect(heading(page)).toHaveText("Posts", {timeout: 5000});
  await expect(log(page).filter({hasText: "cancelled: / → /users"})).toHaveCount(1);
});

test("named navigation and errors from the panel", async ({page}) => {
  const navigate = card(page, "Navigate");
  await navigate.getByRole("button", {name: "push by name"}).click();
  await expect(page).toHaveURL("/users/2");
  await navigate.locator("select").selectOption("nope");
  await navigate.getByRole("button", {name: "push by name"}).click();
  await expect(log(page).first()).toContainText('unknown route name "nope"');
});

test("path navigation with query and hash, then back", async ({page}) => {
  const navigate = card(page, "Navigate");
  await expect(navigate.locator("p.mono")).toContainText("href /search?q=ro#results");
  await navigate.getByRole("button", {name: "push", exact: true}).click();
  await expect(page).toHaveURL("/search?q=ro#results");
  await expect(page.locator("demo-search li")).toHaveText(["router"]);
  await navigate.getByRole("button", {name: "← back"}).click();
  await expect(page).toHaveURL("/");
});

test("query, optional param, splat and function redirect pages", async ({page}) => {
  await nav(page, "Search").click();
  await page.locator("demo-search input").fill("ec");
  await page.locator("demo-search button").click();
  await expect(page).toHaveURL("/search?q=ec");
  await expect(page.locator("demo-search li")).toHaveText(["redirect"]);

  await nav(page, "Posts").click();
  await page.getByRole("link", {name: "Routing 101"}).click();
  await expect(page).toHaveURL("/posts/routing-101");
  await expect(heading(page)).toHaveText("Routing 101");

  await page.goto("/files/src/components");
  await expect(page.locator("demo-files code")).toHaveText('"src/components"');

  await nav(page, "Old user").click();
  await expect(page).toHaveURL("/users/3");
});
