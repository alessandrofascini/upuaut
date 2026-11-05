import type {Query} from "./types";

const decode = (s: string): string => {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
};

export function parseQuery(search: string): Query {
  const query: Query = {};
  const source = search.startsWith("?") ? search.slice(1) : search;
  if (source === "") return query;
  for (const pair of source.split("&")) {
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    const key = decode(eq < 0 ? pair : pair.slice(0, eq));
    const value = eq < 0 ? "" : decode(pair.slice(eq + 1));
    const existing = query[key];
    if (existing === undefined) query[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else query[key] = [existing, value];
  }
  return query;
}

export function stringifyQuery(query: Query): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    const k = encodeURIComponent(key);
    for (const v of Array.isArray(value) ? value : [value]) {
      parts.push(v === "" ? k : `${k}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}
