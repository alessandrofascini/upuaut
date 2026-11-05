/*
 * Router core.
 *
 * DESIGN
 * ------
 *
 * The route tree is flattened once, at creation time, into a list of
 * "matchers": one per record, each holding the compiled full path and the
 * chain of records from the root to that record (the chain becomes
 * `RouteLocation.matched`, one entry per nested <upuaut-view>). The list is
 * sorted by rank, so resolving a path is a linear scan that stops at the
 * first hit. A trie would be faster, but route tables are small (tens of
 * entries) and the scan keeps ranking rules in a single comparator.
 *
 * Every navigation goes through navigate(), a pipeline with fixed order:
 *
 *   resolve -> duplicate check -> record redirect -> beforeEach guards ->
 *   beforeEnter guards -> lazy components -> history write -> subscribers ->
 *   afterEach hooks
 *
 * Guards are async, so navigations can overlap. Instead of queueing them,
 * the newest navigation wins: each one takes a ticket (navigationId) and,
 * after every await, checks that it is still the latest. This is the same
 * policy as Vue Router, and it matches what users expect when they click
 * twice quickly.
 *
 * Expected outcomes (aborted, cancelled, duplicated) are returned as
 * NavigationFailure values; only programming errors are thrown.
 */

import {UpuautError, type NavigationFailure, type NavigationFailureType} from "./errors";
import type {RouterHistory} from "./history";
import {compilePath, joinPaths, type CompiledPath} from "./path";
import {parseQuery, stringifyQuery} from "./query";
import type {
  LazyRouteComponent,
  NavigationGuard,
  Query,
  RouteComponent,
  RouteLocation,
  RouteLocationRaw,
  RouteRecord,
} from "./types";

/** Options for {@link createRouter}. */
export interface RouterOptions {
  /** Where locations are read and written: web, hash or memory history. */
  history: RouterHistory;
  /** The route table. */
  routes: RouteRecord[];
}

/** Called after every navigation; `failure` is set when it did not complete. */
export type AfterEachHook = (
  to: RouteLocation,
  from: RouteLocation,
  failure?: NavigationFailure,
) => void;

/** Called after every completed navigation, before {@link AfterEachHook}s. */
export type RouteListener = (to: RouteLocation, from: RouteLocation) => void;

/** Receives errors thrown during a navigation; see {@link Router.onError}. */
export type ErrorHandler = (error: unknown) => void;

/** Resolves with `undefined` on success, or with a {@link NavigationFailure}. */
export type NavigationResult = Promise<NavigationFailure | void>;

/** The router returned by {@link createRouter}. */
export interface Router {
  /** The location being shown; {@link START_LOCATION} before the first navigation. */
  readonly currentRoute: RouteLocation;
  /** The history the router was created with. */
  readonly history: RouterHistory;
  /** Navigates and adds a history entry. Rejects only for errors (see {@link UpuautError}). */
  push(to: RouteLocationRaw): NavigationResult;
  /** Navigates and replaces the current history entry. */
  replace(to: RouteLocationRaw): NavigationResult;
  /** Same as the browser Back button. */
  back(): void;
  /** Same as the browser Forward button. */
  forward(): void;
  /** Moves `delta` entries through the history (negative = back). */
  go(delta: number): void;
  /** Resolves a target without navigating; `href` is ready for an `<a>`. Throws for an unknown name or missing param. */
  resolve(to: RouteLocationRaw): RouteLocation & {
    /** URL for an `<a href>`, including the history base or `#`. */
    href: string;
  };
  /** Adds a global guard. Returns a function that removes it. */
  beforeEach(guard: NavigationGuard): () => void;
  /** Adds a hook that sees every outcome. Returns a function that removes it. */
  afterEach(hook: AfterEachHook): () => void;
  /** Listens to completed navigations. Returns a function that stops listening. */
  subscribe(listener: RouteListener): () => void;
  /**
   * Adds a handler for errors thrown during any navigation (guards, lazy
   * loaders, unknown names). Without handlers they go to `console.error`.
   * `push`/`replace` still reject. Returns a function that removes it.
   */
  onError(handler: ErrorHandler): () => void;
  /** Resolves after the initial navigation started by {@link Router.start}. */
  isReady(): Promise<void>;
  /** Listens to the history and navigates to its current location. `<upuaut-router>` calls it for you. */
  start(): Promise<void>;
  /** Stops listening to the history. */
  stop(): void;
}

/**
 * The location before the first navigation. navigate() compares against this
 * exact object (not its path) to know that no navigation has completed yet.
 */
export const START_LOCATION: RouteLocation = Object.freeze({
  path: "/",
  fullPath: "/",
  params: {},
  query: {},
  hash: "",
  meta: {},
  matched: [],
});

// Guards and records can redirect to each other; this bounds accidental loops.
const MAX_REDIRECTS = 10;

interface Matcher {
  compiled: CompiledPath;
  chain: RouteRecord[];
  order: number;
}

/**
 * True when `component` is a loader function rather than a component.
 * Component classes (khnum Vessels and plain custom elements) are functions
 * too, so the test is on the prototype chain: anything whose prototype is not
 * an HTMLElement is a loader. Arrow functions have no prototype at all.
 */
export function isLazyComponent(
  component: RouteRecord["component"],
): component is LazyRouteComponent {
  return typeof component === "function" && !(component.prototype instanceof HTMLElement);
}

/**
 * Splits "/path?query#hash" into its parts. The hash is cut first because a
 * "?" after the "#" belongs to the hash, not to the query.
 */
/** Copies a query so later changes to the caller's object cannot alter a location. */
const copyQuery = (query: Query): Query =>
  Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  );

function splitRaw(raw: string): {path: string; query: Query; hash: string} {
  const hashAt = raw.indexOf("#");
  const hash = hashAt < 0 ? "" : raw.slice(hashAt);
  const beforeHash = hashAt < 0 ? raw : raw.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  const path = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt < 0 ? {} : parseQuery(beforeHash.slice(queryAt));
  return {path: path.startsWith("/") ? path : `/${path}`, query, hash: hash === "#" ? "" : hash};
}

/**
 * Creates a router.
 *
 * @example
 * ```ts
 * const router = createRouter({
 *   history: createWebHistory(),
 *   routes: [
 *     {path: "/", component: HomePage},
 *     {path: "/users/:id", name: "user", component: UserPage},
 *     {path: "*", component: NotFoundPage},
 *   ],
 * });
 * ```
 *
 * @throws {@link UpuautError} for an invalid path pattern or a duplicate route name.
 */
export function createRouter(options: RouterOptions): Router {
  const {history} = options;
  const matchers: Matcher[] = [];
  const byName = new Map<string, Matcher>();

  const addRecords = (records: RouteRecord[], parentPath: string, parents: RouteRecord[]): void => {
    for (const record of records) {
      const fullPath = joinPaths(parentPath, record.path);
      const chain = [...parents, record];
      const matcher: Matcher = {compiled: compilePath(fullPath), chain, order: matchers.length};
      matchers.push(matcher);
      if (record.name !== undefined) {
        if (byName.has(record.name)) {
          throw new UpuautError("createRouter", `duplicate route name "${record.name}"`);
        }
        byName.set(record.name, matcher);
      }
      if (record.children) addRecords(record.children, fullPath, chain);
    }
  };
  addRecords(options.routes, "", []);

  // Rank order: higher path score, then more segments, then the deeper record
  // (so a child with path "" wins over its parent for the same URL, like a
  // Vue Router index route), then declaration order. Array.sort is stable,
  // but the explicit last key makes the intent visible.
  matchers.sort(
    (a, b) =>
      b.compiled.score - a.compiled.score
      || b.compiled.segmentCount - a.compiled.segmentCount
      || b.chain.length - a.chain.length
      || a.order - b.order,
  );

  const beforeGuards = new Set<NavigationGuard>();
  const errorHandlers = new Set<ErrorHandler>();
  const afterHooks = new Set<AfterEachHook>();
  const listeners = new Set<RouteListener>();
  let current: RouteLocation = START_LOCATION;
  let navigationId = 0;
  let unlisten: (() => void) | undefined;
  let started: Promise<void> | undefined;
  // isReady() must work before start() is called, so the promise exists from
  // the beginning and start() settles it. The no-op catch avoids an
  // "unhandled rejection" when nobody awaits isReady().
  let markReady!: () => void;
  let markFailed!: (err: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    markFailed = reject;
  });
  ready.catch(() => undefined);

  /**
   * Turns any RouteLocationRaw into a full RouteLocation without navigating.
   * Throws UpuautError for an unknown route name or a missing required param.
   * A path that matches nothing resolves with `matched: []`.
   */
  const resolve = (to: RouteLocationRaw): RouteLocation & {href: string} => {
    let path: string;
    let query: Query;
    let hash: string;
    if (typeof to === "string") {
      ({path, query, hash} = splitRaw(to));
    } else if ("name" in to) {
      const named = byName.get(to.name);
      if (!named) throw new UpuautError("resolve", `unknown route name "${to.name}"`);
      path = named.compiled.build(to.params ?? {});
      query = copyQuery(to.query ?? {});
      hash = to.hash ?? "";
    } else {
      const parsed = splitRaw(to.path);
      path = parsed.path;
      query = {...parsed.query, ...copyQuery(to.query ?? {})};
      hash = to.hash ?? parsed.hash;
    }
    if (hash !== "" && !hash.startsWith("#")) hash = `#${hash}`;

    // Matchers are sorted by rank, so the first hit is the best one.

    let matched: RouteRecord[] = [];
    let params: Record<string, string> = {};
    for (const m of matchers) {
      const found = m.compiled.match(path);
      if (found) {
        matched = m.chain;
        params = found;
        break;
      }
    }
    const leaf = matched[matched.length - 1];
    const fullPath = `${path}${stringifyQuery(query)}${hash}`;
    return {
      path,
      fullPath,
      name: leaf?.name,
      params,
      query,
      hash,
      meta: Object.assign({}, ...matched.map((r) => r.meta ?? {})),
      matched,
      href: history.createHref(fullPath),
    };
  };

  /** Builds a NavigationFailure and reports it to afterEach hooks. */
  const finish = (
    to: RouteLocation,
    from: RouteLocation,
    type: NavigationFailureType,
  ): NavigationFailure => {
    const failure: NavigationFailure = {type, from, to};
    for (const hook of [...afterHooks]) hook(to, from, failure);
    return failure;
  };

  /**
   * Resolves the lazy components of `matched` in parallel. The result
   * replaces `record.component`, so each loader runs at most once and
   * <upuaut-view> can read the component synchronously.
   */
  const loadComponents = async (matched: RouteRecord[]): Promise<void> => {
    await Promise.all(
      matched.map(async (record) => {
        if (!isLazyComponent(record.component)) return;
        const loaded = await record.component();
        record.component = (
          typeof loaded === "object" && "default" in loaded ? loaded.default : loaded
        ) as RouteComponent;
      }),
    );
  };

  /**
   * Undoes a back/forward move that a guard rejected. The browser has already
   * changed the URL when popstate fires, so we must move back by the same
   * delta. The move is silent: otherwise it would start a new navigation and
   * run the guards again. When the delta is unknown (an entry without our
   * position state) the best we can do is to rewrite the URL.
   */
  const restoreAfterPop = (from: RouteLocation, delta: number): void => {
    if (delta !== 0) history.go(-delta, false);
    else history.replace(from.fullPath);
  };

  const navigate = async (
    raw: RouteLocationRaw,
    mode: "push" | "replace" | "pop" | "initial",
    redirects = 0,
    popDelta = 0,
    redirectedFrom?: RouteLocation,
  ): NavigationResult => {
    if (redirects > MAX_REDIRECTS) {
      throw new UpuautError("navigate", `more than ${MAX_REDIRECTS} redirects`);
    }
    // Take a ticket. Any later navigation makes this one stale (see DESIGN).
    const id = ++navigationId;
    const {href: _href, ...to} = resolve(raw);
    const from = current;
    const redirectMode = mode === "push" ? "push" : "replace";

    // The initial navigation is never a duplicate, even when the URL is "/":
    // START_LOCATION has the same fullPath but nothing is rendered yet.
    if (from !== START_LOCATION && to.fullPath === from.fullPath)
      return finish(to, from, "duplicated");

    // Record redirects only look at the leaf: a parent's redirect applies when
    // the URL stops at the parent, not when a child matched. A push stays a
    // push, so the user can still go back to the page they came from.
    const leaf = to.matched[to.matched.length - 1];
    if (leaf?.redirect !== undefined) {
      const target = typeof leaf.redirect === "function" ? leaf.redirect(to) : leaf.redirect;
      return navigate(target, redirectMode, redirects + 1, 0, redirectedFrom ?? to);
    }

    // beforeEnter runs only for records we are entering. Moving from
    // /users/1 to /users/2 keeps the /users record, so its guard is skipped.
    const entered = to.matched.filter((r) => !from.matched.includes(r));
    const guards: NavigationGuard[] = [
      ...beforeGuards,
      ...entered.flatMap((r) =>
        r.beforeEnter === undefined ? [] : ([] as NavigationGuard[]).concat(r.beforeEnter),
      ),
    ];
    const cancelled = (): boolean => id !== navigationId;

    for (const guard of guards) {
      const result = await guard(to, from);
      if (cancelled()) return finish(to, from, "cancelled");
      if (result === false) {
        if (mode === "pop") restoreAfterPop(from, popDelta);
        return finish(to, from, "aborted");
      }
      // A guard redirect replaces the entry: the rejected location must not
      // stay in the history, or Back would hit the same guard again.
      if (result !== undefined && result !== true) {
        return navigate(result, "replace", redirects + 1, 0, redirectedFrom ?? to);
      }
    }

    await loadComponents(to.matched);
    if (cancelled()) return finish(to, from, "cancelled");

    // Commit. A pop has already moved the browser, so it writes nothing.
    // Checklist: subscribers run before afterEach because <upuaut-view> is a
    // subscriber, and afterEach hooks expect the new page to be in the DOM.
    if (mode === "push") history.push(to.fullPath);
    else if (mode !== "pop") history.replace(to.fullPath);
    current = redirectedFrom ? {...to, redirectedFrom} : to;
    for (const listener of [...listeners]) listener(current, from);
    for (const hook of [...afterHooks]) hook(current, from);
  };

  /**
   * Entry point for every navigation started from outside navigate(): errors
   * go to the onError handlers (or the console) exactly once, here, and the
   * promise still rejects for callers that await it. Like Vue Router.
   */
  const run = (navigation: NavigationResult): NavigationResult =>
    navigation.catch((error: unknown) => {
      if (errorHandlers.size === 0) console.error(error);
      for (const handler of [...errorHandlers]) handler(error);
      throw error;
    });

  const unregister =
    <T>(set: Set<T>, item: T): (() => void) =>
    () => {
      set.delete(item);
    };

  return {
    get currentRoute() {
      return current;
    },
    history,
    push: (to) => run(navigate(to, "push")),
    replace: (to) => run(navigate(to, "replace")),
    back: () => history.go(-1),
    forward: () => history.go(1),
    go: (delta) => history.go(delta),
    resolve,
    beforeEach(guard) {
      beforeGuards.add(guard);
      return unregister(beforeGuards, guard);
    },
    afterEach(hook) {
      afterHooks.add(hook);
      return unregister(afterHooks, hook);
    },
    onError(handler) {
      errorHandlers.add(handler);
      return unregister(errorHandlers, handler);
    },
    subscribe(listener) {
      listeners.add(listener);
      return unregister(listeners, listener);
    },
    isReady: () => ready,
    /**
     * Starts listening to history pops and navigates to the current history
     * location. Safe to call more than once: later calls return the same
     * promise until stop() is called.
     */
    start() {
      if (started) return started;
      unlisten = history.listen((to, _from, {delta}) => {
        // Already reported by run(); nobody awaits a pop.
        run(navigate(to, "pop", 0, delta)).catch(() => undefined);
      });
      started = run(navigate(history.location, "initial")).then(
        () => markReady(),
        (err: unknown) => {
          markFailed(err);
          throw err;
        },
      );
      return started;
    },
    stop() {
      unlisten?.();
      unlisten = undefined;
      started = undefined;
    },
  };
}
