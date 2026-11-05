# TODO

Remaining work for Upuaut after `feature/router`. Details and proposed designs for the library items: [docs/roadmap.md](docs/roadmap.md). Items marked 🔒 need explicit approval (merge, push, publish, deploy).

## Release

- [ ] 🔒 Merge the feature: `git flow feature finish router` (into `develop`)
- [ ] 🔒 Add a git remote and push `master`, `develop` (no remote is configured)
- [ ] Add `CHANGELOG.md` (0.1.0: router core, histories, components, demo)
- [ ] Check the package contents with `npm pack --dry-run` (`dist/` only, types, ESM + UMD)
- [ ] 🔒 Release 0.1.0: `git flow release start 0.1.0`, bump `package.json`, tag
- [ ] 🔒 Publish to npm

## CI

- [ ] GitHub Actions: `npm run check` on every push and pull request
- [ ] GitHub Actions: `npm run test:browser` and `npm run test:e2e` (install Playwright Chromium in CI)
- [ ] Coverage thresholds (now: 93.8 % statements, 90.7 % branches; lowest is `src/components/link.ts`, 64 % functions)
- [ ] 🔒 Deploy the demo (e.g. GitHub Pages with hash history, or with a 404 → `index.html` fallback)

## Library: v1 gaps

- [ ] Copy the caller's `query` object in `resolve()` instead of keeping a reference (review finding 4)
- [ ] Error hook: `router.onError(cb)` for errors thrown by guards and lazy loaders during pop navigations (now only `console.error`)
- [ ] `RouteLocation.redirectedFrom`, so pages can tell that a redirect happened
- [ ] `<upuaut-link>`: accept an object `to` through a property (named routes in markup); `exact` option for the active class
- [x] Tests for the uncovered paths (coverage now 99.8 % statements, 99.7 % branches, 100 % functions and lines)

## Library: out of v1 scope (docs/router.md section 10)

- [ ] Scroll behavior (`scrollBehavior`: restore on Back, scroll to `#hash`)
- [ ] Named views (`<upuaut-view name="sidebar">`, the `name` attribute is already reserved)
- [ ] Dynamic routes: `router.addRoute()` / `router.removeRoute()`
- [ ] Declarative routes: `<upuaut-route path component>` children (React Router style)
- [ ] Transitions between views
- [ ] Data loaders and actions (React Router style)
- [ ] SSR

## Documentation

- [x] Generated API reference: `npm run docs` (TypeDoc, every export documented)
- [x] Guide: docs/guide.md (recipes)
- [x] Roadmap with designs for the gaps and out-of-scope items: docs/roadmap.md
- [ ] Migration notes from Vue Router / React Router
