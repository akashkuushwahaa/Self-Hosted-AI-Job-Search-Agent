import { describe, expect, it } from "vitest";
import { cleanReason, toBlocks } from "./text";

describe("toBlocks", () => {
  it("turns paragraphs and bullet runs into blocks", () => {
    expect(toBlocks("About us\nWe build tools.\n\n• React\n• Go\nThanks")).toEqual([
      { kind: "p", lines: ["About us", "We build tools."] },
      { kind: "ul", lines: ["React", "Go"] },
      { kind: "p", lines: ["Thanks"] },
    ]);
  });

  it("ignores blank lines and stray whitespace", () => {
    expect(toBlocks("\n\n  Hello  \n\n\n•  Item \n")).toEqual([
      { kind: "p", lines: ["Hello"] },
      { kind: "ul", lines: ["Item"] },
    ]);
  });
});


describe("cleanReason", () => {
  it("cuts a reason that switches language, at the last complete sentence", () => {
    expect(cleanReason("Good stack fit. The role is in Lisbon. The candidate should consider relocating,虽")).toBe(
      "Good stack fit. The role is in Lisbon.",
    );
  });

  it("leaves an English reason alone", () => {
    expect(cleanReason("Strong React skills. Needs Go.")).toBe("Strong React skills. Needs Go.");
  });

  it("keeps the text before the switch when there is no full sentence", () => {
    expect(cleanReason("Relocation to Austin is the阻")).toBe("Relocation to Austin is the");
  });
});
