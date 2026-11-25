import { describe, expect, it } from "vitest";
import { groupByStatus, parseStatus, STATUSES } from "./tracker";

describe("parseStatus", () => {
  it("accepts every board column", () => {
    for (const s of STATUSES) expect(parseStatus(s)).toBe(s);
  });

  it("rejects anything else, since it comes from the client", () => {
    expect(parseStatus("hired")).toBeNull();
    expect(parseStatus(undefined)).toBeNull();
  });
});

describe("groupByStatus", () => {
  it("puts every card in its column, keeping empty columns", () => {
    const grouped = groupByStatus([
      { jobId: "a", status: "applied" as const },
      { jobId: "b", status: "saved" as const },
      { jobId: "c", status: "applied" as const },
    ]);
    expect(Object.keys(grouped)).toEqual([...STATUSES]);
    expect(grouped.applied.map((c) => c.jobId)).toEqual(["a", "c"]);
    expect(grouped.offer).toEqual([]);
  });
});
