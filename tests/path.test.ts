import {describe, expect, it} from "vitest";
import {UpuautError} from "../src/errors";
import {compilePath, joinPaths} from "../src/path";

describe("compilePath.match", () => {
  it("matches static paths case-insensitively with one optional trailing slash", () => {
    const p = compilePath("/about");
    expect(p.match("/about")).toEqual({});
    expect(p.match("/About/")).toEqual({});
    expect(p.match("/about//")).toBeNull();
    expect(p.match("/about/x")).toBeNull();
  });

  it("matches the root", () => {
    expect(compilePath("/").match("/")).toEqual({});
    expect(compilePath("/").match("/x")).toBeNull();
  });

  it("extracts and decodes dynamic params", () => {
    expect(compilePath("/users/:id").match("/users/a%20b")).toEqual({id: "a b"});
    expect(compilePath("/users/:id").match("/users")).toBeNull();
  });

  it("supports optional params", () => {
    const p = compilePath("/users/:id?");
    expect(p.match("/users")).toEqual({});
    expect(p.match("/users/42")).toEqual({id: "42"});
  });

  it("supports named and anonymous splats", () => {
    const p = compilePath("/files/:rest*");
    expect(p.match("/files")).toEqual({});
    expect(p.match("/files/a/b")).toEqual({rest: "a/b"});
    expect(compilePath("*").match("/x/y")).toEqual({"*": "x/y"});
    expect(compilePath("*").match("/")).toEqual({});
  });

  it("escapes regex characters in static segments", () => {
    expect(compilePath("/a.b").match("/axb")).toBeNull();
    expect(compilePath("/a.b").match("/a.b")).toEqual({});
  });

  it("throws UpuautError for invalid patterns", () => {
    expect(() => compilePath("/:1bad")).toThrow(UpuautError);
    expect(() => compilePath("/:rest*/x")).toThrow(UpuautError);
    expect(() => compilePath("/*/x")).toThrow(UpuautError);
  });
});

describe("compilePath.score", () => {
  it("ranks static > dynamic > optional > splat", () => {
    const scores = ["/users/new", "/users/:id", "/users/:id?", "/users/:rest*", "*"].map(
      (p) => compilePath(p).score,
    );
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(new Set(scores).size).toBe(scores.length);
  });

  it("ranks the root above the catch-all", () => {
    expect(compilePath("/").score).toBeGreaterThan(compilePath("*").score);
  });
});

describe("compilePath.build", () => {
  it("fills and encodes params", () => {
    expect(compilePath("/users/:id").build({id: "a b"})).toBe("/users/a%20b");
    expect(compilePath("/users/:id?").build({})).toBe("/users");
    expect(compilePath("/files/:rest*").build({rest: "a b/c"})).toBe("/files/a%20b/c");
    expect(compilePath("/").build({})).toBe("/");
  });

  it("throws on a missing required param", () => {
    expect(() => compilePath("/users/:id").build({})).toThrow(UpuautError);
  });
});

describe("joinPaths", () => {
  it("joins relative children and keeps absolute ones", () => {
    expect(joinPaths("/users", ":id")).toBe("/users/:id");
    expect(joinPaths("/users/", ":id")).toBe("/users/:id");
    expect(joinPaths("/", "about")).toBe("/about");
    expect(joinPaths("/users", "")).toBe("/users");
    expect(joinPaths("/users", "/abs")).toBe("/abs");
    expect(joinPaths("/users", "*")).toBe("/users/*");
    expect(joinPaths("", "*")).toBe("*");
  });
});
