export type HistoryListener = (to: string, from: string) => void;

export interface RouterHistory {
  readonly location: string;
  push(to: string, state?: unknown): void;
  replace(to: string, state?: unknown): void;
  go(delta: number): void;
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
    go(delta) {
      const next = Math.min(Math.max(index + delta, 0), stack.length - 1);
      if (next === index) return;
      const from = stack[index];
      index = next;
      for (const cb of [...listeners]) cb(stack[index], from);
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

function createBrowserHistory(read: () => string, toHref: (to: string) => string): RouterHistory {
  const listeners = new Set<HistoryListener>();
  let current = read();

  const onPop = (): void => {
    const next = read();
    if (next === current) return;
    const from = current;
    current = next;
    for (const cb of [...listeners]) cb(next, from);
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener("hashchange", onPop);

  return {
    get location() {
      return current;
    },
    push(to, state = null) {
      window.history.pushState(state, "", toHref(to));
      current = read();
    },
    replace(to, state = null) {
      window.history.replaceState(state, "", toHref(to));
      current = read();
    },
    go(delta) {
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
