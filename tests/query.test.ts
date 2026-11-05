import {describe, expect, it} from "vitest";
import {parseQuery, stringifyQuery} from "../src/query";

describe("parseQuery", () => {
  it("returns an empty object for empty input", () => {
    expect(parseQuery("")).toEqual({});
    expect(parseQuery("?")).toEqual({});
  });

  it("parses single, repeated, valueless and encoded keys", () => {
    expect(parseQuery("?a=1&b=x%20y&a=2&flag&c=a+b&a=3")).toEqual({
      a: ["1", "2", "3"],
      b: "x y",
      flag: "",
      c: "a b",
    });
  });

  it("keeps malformed escapes as they are", () => {
    expect(parseQuery("q=%E0%A4%A")).toEqual({q: "%E0%A4%A"});
  });
});

describe("stringifyQuery", () => {
  it("returns an empty string for an empty query", () => {
    expect(stringifyQuery({})).toBe("");
  });

  it("encodes values and repeats array keys", () => {
    expect(stringifyQuery({a: ["1", "2"], b: "x y", flag: ""})).toBe("?a=1&a=2&b=x%20y&flag");
  });

  it("round-trips", () => {
    const q = {tab: "info", ids: ["1", "2"], s: "a&b=c"};
    expect(parseQuery(stringifyQuery(q))).toEqual(q);
  });
});

describe("query edge cases", () => {
  it("skips empty pairs", () => {
    expect(parseQuery("?a=1&&b=2&")).toEqual({a: "1", b: "2"});
  });
});
