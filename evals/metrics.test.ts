import { describe, expect, it } from "vitest";
import { auc, prf } from "./metrics";

describe("auc", () => {
  it("is 1 for a perfect ranking, 0 for inverted, 0.5 for all ties", () => {
    expect(auc([0.9, 0.8, 0.1], [true, true, false])).toBe(1);
    expect(auc([0.1, 0.9], [true, false])).toBe(0);
    expect(auc([5, 5], [true, false])).toBe(0.5);
  });
});

describe("prf", () => {
  it("computes precision, recall and F1", () => {
    // tp=1 (i0), fp=1 (i1), fn=1 (i2)
    expect(prf([true, true, false, false], [true, false, true, false])).toEqual({ precision: 0.5, recall: 0.5, f1: 0.5 });
  });
});

