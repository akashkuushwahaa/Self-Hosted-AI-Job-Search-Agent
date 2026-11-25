import { describe, expect, it } from "vitest";
import { cleanTags, isNonSkill, splitSkills } from "./skills";

describe("isNonSkill", () => {
  it("flags traits, perks and requirements that are not skills", () => {
    for (const tag of [
      "authentic culture", "work-life harmony", "Relocation support", "5+ years of experience", "Judgment", "growth mindset",
      // traits seen in the demo's scored jobs
      "Team player", "AI enthusiast", "Thoughtful problem-solving", "Put users first", "Not ideological about technology",
      "Creativity in reframing problems", "Strong computer science fundamentals",
    ])
      expect(isNonSkill(tag), tag).toBe(true);
  });

  it("keeps technical skills, including multi-word ones", () => {
    for (const tag of ["React", "Go", "Kubernetes", "distributed systems", "LLM evaluation", "PostgreSQL", "C++"])
      expect(isNonSkill(tag), tag).toBe(false);
  });
});

describe("cleanTags", () => {
  it("drops non-skills, sentence-length tags and case-insensitive duplicates", () => {
    expect(
      cleanTags(["React", "vibrant community", "Experience taking ML projects from problem formulation to production", "react", "Go"]),
    ).toEqual(["React", "Go"]);
  });
});

describe("splitSkills", () => {
  const candidate = { skills: ["TypeScript", "Python", "Next.js"], resumeText: "Built APIs with FastAPI and styled with Tailwind CSS." };

  it("moves 'missing' skills the candidate actually has into matched", () => {
    expect(splitSkills(["React"], ["Python", "Go", "Tailwind CSS", "FastAPI"], candidate)).toEqual({
      matched: ["React", "Python", "Tailwind CSS", "FastAPI"],
      missing: ["Go"],
    });
  });

  it("matches whole words only, so Go is not found inside 'good'", () => {
    expect(splitSkills([], ["Go"], { skills: [], resumeText: "a good engineer" }).missing).toEqual(["Go"]);
  });

  it("cleans both lists", () => {
    expect(splitSkills(["Team player", "React"], ["work-life harmony", "Rust"], { skills: [], resumeText: null })).toEqual({
      matched: ["React"],
      missing: ["Rust"],
    });
  });
});
