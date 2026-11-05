import {UpuautError} from "./errors";
import type {Params} from "./types";

type Segment =
  | {kind: "static"; value: string}
  | {kind: "param"; name: string}
  | {kind: "optional"; name: string}
  | {kind: "splat"; name: string};

export interface CompiledPath {
  readonly pattern: string;
  readonly score: number;
  readonly segmentCount: number;
  match(path: string): Params | null;
  build(params: Params): string;
}

const SCORES: Record<Segment["kind"], number> = {static: 10, param: 3, optional: 2, splat: 1};
const PARAM = /^:([A-Za-z_$][\w$]*)([?*])?$/;

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function joinPaths(parent: string, child: string): string {
  if (child.startsWith("/") || parent === "") return child;
  const base = parent.endsWith("/") ? parent.slice(0, -1) : parent;
  return child === "" ? base || "/" : `${base}/${child}`;
}

function parseSegments(pattern: string): Segment[] {
  if (pattern === "*") return [{kind: "splat", name: "*"}];
  const parts = pattern.split("/").filter((p) => p !== "");
  return parts.map((part, i): Segment => {
    if (part === "*") {
      if (i !== parts.length - 1)
        throw new UpuautError("compilePath", `"*" must be last in ${pattern}`);
      return {kind: "splat", name: "*"};
    }
    if (!part.startsWith(":")) return {kind: "static", value: part};
    const m = PARAM.exec(part);
    if (!m) throw new UpuautError("compilePath", `invalid param "${part}" in ${pattern}`);
    const [, name, modifier] = m;
    if (modifier === "*") {
      if (i !== parts.length - 1)
        throw new UpuautError("compilePath", `"${part}" must be last in ${pattern}`);
      return {kind: "splat", name};
    }
    return modifier === "?" ? {kind: "optional", name} : {kind: "param", name};
  });
}

export function compilePath(pattern: string): CompiledPath {
  const segments = parseSegments(pattern);
  const names: string[] = [];
  let source = "^";
  for (const seg of segments) {
    switch (seg.kind) {
      case "static":
        source += `/${escapeRegex(seg.value)}`;
        break;
      case "param":
        source += "/([^/]+)";
        names.push(seg.name);
        break;
      case "optional":
        source += "(?:/([^/]+))?";
        names.push(seg.name);
        break;
      case "splat":
        source += "(?:/(.*))?";
        names.push(seg.name);
        break;
    }
  }
  source += "/?$";
  const regex = new RegExp(source, "i");
  const score =
    segments.length === 0 ? SCORES.static : segments.reduce((sum, s) => sum + SCORES[s.kind], 0);

  return {
    pattern,
    score,
    segmentCount: segments.length,
    match(path) {
      const m = regex.exec(path);
      if (!m) return null;
      const params: Params = {};
      names.forEach((name, i) => {
        const raw = m[i + 1];
        if (raw === undefined || raw === "") return;
        params[name] = safeDecode(raw.endsWith("/") ? raw.slice(0, -1) : raw);
      });
      return params;
    },
    build(params) {
      let out = "";
      for (const seg of segments) {
        if (seg.kind === "static") {
          out += `/${seg.value}`;
          continue;
        }
        const value = params[seg.name];
        if (value === undefined || value === "") {
          if (seg.kind === "param") {
            throw new UpuautError("compilePath", `missing param "${seg.name}" for ${pattern}`);
          }
          continue;
        }
        out +=
          seg.kind === "splat"
            ? `/${value.split("/").map(encodeURIComponent).join("/")}`
            : `/${encodeURIComponent(value)}`;
      }
      return out || "/";
    },
  };
}
