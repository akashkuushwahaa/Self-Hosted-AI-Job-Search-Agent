import { describe, expect, it } from "vitest";
import { rrf } from "./rrf";

describe("rrf", () => {
  it("ranks ids found by both lists above ids found by one", () => {
    // a: 1/61 + 1/62, c: 1/63 + 1/61, b: 1/62
    expect(rrf([["a", "b", "c"], ["c", "a"]])).toEqual(["a", "c", "b"]);
  });

  it("keeps a single list's order", () => {
    expect(rrf([["x", "y", "z"]])).toEqual(["x", "y", "z"]);
  });
});
