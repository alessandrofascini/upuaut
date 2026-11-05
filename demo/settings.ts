export type HistoryMode = "web" | "hash" | "memory";

export interface DemoSettings {
  history: HistoryMode;
  requireLogin: boolean;
  blockNavigation: boolean;
  guardDelay: number;
  lazyDelay: number;
}

type SettingsListener = (settings: DemoSettings, changed: (keyof DemoSettings)[]) => void;

const STORAGE_KEY = "upuaut-demo-settings";
const DEFAULTS: DemoSettings = {
  history: "web",
  requireLogin: true,
  blockNavigation: false,
  guardDelay: 0,
  lazyDelay: 0,
};

function load(): DemoSettings {
  try {
    return {...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")};
  } catch {
    return {...DEFAULTS};
  }
}

export const settings: DemoSettings = load();
const listeners = new Set<SettingsListener>();

export function updateSettings(patch: Partial<DemoSettings>): void {
  const changed = (Object.keys(patch) as (keyof DemoSettings)[]).filter(
    (key) => patch[key] !== settings[key],
  );
  if (changed.length === 0) return;
  Object.assign(settings, patch);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  for (const cb of [...listeners]) cb(settings, changed);
}

export function onSettings(cb: SettingsListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const AUTH_KEY = "upuaut-demo-auth";
export const isLoggedIn = (): boolean => localStorage.getItem(AUTH_KEY) === "1";
