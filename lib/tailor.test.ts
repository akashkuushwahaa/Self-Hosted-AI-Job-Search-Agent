import { describe, expect, it } from "vitest";
import { groundTailored, type TailoredDraft } from "./tailor";

const resume = "Software Engineering Intern, Acme (2026): built dashboards in React and TypeScript; wrote REST APIs in Node.js. Cut page load time by 40%.";
const facts = { resumeText: resume, profileSkills: ["React", "TypeScript", "Node.js", "PostgreSQL"] };

const draft = (over: Partial<TailoredDraft> = {}): TailoredDraft => ({
  jobSkills: ["React", "TypeScript", "Kubernetes", "Go"],
  summary: "Frontend-focused engineer who builds React dashboards. Experienced with Kubernetes in production.",
  highlights: [
    { point: "Built React and TypeScript dashboards for Acme", evidence: "built dashboards in React and TypeScript" },
    { point: "Cut page load time by 40%", evidence: "Cut page load time by 40%." },
    { point: "Ran Go services on Kubernetes", evidence: "ran Go services on Kubernetes" },
  ],
  coverLetter: "I'm excited to apply.\n\nAt Acme I built dashboards in React. I have deep Go experience. I also wrote REST APIs in Node.js.",
  ...over,
});

describe("groundTailored", () => {
  it("keeps points whose evidence is really in the resume, whatever the spacing or case", () => {
    const t = groundTailored(draft({ highlights: [{ point: "Built dashboards", evidence: "BUILT  dashboards in\nReact" }] }), facts);
    expect(t.highlights.map((h) => h.point)).toEqual(["Built dashboards"]);
  });

  it("drops invented evidence and every sentence claiming a skill the candidate doesn't have", () => {
    const t = groundTailored(draft(), facts);
    expect(t.highlights.map((h) => h.point)).toEqual(["Built React and TypeScript dashboards for Acme", "Cut page load time by 40%"]);
    expect(t.summary).toBe("Frontend-focused engineer who builds React dashboards.");
    expect(t.coverLetter).toBe("I'm excited to apply.\n\nAt Acme I built dashboards in React. I also wrote REST APIs in Node.js.");
    expect(t.removed).toEqual([
      "Experienced with Kubernetes in production.",
      "Ran Go services on Kubernetes",
      "I have deep Go experience.",
    ]);
  });

  it("allows a skill that's in the profile even if the resume text doesn't say it", () => {
    const t = groundTailored(draft({ jobSkills: ["PostgreSQL"], summary: "I model data in PostgreSQL." }), facts);
    expect(t.summary).toBe("I model data in PostgreSQL.");
    expect(t.removed).toEqual(["Ran Go services on Kubernetes"]); // its evidence isn't in the resume
  });

  it("matches skills as whole words, so Go doesn't catch 'good' or 'going'", () => {
    const t = groundTailored(draft({ summary: "A good engineer, going further." }), facts);
    expect(t.summary).toBe("A good engineer, going further.");
  });

  it("drops a point whose quote is real but doesn't back the skill it names", () => {
    const t = groundTailored(
      draft({ highlights: [{ point: "Proficient in Node.js", evidence: "built dashboards in React and TypeScript" }, { point: "Wrote REST APIs in Node.js", evidence: "wrote REST APIs in Node.js" }] }),
      facts,
    );
    expect(t.highlights.map((h) => h.point)).toEqual(["Wrote REST APIs in Node.js"]);
    expect(t.removed).toContain("Proficient in Node.js");
  });
});
