import {KhnumError} from "khnum";
import {describe, expect, it} from "vitest";
import {isNavigationFailure, UpuautError} from "../src/errors";
import type {RouteLocation} from "../src/types";

const loc = (path: string): RouteLocation => ({
  path,
  fullPath: path,
  params: {},
  query: {},
  hash: "",
  meta: {},
  matched: [],
});

describe("UpuautError", () => {
  it("extends KhnumError and formats with the Upuaut prefix", () => {
    const err = new UpuautError("push", "unknown route");
    expect(err).toBeInstanceOf(KhnumError);
    expect(err.name).toBe("UpuautError");
    expect(err.toString()).toBe("Upuaut.push: unknown route");
  });
});

describe("isNavigationFailure", () => {
  const failure = {type: "aborted", from: loc("/"), to: loc("/a")};

  it("detects failures, optionally by type", () => {
    expect(isNavigationFailure(failure)).toBe(true);
    expect(isNavigationFailure(failure, "aborted")).toBe(true);
    expect(isNavigationFailure(failure, "cancelled")).toBe(false);
  });

  it("rejects other values", () => {
    expect(isNavigationFailure(undefined)).toBe(false);
    expect(isNavigationFailure(new Error("x"))).toBe(false);
    expect(isNavigationFailure({type: "other", from: 1, to: 2})).toBe(false);
  });
});
