import { describe, expect, it } from "vitest";
import { ruleBlocks, sameCountry } from "./location";

const posting = (rule: string) => `About the role. ${rule} We offer great benefits.`;
const check = (rule: string, candidate: string) => ruleBlocks(rule, candidate, posting(rule));

describe("ruleBlocks", () => {
  it("blocks a work-authorization rule for another country", () => {
    expect(check("Must be authorized to work in the United States.", "Ahmedabad, India")).toBe(true);
  });

  it("blocks a must-be-based-in rule for another city abroad", () => {
    expect(check("We are looking to speak to candidates who are based in Gurugram.", "Berlin, Germany")).toBe(true);
  });

  it("allows a rule the candidate's country satisfies, including other cities in it", () => {
    expect(check("This role will be remote, and based in India.", "Ahmedabad, India")).toBe(false);
    expect(check("This is a full-time onsite internship in Bangalore.", "Ahmedabad, India (open to remote)")).toBe(false);
    expect(check("Must be authorized to work in the US.", "San Francisco, CA")).toBe(false);
  });

  it("blocks a candidate in an area the posting excludes", () => {
    expect(check("This role is not eligible to be hired in San Francisco, CA or the surrounding areas.", "San Francisco, CA")).toBe(true);
  });

  it("accepts a paraphrased quote when the posting states the rule for the same place", () => {
    const description = "Great team. We are looking to speak to candidates who are based in Gurugram for our hybrid working model.";
    expect(ruleBlocks("Must be based in Gurugram", "Berlin, Germany", description)).toBe(true);
  });

  it("rejects an invented rule when the posting only mentions the place in passing", () => {
    const description = "Join our Belgrade office, home to 200 engineers. We offer relocation assistance.";
    expect(ruleBlocks("Must be based in Belgrade, Serbia", "Ahmedabad, India", description)).toBeNull();
  });

  it("ignores a quoted rule that is not actually in the posting", () => {
    expect(ruleBlocks("Must be authorized to work in the United States.", "Ahmedabad, India", "No location rules here.")).toBeNull();
  });

  it("does not decide when the candidate's country is unknown", () => {
    expect(check("Must be authorized to work in the United States.", "Remote")).toBeNull();
  });

  it("does not decide when there is no rule", () => {
    expect(ruleBlocks(null, "Ahmedabad, India", "anything")).toBeNull();
  });
});

describe("sameCountry", () => {
  it("compares the countries of two place strings", () => {
    expect(sameCountry("Ahmedabad, India", "Onsite in Bangalore")).toBe(true);
    expect(sameCountry("Ahmedabad, India", "Belgrade, Serbia")).toBe(false);
  });

  it("does not decide when either side has no known country", () => {
    expect(sameCountry("Ahmedabad, India", "Fully Remote")).toBeNull();
    expect(sameCountry(null, "Berlin")).toBeNull();
  });
});
