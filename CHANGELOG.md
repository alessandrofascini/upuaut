# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-05

First release.

### Added

- Router core: `createRouter` with path matching and ranking, nested routes, named routes, redirects, lazy route components, navigation guards (`beforeEach`, `beforeResolve`, `afterEach`, per-route `beforeEnter`), navigation failures (`isNavigationFailure`), `onError` and `RouteLocation.redirectedFrom`.
- History backends: `createWebHistory`, `createHashHistory` and `createMemoryHistory`, with entry positions so that aborted Back/Forward navigations are undone.
- Web components: `<upuaut-router>`, `<upuaut-view>` and `<upuaut-link>`. Links accept an object `to` (named routes) and an `exact` option for the active class.
- Query helpers: `parseQuery` and `stringifyQuery`.
- Demo SPA, guide (`docs/guide.md`), specification (`docs/router.md`), roadmap (`docs/roadmap.md`) and TypeDoc API reference.
- ESM and UMD builds with type declarations. `khnum` ^1.0.0 is a peer dependency.

[0.1.0]: https://github.com/alessandrofascini/upuaut/releases/tag/0.1.0
