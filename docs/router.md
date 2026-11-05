# Upuaut — router specification

> Upuaut, "the opener of the ways": a client-side router for web components, built on [khnum](https://github.com/alessandrofascini/khnum).
>
> Status: implemented on `feature/router` (v1 scope: §10, hash history included, no declarative `<upuaut-route>`).

The API borrows from two well-known routers:

| Concept          | Vue Router                                                        | React Router                            | Upuaut                                                         |
| ---------------- | ----------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| Router factory   | `createRouter({history, routes})`                                 | `createBrowserRouter(routes)`           | `createRouter({history, routes})`                              |
| History backends | `createWebHistory`, `createWebHashHistory`, `createMemoryHistory` | browser / hash / memory                 | `createWebHistory`, `createHashHistory`, `createMemoryHistory` |
| Outlet           | `<RouterView>`                                                    | `<Outlet>`                              | `<upuaut-view>`                                                |
| Link             | `<RouterLink>` (active classes)                                   | `<Link>` / `<NavLink>` (`aria-current`) | `<upuaut-link>` (both)                                         |
| Root / provider  | `app.use(router)`                                                 | `<RouterProvider>`                      | `<upuaut-router>`                                              |
| Guards           | `beforeEach`, `afterEach`, `beforeEnter`                          | loaders / `redirect()`                  | `beforeEach`, `afterEach`, `beforeEnter`                       |
| Named routes     | `{name: "user"}`                                                  | —                                       | `{name: "user"}`                                               |
| Lazy routes      | `component: () => import(...)`                                    | `lazy: () => import(...)`               | `component: () => import(...)`                                 |
| Catch-all        | `/:pathMatch(.*)*`                                                | `path="*"`                              | `path: "*"` or `/:rest*`                                       |

## 1. Quick start

```ts
import {createRouter, createWebHistory, UpuautRouter} from "upuaut";
import {HomePage, UserPage, UsersPage, NotFoundPage} from "./pages";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {path: "/", name: "home", component: HomePage},
    {
      path: "/users",
      component: UsersPage, // must contain an <upuaut-view> for its children
      children: [{path: ":id", name: "user", component: UserPage}],
    },
    {path: "/about", component: () => import("./pages/about")},
    {path: "*", component: NotFoundPage},
  ],
});

UpuautRouter.fire(); // registers <upuaut-router>, <upuaut-view>, <upuaut-link>
```

```html
<upuaut-router>
  <nav>
    <upuaut-link to="/">Home</upuaut-link>
    <upuaut-link to="/users">Users</upuaut-link>
  </nav>
  <upuaut-view></upuaut-view>
</upuaut-router>
<script type="module">
  document.querySelector("upuaut-router").router = router;
</script>
```

## 2. Route records

```ts
type RouteComponent = Vessel | CustomElementConstructor | string /* tag name */;
type LazyRouteComponent = () => Promise<RouteComponent | {default: RouteComponent}>;

interface RouteRecord {
  path: string; // absolute at top level, relative inside `children`
  name?: string; // unique; used by named navigation
  component?: RouteComponent | LazyRouteComponent;
  children?: RouteRecord[];
  redirect?: RouteLocationRaw | ((to: RouteLocation) => RouteLocationRaw);
  beforeEnter?: NavigationGuard | NavigationGuard[];
  meta?: Record<string, unknown>; // merged parent -> child into `to.meta`
}
```

- A record with `children` and no `component` only groups paths.
- `component` as a `Vessel` is fired (`.fire()`) before first render. A tag name must be defined by the app.
- `component` as a plain `HTMLElement` subclass must be registered by the app (`customElements.define`); its tag comes from `customElements.getName()`. An unregistered class throws `UpuautError` at render.
- Any other function is a lazy loader.
- A lazy component is resolved once, during navigation and before guards finish; the result is cached.

## 3. Path syntax

| Pattern         | Matches                | Params               |
| --------------- | ---------------------- | -------------------- |
| `/about`        | `/about`               | —                    |
| `/users/:id`    | `/users/42`            | `{id: "42"}`         |
| `/users/:id?`   | `/users`, `/users/42`  | `{id: "42"}` or `{}` |
| `/files/:rest*` | `/files`, `/files/a/b` | `{rest: "a/b"}`      |
| `*`             | anything               | `{"*": "<rest>"}`    |

- Matching is case-insensitive, ignores one trailing slash, and decodes params with `decodeURIComponent`.
- When more than one route matches, the highest **rank** wins (React Router ranking): per segment, static (10) > dynamic (3) > optional (2) > splat (1); then the longer path; then declaration order.

## 4. Route location

```ts
interface RouteLocation {
  path: string; // "/users/42"
  fullPath: string; // "/users/42?tab=info#top"
  name?: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  hash: string; // "" or "#top"
  meta: Record<string, unknown>;
  matched: RouteRecord[]; // root -> leaf, one per nested <upuaut-view>
}

type RouteLocationRaw =
  | string // "/users/42?tab=info"
  | {path: string; query?: Query; hash?: string}
  | {name: string; params?: Record<string, string>; query?: Query; hash?: string};
```

## 5. Router API

```ts
interface Router {
  readonly currentRoute: RouteLocation;
  push(to: RouteLocationRaw): Promise<NavigationFailure | void>;
  replace(to: RouteLocationRaw): Promise<NavigationFailure | void>;
  back(): void;
  forward(): void;
  go(delta: number): void;
  resolve(to: RouteLocationRaw): RouteLocation & {href: string};
  beforeEach(guard: NavigationGuard): () => void; // returns an unregister function
  afterEach(
    hook: (to: RouteLocation, from: RouteLocation, failure?: NavigationFailure) => void,
  ): () => void;
  subscribe(listener: (to: RouteLocation, from: RouteLocation) => void): () => void;
  isReady(): Promise<void>; // resolves after the initial navigation
  start(): Promise<void>; // reads the history location and listens to it
  stop(): void;
}
```

- Navigating to the current `fullPath` resolves with a `duplicated` failure and changes nothing.
- A new navigation started while one is pending cancels the old one (`cancelled` failure).
- An unknown `name` throws `UpuautError`. An unmatched path resolves with `matched: []`.

## 6. Navigation guards

```ts
type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation,
) => void | boolean | RouteLocationRaw | Promise<void | boolean | RouteLocationRaw>;
```

Order (Vue Router): global `beforeEach` (registration order) → `beforeEnter` of each newly entered record → lazy components resolved → history updated → `subscribe` listeners → `afterEach`.

| Guard returns        | Effect                                                   |
| -------------------- | -------------------------------------------------------- |
| `undefined` / `true` | continue                                                 |
| `false`              | abort; failure `aborted`                                 |
| `RouteLocationRaw`   | redirect (a new navigation, replacing the history entry) |
| throws / rejects     | abort; the error propagates from `push()`                |

Redirect chains are limited to 10 hops; the 11th throws `UpuautError`.

An aborted back/forward navigation is undone with a silent `history.go(-delta)`, so no history entry is rewritten. Browser histories store the entry position in `history.state.upuautPosition` (user state passed to `push`/`replace` is kept).

## 7. History backends

| Factory                              | URL form      | Use                                               |
| ------------------------------------ | ------------- | ------------------------------------------------- |
| `createWebHistory(base = "/")`       | `/users/42`   | production; needs server fallback to `index.html` |
| `createHashHistory(base = "")`       | `/#/users/42` | static hosting without fallback _(gate)_          |
| `createMemoryHistory(initial = "/")` | none          | tests, SSR-less environments                      |

```ts
interface RouterHistory {
  readonly location: string; // path + query + hash, base removed
  push(to: string, state?: unknown): void;
  replace(to: string, state?: unknown): void;
  go(delta: number, triggerListeners?: boolean): void; // false = silent move
  listen(cb: (to: string, from: string, info: {delta: number}) => void): () => void; // pops only
  createHref(to: string): string;
  destroy(): void;
}
```

## 8. Web components

All three are khnum `Shape`s with light DOM. `UpuautRouter.fire()` fires the others as dependencies.

### `<upuaut-router>`

| Member             | Kind     | Description                                                             |
| ------------------ | -------- | ----------------------------------------------------------------------- |
| `router`           | property | the `Router`; setting it calls `router.start()` if not started          |
| `upuaut-navigated` | event    | `ChangedEvent<RouteLocation>` (`newVal` = to, `oldVal` = from); bubbles |

Descendants find their router by walking up the tree, also across shadow roots.

### `<upuaut-view>`

| Member | Kind      | Description                                  |
| ------ | --------- | -------------------------------------------- |
| `name` | attribute | reserved for named views _(out of scope v1)_ |

- Depth = number of ancestor `<upuaut-view>` elements. It renders `currentRoute.matched[depth].component`.
- It replaces its content only when the record at its depth changes. When only params change, the same element instance stays and gets a new `route` property (like Vue's component reuse).
- The rendered element receives `route: RouteLocation` as a property.
- If no record matches at its depth, it renders nothing.

### `<upuaut-link>`

| Attribute            | Default                    | Description                                           |
| -------------------- | -------------------------- | ----------------------------------------------------- |
| `to`                 | —                          | target, a string `RouteLocationRaw`                   |
| `replace`            | absent                     | use `replace` instead of `push`                       |
| `active-class`       | `upuaut-link-active`       | added when `to` is a prefix of the current path       |
| `exact-active-class` | `upuaut-link-exact-active` | added on exact match; also sets `aria-current="page"` |

- Renders a real `<a href>` (from `router.resolve(to).href`) that wraps the slotted children, so middle-click, "open in new tab" and crawlers work.
- Plain left-clicks without modifier keys (`ctrl`, `meta`, `shift`, `alt`), without `target="_blank"` and without `download` call `router.push()` and `preventDefault()`.

## 9. Errors and failures

| Type                                                                           | When                                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `UpuautError extends KhnumError`                                               | programming errors: unknown route name, missing param, redirect loop, `<upuaut-view>` outside `<upuaut-router>` |
| `NavigationFailure {type: "aborted" \| "cancelled" \| "duplicated", from, to}` | expected outcomes, resolved (not thrown) from `push`/`replace`                                                  |

## 10. Scope

| In v1                                               | Out of v1                                      |
| --------------------------------------------------- | ---------------------------------------------- |
| matching, ranking, params, query, hash              | named views, transitions                       |
| web / memory history; hash history _(gate)_         | scroll restoration (`scrollBehavior`)          |
| guards, redirects, lazy components                  | data loaders / actions (React Router)          |
| `<upuaut-router>`, `<upuaut-view>`, `<upuaut-link>` | declarative `<upuaut-route>` children _(gate)_ |
| demo SPA in `demo/`                                 | SSR                                            |

## 11. Demo SPA (`demo/`)

| Path                    | Shows                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `/`                     | home, static route                                         |
| `/users` → `/users/:id` | nested routes, params, param-only reuse                    |
| `/about`                | lazy component                                             |
| `/admin`                | `beforeEach` guard redirecting to `/login?redirect=/admin` |
| `/old-home`             | `redirect: "/"`                                            |
| `/old-user/:id`         | function redirect to the named route `user`                |
| `/search?q=`            | query                                                      |
| `/posts/:slug?`         | optional param                                             |
| `/files/:rest*`         | splat param                                                |
| `/docs#section`         | hash                                                       |
| `*`                     | 404 page                                                   |

The `<demo-panel>` on the right changes the router live:

| Control                                                | Shows                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| History: web / hash / memory                           | swapping the `Router` on `<upuaut-router>` at runtime             |
| Require login                                          | `beforeEach` redirect                                             |
| Block every navigation                                 | `aborted` failure; Back is undone silently                        |
| Slow guard (ms)                                        | `cancelled` failure when a second click wins                      |
| Lazy delay (ms)                                        | lazy component resolved before commit                             |
| Navigate: path, name + params + query, back/forward/go | `push`, `replace`, `resolve` preview, named routes, `UpuautError` |
| Current route                                          | `RouteLocation` from the `upuaut-navigated` event                 |
| Navigation log                                         | `afterEach` with failures                                         |
