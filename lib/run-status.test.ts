import { describe, expect, it } from "vitest";
import { timeAgo, toRunStatus } from "./run-status";

const at = new Date("2026-11-26T10:00:00Z");

describe("toRunStatus", () => {
  it("maps pg-boss states to what the page says", () => {
    expect(toRunStatus({ state: "created", createdOn: at, startedOn: at, completedOn: null, output: {} })).toMatchObject({ state: "queued", at });
    expect(toRunStatus({ state: "retry", createdOn: at, startedOn: at, completedOn: null, output: {} })).toMatchObject({ state: "queued" });
    expect(toRunStatus({ state: "active", createdOn: at, startedOn: at, completedOn: null, output: {} })).toMatchObject({ state: "running", at });
    expect(toRunStatus({ state: "completed", createdOn: at, startedOn: at, completedOn: at, output: {} })).toEqual({ state: "finished", at, error: null });
    expect(toRunStatus({ state: "cancelled", createdOn: at, startedOn: at, completedOn: at, output: {} })).toBeNull();
  });

  it("keeps the error a failed run recorded", () => {
    expect(toRunStatus({ state: "failed", createdOn: at, startedOn: at, completedOn: at, output: { message: "fetch failed" } })).toEqual({
      state: "failed", at, error: "fetch failed",
    });
    expect(toRunStatus({ state: "failed", createdOn: at, startedOn: at, completedOn: at, output: null })?.error).toBeNull();
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  it("reads like a person would say it", () => {
    expect(timeAgo(new Date("2026-11-26T11:59:40Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-11-26T11:55:00Z"), now)).toBe("5 minutes ago");
    expect(timeAgo(new Date("2026-11-26T11:00:00Z"), now)).toBe("1 hour ago");
    expect(timeAgo(new Date("2026-11-24T12:00:00Z"), now)).toBe("2 days ago");
  });
});
