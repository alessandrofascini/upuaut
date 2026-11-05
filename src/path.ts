/*
 * Path patterns.
 *
 * A pattern is compiled once into a regular expression plus a score. Each
 * segment adds to the score by kind, so a more specific pattern always ranks
 * above a less specific one for the same URL (the ranking idea comes from
 * React Router):
 *
 *   static "users"  10    /users/new    = 20
 *   param  ":id"     3    /users/:id    = 13
 *   optional ":id?"  2    /users/:id?   = 12
 *   splat  ":rest*"  1    /users/:rest* = 11
 *
 * Optional and splat segments own their leading "/" inside the group, so
 * "/users/:id?" matches "/users" as well as "/users/42".
 */

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

/**
 * Joins a child path to its parent. An absolute child ("/x") ignores the
 * parent. A child "*" stays scoped: under "/users" it becomes "/users/*".
 */
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

/**
 * Compiles a pattern. Throws UpuautError for an invalid param name or a splat
 * that is not the last segment. Matching is case-insensitive and accepts one
 * trailing slash.
 */
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
  // The root "/" has no segments; scoring it as one static segment keeps it
  // above the catch-all "*", which also matches "/".
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
