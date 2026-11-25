import { describe, expect, it } from "vitest";
import { applyCaps, finalize, seniorityFit, type Match, type MatchJob, type MatchProfile } from "./match";

const clean: Match = {
  roleFit: "same", requiredYears: 3, locationFit: "works", locationRule: null,
  matchedSkills: [], missingSkills: [], reason: "", score: 90,
};

describe("seniorityFit", () => {
  it("treats posted years as a minimum", () => {
    expect(seniorityFit(4, 5)).toBe("fits"); // a year short
    expect(seniorityFit(8, 2)).toBe("fits"); // over the minimum
    expect(seniorityFit(1, 3)).toBe("stretch"); // junior for mid
    expect(seniorityFit(4, 8)).toBe("far"); // mid for staff
  });

  it("only penalizes over-qualification for intern and new-grad roles", () => {
    expect(seniorityFit(1, 0)).toBe("fits");
    expect(seniorityFit(8, 0)).toBe("far");
  });

  it("does not penalize when either side is unknown", () => {
    expect(seniorityFit(null, 5)).toBe("fits");
    expect(seniorityFit(4, null)).toBe("fits");
  });
});

describe("applyCaps", () => {
  it("leaves a clean fit alone", () => {
    expect(applyCaps(clean, 4).score).toBe(90);
  });

  it("caps a blocked location even when the model scored it high", () => {
    expect(applyCaps({ ...clean, locationFit: "blocked", score: 65 }, 4).score).toBe(30);
  });

  it("applies the tightest of several caps", () => {
    expect(applyCaps({ ...clean, roleFit: "adjacent", requiredYears: 8 }, 4).score).toBe(39);
  });

  it("never raises a low score", () => {
    expect(applyCaps({ ...clean, score: 20 }, 4).score).toBe(20);
  });
});

describe("finalize", () => {
  const profile: MatchProfile = {
    headline: null, location: "Ahmedabad, India", yearsExperience: 1, skills: [], targetRoles: [], resumeText: null,
  };
  const job = (description: string): MatchJob => ({ title: "Intern", company: "Acme", location: "Austin", description });

  it("blocks and caps a job whose quoted rule the candidate fails, even if the model said relocate", () => {
    const rule = "Must be authorized to work in the United States.";
    const m = finalize({ ...clean, locationFit: "relocate", locationRule: rule, score: 65 }, profile, job(`Hi. ${rule}`));
    expect(m.locationFit).toBe("blocked");
    expect(m.score).toBe(30);
  });

  it("clears a block when the rule names the candidate's own country", () => {
    const rule = "This is an onsite internship in Bangalore.";
    const m = finalize({ ...clean, requiredYears: 0, locationFit: "blocked", locationRule: rule, score: 70 }, profile, job(rule));
    expect(m.locationFit).toBe("works");
    expect(m.score).toBe(70);
  });

  it("without a rule the posting states, judges distance from the job's own location", () => {
    const abroad = { ...job("text"), location: "Belgrade, Serbia" };
    const home = { ...job("text"), location: "Onsite in Bangalore" };
    // the model "quoted" a rule that is not in the posting, so its "blocked" has no basis
    expect(finalize({ ...clean, locationFit: "blocked", locationRule: "Must be based in Belgrade" }, profile, abroad).locationFit).toBe("relocate");
    expect(finalize({ ...clean, locationFit: "relocate" }, profile, home).locationFit).toBe("works");
  });

  it("keeps the model's call, minus any unsupported block, when the job location is unknown", () => {
    const remote = { ...job("text"), location: "Fully Remote" };
    expect(finalize({ ...clean, locationFit: "relocate" }, profile, remote).locationFit).toBe("relocate");
    expect(finalize({ ...clean, locationFit: "blocked" }, profile, remote).locationFit).toBe("relocate");
  });

  it("cleans skill tags", () => {
    const m = finalize({ ...clean, missingSkills: ["Go", "work-life harmony"], matchedSkills: ["React", "react"] }, profile, job("text"));
    expect(m.missingSkills).toEqual(["Go"]);
    expect(m.matchedSkills).toEqual(["React"]);
  });
});
