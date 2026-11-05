/*
 * History backends.
 *
 * DESIGN
 * ------
 *
 * The router never touches window.history directly: it talks to a small
 * RouterHistory interface with three implementations. Memory history is a
 * plain array with an index. Web and hash history share
 * createBrowserHistory(), which takes two functions: read() turns the
 * browser URL into a router location, toHref() does the reverse. That pair is
 * the only difference between "/app/users" and "/#/users" URLs.
 *
 * Only pops (back, forward, go, a manual hash edit) notify listeners. Push
 * and replace are called by the router itself, which already knows.
 *
 * Positions. The History API does not tell you which way the user moved on
 * popstate. To undo a move that a guard rejects we need the distance, so
 * every entry we create carries its index in history.state.upuautPosition.
 * On popstate: delta = new position - old position. This is the technique
 * used by Vue Router.
 */

export interface HistoryNavigationInfo {
  /** Entries moved: negative for back, positive for forward, 0 when unknown. */
  delta: number;
}

export type HistoryListener = (to: string, from: string, info: HistoryNavigationInfo) => void;

/*
 * Checklist for a new RouterHistory implementation:
 * - notify listeners only for pops, never for push/replace;
 * - report the real delta of each pop (0 only when it cannot be known);
 * - honor go(delta, false): move without notifying listeners.
 * The router relies on all three to undo pops that a guard rejects.
 */
export interface RouterHistory {
  readonly location: string;
  push(to: string, state?: unknown): void;
  replace(to: string, state?: unknown): void;
  /** Moves through the history. With `triggerListeners = false` the move is silent. */
  go(delta: number, triggerListeners?: boolean): void;
  listen(cb: HistoryListener): () => void;
  createHref(to: string): string;
  destroy(): void;
}

const normalizeBase = (base: string): string => {
  const withSlash = base.startsWith("/") ? base : `/${base}`;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
};

const ensureLeadingSlash = (to: string): string => (to.startsWith("/") ? to : `/${to}`);

/**
 * An in-memory history for tests and non-browser environments. go() notifies
 * listeners synchronously, unlike a browser, where popstate comes later.
 */
export function createMemoryHistory(initial = "/"): RouterHistory {
  let stack = [ensureLeadingSlash(initial)];
  let index = 0;
  const listeners = new Set<HistoryListener>();

  return {
    get location() {
      return stack[index];
    },
    push(to) {
      // Like a browser: pushing after going back drops the forward entries.
      stack = stack.slice(0, index + 1);
      stack.push(ensureLeadingSlash(to));
      index = stack.length - 1;
    },
    replace(to) {
      stack[index] = ensureLeadingSlash(to);
    },
    go(delta, triggerListeners = true) {
      const next = Math.min(Math.max(index + delta, 0), stack.length - 1);
      if (next === index) return;
      const from = stack[index];
      const moved = next - index;
      index = next;
      if (!triggerListeners) return;
      for (const cb of [...listeners]) cb(stack[index], from, {delta: moved});
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    createHref(to) {
      return ensureLeadingSlash(to);
    },
    destroy() {
      listeners.clear();
      stack = [stack[index]];
      index = 0;
    },
  };
}

interface PositionState {
  upuautPosition?: number;
}

const readPosition = (): number | undefined => {
  const state = window.history.state as PositionState | null;
  return typeof state?.upuautPosition === "number" ? state.upuautPosition : undefined;
};

/** Adds our position to the caller's state without losing their keys. */
const withPosition = (state: unknown, position: number): object => ({
  ...(typeof state === "object" && state !== null ? state : {}),
  upuautPosition: position,
});

function createBrowserHistory(read: () => string, toHref: (to: string) => string): RouterHistory {
  const listeners = new Set<HistoryListener>();
  let current = read();
  let position = readPosition() ?? 0;
  // Number of go() calls whose popstate must not reach listeners. A counter,
  // not a flag, so two quick silent moves are both swallowed.
  let silentPops = 0;

  // The entry the page was loaded on has no position yet: give it one, so a
  // later pop back to it gets a correct delta.
  if (readPosition() === undefined) {
    window.history.replaceState(withPosition(window.history.state, position), "");
  }

  const onPop = (): void => {
    // Browsers fire both popstate and hashchange for a hash change. The second
    // event finds the location unchanged and stops here.
    const next = read();
    if (next === current) return;
    const from = current;
    const nextPosition = readPosition();
    let delta = 0;
    if (nextPosition === undefined) {
      // A new entry without our state, e.g. the user edited the hash.
      position += 1;
      window.history.replaceState(withPosition(window.history.state, position), "");
    } else {
      delta = nextPosition - position;
      position = nextPosition;
    }
    // Update our state even for a silent pop: the URL really changed.
    current = next;
    if (silentPops > 0) {
      silentPops -= 1;
      return;
    }
    for (const cb of [...listeners]) cb(next, from, {delta});
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener("hashchange", onPop);

  return {
    get location() {
      return current;
    },
    push(to, state = null) {
      position += 1;
      window.history.pushState(withPosition(state, position), "", toHref(to));
      current = read();
    },
    replace(to, state = null) {
      window.history.replaceState(withPosition(state, position), "", toHref(to));
      current = read();
    },
    go(delta, triggerListeners = true) {
      if (!triggerListeners) silentPops += 1;
      window.history.go(delta);
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    createHref: toHref,
    destroy() {
      listeners.clear();
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    },
  };
}

/**
 * History on real URLs ("/app/users"). `base` is removed from locations and
 * added to hrefs. The server must answer every app URL with index.html.
 */
export function createWebHistory(base = "/"): RouterHistory {
  const prefix = normalizeBase(base);
  return createBrowserHistory(
    () => {
      const {pathname, search, hash} = window.location;
      const inBase = prefix !== "" && (pathname === prefix || pathname.startsWith(`${prefix}/`));
      const path = inBase ? pathname.slice(prefix.length) : pathname;
      return `${path || "/"}${search}${hash}`;
    },
    (to) => `${prefix}${ensureLeadingSlash(to)}`,
  );
}

/**
 * History in the URL hash ("/#/users"). Works on static hosting without a
 * fallback, because the server only ever sees the part before "#".
 */
export function createHashHistory(base = ""): RouterHistory {
  return createBrowserHistory(
    () => ensureLeadingSlash(window.location.hash.slice(1)),
    (to) =>
      `${base || window.location.pathname + window.location.search}#${ensureLeadingSlash(to)}`,
  );
}
