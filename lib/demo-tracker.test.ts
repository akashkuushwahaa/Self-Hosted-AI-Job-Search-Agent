import { describe, expect, it } from "vitest";
import { applyOverlay, MAX_ENTRIES, parseOverlay, withChange, type Overlay } from "./demo-tracker";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("parseOverlay", () => {
  it("reads what withChange wrote", () => {
    const overlay = withChange(withChange([], A, "applied"), B, null);
    expect(parseOverlay(JSON.stringify(overlay))).toEqual([[A, "applied"], [B, null]]);
  });

  it("treats a missing, malformed or tampered cookie as no changes", () => {
    expect(parseOverlay(undefined)).toEqual([]);
    expect(parseOverlay("not json")).toEqual([]);
    expect(parseOverlay(JSON.stringify([["not-a-uuid", "applied"]]))).toEqual([]);
    expect(parseOverlay(JSON.stringify([[A, "hired"]]))).toEqual([]);
  });
});

describe("applyOverlay", () => {
  const snapshot = [
    { jobId: A, status: "saved" as const },
    { jobId: B, status: "applied" as const },
  ];

  it("is the snapshot when the visitor changed nothing", () => {
    expect(applyOverlay(snapshot, [])).toEqual(snapshot);
  });

  it("moves, removes and adds cards, new ones last", () => {
    expect(applyOverlay(snapshot, [[C, "saved"], [A, "offer"], [B, null]])).toEqual([
      { jobId: A, status: "offer" },
      { jobId: C, status: "saved" },
    ]);
  });
});

describe("withChange", () => {
  it("replaces an earlier change to the same job and moves it to the end", () => {
    expect(withChange([[A, "saved"], [B, "saved"]], A, "applied")).toEqual([[B, "saved"], [A, "applied"]]);
  });

  it("drops the oldest change past the cap, so the cookie stays under the browser's 4 KB limit", () => {
    let overlay: Overlay = Array.from({ length: MAX_ENTRIES }, (_, i) => [id(i), "saved"]);
    overlay = withChange(overlay, C, "saved");
    expect(overlay).toHaveLength(MAX_ENTRIES);
    expect(overlay[0][0]).toBe(id(1));
    expect(JSON.stringify(overlay).length).toBeLessThan(4000);
  });
});
