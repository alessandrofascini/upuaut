export type LogKind = "ok" | "failure" | "error" | "info";

export interface LogEntry {
  time: string;
  kind: LogKind;
  text: string;
}

const MAX_ENTRIES = 50;
const entries: LogEntry[] = [];
const listeners = new Set<(entries: readonly LogEntry[]) => void>();

const emit = (): void => {
  for (const cb of [...listeners]) cb(entries);
};

export function addLog(kind: LogKind, text: string): void {
  const time = new Date().toLocaleTimeString([], {hour12: false});
  entries.unshift({time, kind, text});
  entries.length = Math.min(entries.length, MAX_ENTRIES);
  emit();
}

export function clearLog(): void {
  entries.length = 0;
  emit();
}

export function onLog(cb: (entries: readonly LogEntry[]) => void): () => void {
  listeners.add(cb);
  cb(entries);
  return () => listeners.delete(cb);
}
