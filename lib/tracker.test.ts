import { describe, expect, it } from "vitest";
import { groupByStatus, parseStatus, STATUSES, followUpDue, parseDetails } from "./tracker";

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

describe("followUpDue", () => {
  const today = "2026-11-26";
  it("says when a follow-up is overdue, due today or ahead", () => {
    expect(followUpDue("2026-11-20", "applied", today)).toBe("overdue");
    expect(followUpDue("2026-11-26", "interviewing", today)).toBe("today");
    expect(followUpDue("2026-12-01", "applied", today)).toBe("upcoming");
    expect(followUpDue(null, "applied", today)).toBeNull();
  });

  it("never nags about finished applications", () => {
    expect(followUpDue("2026-11-20", "offer", today)).toBeNull();
    expect(followUpDue("2026-11-20", "rejected", today)).toBeNull();
  });
});

describe("parseDetails", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };

  it("reads the form, turning blanks into nothing", () => {
    expect(parseDetails(form({ appliedOn: "2026-11-20", nextStep: " Phone screen ", followUpOn: "", notes: "" }))).toEqual({
      ok: true,
      details: { appliedOn: "2026-11-20", nextStep: "Phone screen", followUpOn: null, notes: null },
    });
  });

  it("rejects malformed dates and overlong text", () => {
    expect(parseDetails(form({ appliedOn: "20/11/2026" }))).toMatchObject({ ok: false });
    expect(parseDetails(form({ appliedOn: "2026-02-30" }))).toMatchObject({ ok: false });
    expect(parseDetails(form({ notes: "x".repeat(5001) }))).toMatchObject({ ok: false });
  });
});
