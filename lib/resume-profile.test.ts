import { describe, expect, it } from "vitest";
import { mergeExtracted, type ExtractedProfile } from "./resume-profile";

const resume = "Jane Doe, Pune, India. SDE intern at Acme: built dashboards in React and Next.js with TypeScript. Python, FastAPI, PostgreSQL.";
const extracted: ExtractedProfile = {
  headline: "Full-stack developer",
  location: "Pune, India",
  yearsExperience: 1,
  skills: ["React", "Next.js", "TypeScript", "Kubernetes", "Teamwork"],
  targetRoles: ["Software Engineer Intern", "Frontend Engineer"],
};
const empty = { headline: null, location: null, yearsExperience: null, skills: [], targetRoles: [] };

describe("mergeExtracted", () => {
  it("fills an empty profile, keeping only skills the resume actually names", () => {
    const { values, filled } = mergeExtracted(null, extracted, resume);
    expect(values).toEqual({
      headline: "Full-stack developer",
      location: "Pune, India",
      yearsExperience: 1,
      skills: ["React", "Next.js", "TypeScript"], // Kubernetes isn't in the resume; Teamwork isn't a skill
      targetRoles: ["Software Engineer Intern", "Frontend Engineer"],
    });
    expect(filled).toEqual(["headline", "location", "years of experience", "3 skills", "target roles"]);
  });

  it("never overwrites what the user typed, and adds to their skills", () => {
    const current = { ...empty, headline: "My own headline", yearsExperience: 2, skills: ["Go", "react"], targetRoles: ["Backend Engineer"] };
    const { values, filled } = mergeExtracted(current, extracted, resume);
    expect(values).toEqual({ location: "Pune, India", skills: ["Go", "react", "Next.js", "TypeScript"] });
    expect(filled).toEqual(["location", "2 skills"]);
  });

  it("reports nothing when the resume adds nothing new", () => {
    const current = { headline: "x", location: "y", yearsExperience: 1, skills: ["React", "Next.js", "TypeScript"], targetRoles: ["z"] };
    expect(mergeExtracted(current, extracted, resume)).toEqual({ values: {}, filled: [] });
  });
});
