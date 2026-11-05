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

export interface RouterOptions {
  history: RouterHistory;
  routes: RouteRecord[];
}

export type AfterEachHook = (
  to: RouteLocation,
  from: RouteLocation,
  failure?: NavigationFailure,
) => void;

export type RouteListener = (to: RouteLocation, from: RouteLocation) => void;

export type NavigationResult = Promise<NavigationFailure | void>;

export interface Router {
  readonly currentRoute: RouteLocation;
  readonly history: RouterHistory;
  push(to: RouteLocationRaw): NavigationResult;
  replace(to: RouteLocationRaw): NavigationResult;
  back(): void;
  forward(): void;
  go(delta: number): void;
  resolve(to: RouteLocationRaw): RouteLocation & {href: string};
  beforeEach(guard: NavigationGuard): () => void;
  afterEach(hook: AfterEachHook): () => void;
  subscribe(listener: RouteListener): () => void;
  isReady(): Promise<void>;
  start(): Promise<void>;
  stop(): void;
}

export const START_LOCATION: RouteLocation = Object.freeze({
  path: "/",
  fullPath: "/",
  params: {},
  query: {},
  hash: "",
  meta: {},
  matched: [],
});

const MAX_REDIRECTS = 10;

interface Matcher {
  compiled: CompiledPath;
  chain: RouteRecord[];
  order: number;
}

export function isLazyComponent(
  component: RouteRecord["component"],
): component is LazyRouteComponent {
  return typeof component === "function" && !("fire" in component);
}

function splitRaw(raw: string): {path: string; query: Query; hash: string} {
  const hashAt = raw.indexOf("#");
  const hash = hashAt < 0 ? "" : raw.slice(hashAt);
  const beforeHash = hashAt < 0 ? raw : raw.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  const path = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt < 0 ? {} : parseQuery(beforeHash.slice(queryAt));
  return {path: path.startsWith("/") ? path : `/${path}`, query, hash: hash === "#" ? "" : hash};
}

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
  matchers.sort(
    (a, b) =>
      b.compiled.score - a.compiled.score
      || b.compiled.segmentCount - a.compiled.segmentCount
      || b.chain.length - a.chain.length
      || a.order - b.order,
  );

  const beforeGuards = new Set<NavigationGuard>();
  const afterHooks = new Set<AfterEachHook>();
  const listeners = new Set<RouteListener>();
  let current: RouteLocation = START_LOCATION;
  let navigationId = 0;
  let unlisten: (() => void) | undefined;
  let started: Promise<void> | undefined;
  let markReady!: () => void;
  let markFailed!: (err: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    markFailed = reject;
  });
  ready.catch(() => undefined);

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
      query = to.query ?? {};
      hash = to.hash ?? "";
    } else {
      const parsed = splitRaw(to.path);
      path = parsed.path;
      query = {...parsed.query, ...to.query};
      hash = to.hash ?? parsed.hash;
    }
    if (hash !== "" && !hash.startsWith("#")) hash = `#${hash}`;

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

  const finish = (
    to: RouteLocation,
    from: RouteLocation,
    type: NavigationFailureType,
  ): NavigationFailure => {
    const failure: NavigationFailure = {type, from, to};
    for (const hook of [...afterHooks]) hook(to, from, failure);
    return failure;
  };

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

  const restoreAfterPop = (from: RouteLocation, delta: number): void => {
    if (delta !== 0) history.go(-delta, false);
    else history.replace(from.fullPath);
  };

  const navigate = async (
    raw: RouteLocationRaw,
    mode: "push" | "replace" | "pop" | "initial",
    redirects = 0,
    popDelta = 0,
  ): NavigationResult => {
    if (redirects > MAX_REDIRECTS) {
      throw new UpuautError("navigate", `more than ${MAX_REDIRECTS} redirects`);
    }
    const id = ++navigationId;
    const {href: _href, ...to} = resolve(raw);
    const from = current;
    const redirectMode = mode === "push" ? "push" : "replace";

    if (from !== START_LOCATION && to.fullPath === from.fullPath)
      return finish(to, from, "duplicated");

    const leaf = to.matched[to.matched.length - 1];
    if (leaf?.redirect !== undefined) {
      const target = typeof leaf.redirect === "function" ? leaf.redirect(to) : leaf.redirect;
      return navigate(target, redirectMode, redirects + 1);
    }

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
      if (result !== undefined && result !== true) {
        return navigate(result, "replace", redirects + 1);
      }
    }

    await loadComponents(to.matched);
    if (cancelled()) return finish(to, from, "cancelled");

    if (mode === "push") history.push(to.fullPath);
    else if (mode !== "pop") history.replace(to.fullPath);
    current = to;
    for (const listener of [...listeners]) listener(to, from);
    for (const hook of [...afterHooks]) hook(to, from);
  };

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
    push: (to) => navigate(to, "push"),
    replace: (to) => navigate(to, "replace"),
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
    subscribe(listener) {
      listeners.add(listener);
      return unregister(listeners, listener);
    },
    isReady: () => ready,
    start() {
      if (started) return started;
      unlisten = history.listen((to, _from, {delta}) => {
        navigate(to, "pop", 0, delta).catch((err: unknown) => console.error(err));
      });
      started = navigate(history.location, "initial").then(
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
