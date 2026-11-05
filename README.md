# Upuaut

> "The opener of the ways." A client-side router for web components, built on [khnum](https://github.com/alessandrofascini/khnum).

Upuaut borrows its API from Vue Router and React Router: a `createRouter()` factory, web / hash / memory history, nested and named routes, navigation guards, redirects, lazy routes, and three custom elements: `<upuaut-router>`, `<upuaut-view>` and `<upuaut-link>`.

## Status

`0.0.0`, in development on `feature/router`.

| Document                           | Content                                             |
| ---------------------------------- | --------------------------------------------------- |
| [docs/guide.md](docs/guide.md)     | task-oriented recipes                               |
| [docs/router.md](docs/router.md)   | full specification                                  |
| [docs/roadmap.md](docs/roadmap.md) | v1 gaps and planned features, with proposed designs |
| `npm run docs`                     | generated API reference in `dist-docs/` (TypeDoc)   |

## Install

```sh
npm install upuaut khnum
```

## Quick start

```ts
import {createRouter, createWebHistory, UpuautRouter} from "upuaut";
import {HomePage, UsersPage, UserPage, NotFoundPage} from "./pages";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {path: "/", name: "home", component: HomePage},
    {
      path: "/users",
      component: UsersPage, // renders an <upuaut-view> for its children
      children: [{path: ":id", name: "user", component: UserPage}],
    },
    {path: "/about", component: () => import("./pages/about")},
    {path: "*", component: NotFoundPage},
  ],
});

router.beforeEach((to) => (to.meta.requiresAuth && !loggedIn() ? "/login" : undefined));

UpuautRouter.fire();
document.querySelector("upuaut-router")!.router = router;
```

```html
<upuaut-router>
  <nav>
    <upuaut-link to="/">Home</upuaut-link>
    <upuaut-link to="/users">Users</upuaut-link>
  </nav>
  <upuaut-view></upuaut-view>
</upuaut-router>
```

The element rendered by `<upuaut-view>` receives the current `route` (`RouteLocation`) as a property. When only the params change, the same element instance gets the new `route`.

## API at a glance

| Export                                                         | Kind                                               | See                                             |
| -------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `createRouter`                                                 | function                                           | [spec §5](docs/router.md#5-router-api)          |
| `createWebHistory`, `createHashHistory`, `createMemoryHistory` | functions                                          | [spec §7](docs/router.md#7-history-backends)    |
| `UpuautRouter`, `UpuautView`, `UpuautLink`                     | custom elements                                    | [spec §8](docs/router.md#8-web-components)      |
| `NavigatedEvent`                                               | `ChangedEvent<RouteLocation>` (`upuaut-navigated`) | [spec §8](docs/router.md#8-web-components)      |
| `UpuautError`, `isNavigationFailure`                           | errors                                             | [spec §9](docs/router.md#9-errors-and-failures) |
| `parseQuery`, `stringifyQuery`                                 | helpers                                            | —                                               |

## Demo

`npm run dev` opens a demo SPA that shows every feature. A control panel switches the history mode (web, hash, memory), toggles guards, adds delays to see cancellation and lazy loading, navigates by path or by name, and logs every navigation and failure.

## Development

| Command                | Does                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`          | demo SPA in `demo/` with hot reload                                                              |
| `npm run test`         | unit tests (Vitest + happy-dom)                                                                  |
| `npm run test:browser` | component, history and demo tests in headless Chromium (needs `npx playwright install chromium`) |
| `npm run test:e2e`     | Playwright end-to-end tests against the built demo (`vite preview`)                              |
| `npm run typecheck`    | `tsc --noEmit`                                                                                   |
| `npm run build`        | library build to `dist/`                                                                         |
| `npm run build:demo`   | demo build to `dist-demo/`                                                                       |
| `npm run docs`         | API reference to `dist-docs/` (fails on undocumented exports or broken links)                    |
| `npm run check`        | format, type-check, tests and both builds                                                        |

## License

MIT
