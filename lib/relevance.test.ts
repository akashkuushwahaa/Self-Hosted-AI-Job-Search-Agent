import { describe, expect, it } from "vitest";
import { relevant } from "./relevance";

const hits = (...distances: number[]) => distances.map((distance, i) => ({ id: String(i), distance }));

describe("relevant", () => {
  it("drops everything when even the nearest job is far (a query nothing matches)", () => {
    expect(relevant(hits(0.436, 0.455, 0.47))).toEqual([]);
  });

  it("keeps only hits within reach of the best one", () => {
    // best 0.2: the band ends at 0.28
    expect(relevant(hits(0.2, 0.25, 0.279, 0.28, 0.3)).map((h) => h.id)).toEqual(["0", "1", "2"]);
  });

  it("caps the band at the absolute cutoff", () => {
    expect(relevant(hits(0.35, 0.39, 0.399, 0.4, 0.41)).map((h) => h.id)).toEqual(["0", "1", "2"]);
  });

  it("handles no hits", () => {
    expect(relevant([])).toEqual([]);
  });
});
