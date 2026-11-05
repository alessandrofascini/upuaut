---
title: Guide
---

# Guide

Task-oriented recipes. The full contract is in the [specification](router.md); planned features are in the [roadmap](roadmap.md).

## Set up

```ts
import {createRouter, createWebHistory, UpuautRouter} from "upuaut";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {path: "/", component: HomePage},
    {path: "*", component: NotFoundPage},
  ],
});

UpuautRouter.fire(); // defines <upuaut-router>, <upuaut-view>, <upuaut-link>
document.querySelector("upuaut-router")!.router = router;
```

```html
<upuaut-router>
  <upuaut-link to="/">Home</upuaut-link>
  <upuaut-view></upuaut-view>
</upuaut-router>
```

The HTML may be in the page before `fire()` runs; views and links wait for the router element.

## Write a page

A route component is a khnum `Shape`, a registered custom element class, or a tag name. `<upuaut-view>` sets a `route` property on it. When only the params, query or hash change, the **same element** gets the new `route`, so make `route` an accessor if the page must react:

```ts
import {mold, Shape} from "khnum";
import type {RouteLocation} from "upuaut";

class UserPage extends Shape("user-page") {
  #route?: RouteLocation;
  get route() {
    return this.#route;
  }
  set route(route) {
    this.#route = route;
    if (this.isConnected) this.render();
  }
  render() {
    this.replaceChildren(mold("h1", `User ${this.#route?.params.id}`));
  }
}
```

## Nest routes

Put an `<upuaut-view>` inside the parent page. Each view renders the record at its depth.

```ts
{
  path: "/users",
  component: UsersLayout, // renders a list and an <upuaut-view>
  children: [
    {path: "", component: UsersIndex}, // /users
    {path: ":id", name: "user", component: UserPage}, // /users/42
  ],
}
```

## Match paths

| Pattern         | Matches                  | Params                    |
| --------------- | ------------------------ | ------------------------- |
| `/users/:id`    | `/users/42`              | `{id: "42"}`              |
| `/posts/:slug?` | `/posts`, `/posts/hello` | `{}` or `{slug: "hello"}` |
| `/files/:rest*` | `/files/a/b`             | `{rest: "a/b"}`           |
| `*`             | anything                 | `{"*": "..."}`            |

The most specific pattern wins regardless of declaration order: `/users/new` beats `/users/:id`.

## Navigate from code

```ts
await router.push("/users/42?tab=info#top");
await router.push({name: "user", params: {id: "42"}, query: {tab: "info"}});
await router.replace("/login"); // no new history entry
router.back();

const {href} = router.resolve({name: "user", params: {id: "42"}}); // build a URL only
```

`push` and `replace` resolve with `undefined` on success or with a `NavigationFailure`:

```ts
import {isNavigationFailure} from "upuaut";

const failure = await router.push("/admin");
if (isNavigationFailure(failure, "aborted")) showToast("Not allowed");
```

They reject only for programming errors (`UpuautError`: unknown name, missing param, redirect loop) or errors thrown by your guards.

## Protect routes with guards

```ts
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isLoggedIn()) {
    return {path: "/login", query: {redirect: to.fullPath}}; // redirect
  }
  // undefined or true: continue; false: abort
});

{path: "/admin", component: AdminPage, meta: {requiresAuth: true}}
```

Per-route guards go in `beforeEnter`; they run only when the route is entered, not when its params change. `afterEach` sees every outcome, including failures — use it for analytics or a progress bar.

Guards may be async. If the user starts another navigation while a guard is waiting, the older navigation ends with a `cancelled` failure.

## Handle errors

Errors thrown by guards, lazy loaders or unknown route names go to `onError` handlers — also for Back/Forward and link clicks, which have no caller to catch them. Without handlers they are logged with `console.error`. `push`/`replace` still reject.

```ts
router.onError((error) => {
  // e.g. a lazy chunk missing after a deploy
  if (error instanceof TypeError && /dynamically imported module/.test(error.message))
    location.reload();
});
```

## Know where the user wanted to go

After a redirect (record or guard), `route.redirectedFrom` is the location first requested:

```ts
router.beforeEach((to) => (to.meta.requiresAuth && !isLoggedIn() ? "/login" : undefined));
// on /login, after the redirect:
const target = router.currentRoute.redirectedFrom?.fullPath ?? "/";
```

## Load pages lazily

```ts
{path: "/about", component: () => import("./pages/about")} // default export or the component itself
```

The loader runs once, during the first navigation to the route, before the page is shown.

## Redirect

```ts
{path: "/old-home", redirect: "/"},
{path: "/old-user/:id", redirect: (to) => ({name: "user", params: to.params})},
```

## Style links

`<upuaut-link>` renders a real `<a href>`. Classes go on the anchor:

| Class                                                | When                                                   |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `upuaut-link-active` (or `active-class`)             | current path is the target or below it                 |
| `upuaut-link-exact-active` (or `exact-active-class`) | current path is the target; also `aria-current="page"` |

```css
upuaut-link a.upuaut-link-exact-active {
  font-weight: bold;
}
```

Add `replace` to use `replace` instead of `push`, and `exact` to give the active class only on an exact match (a "Users" link that should not stay active on `/users/42`). Ctrl/Cmd-click, middle-click, `target="_blank"` and `download` keep the browser behavior.

Attributes are strings. For a named route, set the `to` property:

```ts
const link = document.createElement("upuaut-link") as UpuautLink;
link.to = {name: "user", params: {id: "42"}};
link.textContent = "Ada";
```

## Choose a history

| Factory                         | URLs          | When                                                          |
| ------------------------------- | ------------- | ------------------------------------------------------------- |
| `createWebHistory(base?)`       | `/users/42`   | default; the server must serve `index.html` for every app URL |
| `createHashHistory()`           | `/#/users/42` | static hosting without a fallback                             |
| `createMemoryHistory(initial?)` | none          | tests, embedded widgets                                       |

You can replace the router on `<upuaut-router>` at any time; views and links follow the new one.

## React to navigations

```ts
router.subscribe((to, from) => {
  /* after the view updated */
});
host.addEventListener(NavigatedEvent.eventName, (e) => {
  console.log((e as InstanceType<typeof NavigatedEvent>).newVal.fullPath);
});
```

## Test

Use memory history and `await` navigations:

```ts
const router = createRouter({history: createMemoryHistory("/users/1"), routes});
await router.start();
expect(router.currentRoute.params).toEqual({id: "1"});
await router.push("/");
```
