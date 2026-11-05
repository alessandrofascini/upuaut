export interface HistoryNavigationInfo {
  /** Entries moved: negative for back, positive for forward, 0 when unknown. */
  delta: number;
}

export type HistoryListener = (to: string, from: string, info: HistoryNavigationInfo) => void;

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

export function createMemoryHistory(initial = "/"): RouterHistory {
  let stack = [ensureLeadingSlash(initial)];
  let index = 0;
  const listeners = new Set<HistoryListener>();

  return {
    get location() {
      return stack[index];
    },
    push(to) {
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

const withPosition = (state: unknown, position: number): object => ({
  ...(typeof state === "object" && state !== null ? state : {}),
  upuautPosition: position,
});

function createBrowserHistory(read: () => string, toHref: (to: string) => string): RouterHistory {
  const listeners = new Set<HistoryListener>();
  let current = read();
  let position = readPosition() ?? 0;
  let silentPops = 0;
  if (readPosition() === undefined) {
    window.history.replaceState(withPosition(window.history.state, position), "");
  }

  const onPop = (): void => {
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

export function createHashHistory(base = ""): RouterHistory {
  return createBrowserHistory(
    () => ensureLeadingSlash(window.location.hash.slice(1)),
    (to) =>
      `${base || window.location.pathname + window.location.search}#${ensureLeadingSlash(to)}`,
  );
}
