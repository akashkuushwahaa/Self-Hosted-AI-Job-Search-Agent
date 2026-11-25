import { z } from "zod";
import { generateJson } from "./llm";
import { ruleBlocks, sameCountry } from "./location";
import { splitSkills } from "./skills";
import { cleanReason } from "./text";

export type MatchProfile = {
  headline: string | null;
  location: string | null;
  yearsExperience: number | null;
  skills: string[];
  targetRoles: string[];
  resumeText: string | null;
};

export type MatchJob = { title: string; company: string; location: string | null; description: string };

// Evidence fields come before the score so the model reasons before it commits to a number.
// Gates are enforced in code (applyCaps): a 7B model spots a blocker like "not eligible in SF"
// yet still scores 65, and it judges seniority badly but extracts "5+ years" reliably.
// Computing the whole score from these fields instead (eval v3) did worse: see evals/match.
export const matchSchema = z.object({
  roleFit: z.enum(["same", "adjacent", "different"]),
  requiredYears: z.number().int().min(0).max(30).nullable(),
  locationFit: z.enum(["works", "relocate", "blocked"]),
  locationRule: z.string().max(400).nullable(),
  matchedSkills: z.array(z.string()).max(15),
  missingSkills: z.array(z.string()).max(15),
  reason: z.string().max(600),
  score: z.number().int().min(0).max(100),
});
export type Match = z.infer<typeof matchSchema>;

// intern/new grad (<1), junior (1-2), mid (3-4), senior (5-7), staff+ (8+)
const level = (years: number) => (years < 1 ? 0 : years < 3 ? 1 : years < 5 ? 2 : years < 8 ? 3 : 4);

export function seniorityFit(candidateYears: number | null, requiredYears: number | null) {
  if (candidateYears == null || requiredYears == null) return "fits"; // unknown: don't penalize
  if (requiredYears === 0) return candidateYears >= 3 ? "far" : "fits"; // intern/new-grad roles
  if (candidateYears + 1 >= requiredYears) return "fits"; // "5+ years" is a minimum; being over it is fine
  return level(requiredYears) - level(candidateYears) <= 1 ? "stretch" : "far";
}

// Highest score each gate allows; the rubric bands in SYSTEM use the same edges.
const CAPS = {
  roleFit: { same: 100, adjacent: 64, different: 30 },
  seniorityFit: { fits: 100, stretch: 84, far: 39 },
  locationFit: { works: 100, relocate: 84, blocked: 30 },
} as const;

export function applyCaps(m: Match, candidateYears: number | null): Match {
  const cap = Math.min(
    CAPS.roleFit[m.roleFit],
    CAPS.seniorityFit[seniorityFit(candidateYears, m.requiredYears)],
    CAPS.locationFit[m.locationFit],
  );
  return { ...m, score: Math.min(m.score, cap) };
}

const SYSTEM = `You score how well a candidate fits a job posting, for the candidate's own job search.

Score 0-100 with this rubric:
- 85-100: same kind of role, seniority fits the candidate's experience, location or remote works, and they have most required skills.
- 65-84: good fit with one real gap (a missing core skill, a seniority stretch of a level, or a location question).
- 40-64: partial fit: adjacent role, a clear seniority mismatch, or several missing core skills.
- 0-39: wrong function (for example sales or legal for an engineer), far off seniority (an intern applying to staff level), or a location the candidate cannot work from.

First fill in these fields:
- roleFit: the kind of work only. Ignore seniority and location here; they are separate fields. "same" when the job does the work of the candidate's wanted roles at any level: any software engineering internship for someone who wants software engineering internships, a backend, infrastructure or platform engineer role for someone who wants backend or platform roles. "adjacent" for related but different work (a general software role for an ML engineer, data engineering for a backend engineer). "different" for another function (sales, marketing, legal, operations, or people management for an individual contributor).
- requiredYears: the minimum years of experience the posting asks for, as a number ("5+ years" is 5, "2-8 years" is 2). Use 0 for internships and new-grad roles, and null if the posting states no number.
- locationRule: the posting's own sentence that restricts where the person must live or be authorized to work, copied exactly (for example "Must be authorized to work in the United States."). null if the posting has no such sentence.
- locationFit: "works" if the candidate can do the job from where they live or by moving within their own country (a candidate in Pune, India for an office in Hyderabad, India), or the role is remote and open to their country. "relocate" if they would have to move to another country and the posting does not forbid it. "blocked" only if the posting states a location, residency or work-authorization rule the candidate does not meet (for example "must be authorized to work in the US", "must be based in Gurugram", "not eligible in the San Francisco area").

Rules:
- Judge from the posting and the profile only; do not invent requirements or experience.
- matchedSkills: skills the posting asks for that the candidate shows. missingSkills: skills the posting requires that the candidate does not show. Use short skill names.
- reason: two or three plain sentences in English a candidate can act on, naming the deciding factors.`;

export function matchPrompt(p: MatchProfile, j: MatchJob) {
  const profile = [
    p.headline && `Headline: ${p.headline}`,
    p.targetRoles.length && `Wants: ${p.targetRoles.join(", ")}`,
    p.yearsExperience != null && `Years of experience: ${p.yearsExperience}`,
    p.location && `Location: ${p.location}`,
    p.skills.length && `Skills: ${p.skills.join(", ")}`,
    p.resumeText && `Resume:\n${p.resumeText.slice(0, 6000)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const job = `${j.title} at ${j.company}${j.location ? `\nLocation: ${j.location}` : ""}\n\n${j.description.slice(0, 6000)}`;
  return `<candidate>\n${profile}\n</candidate>\n\n<job>\n${job}\n</job>`;
}

function decideLocation(m: Match, p: MatchProfile, j: MatchJob): Match["locationFit"] {
  const blocked = ruleBlocks(m.locationRule, p.location, j.description);
  if (blocked !== null) return blocked ? "blocked" : "works";
  // No rule the posting actually states, so "blocked" has no basis (the 7B model invents
  // "Must be based in <job city>" quotes). Judge the move from the job's own location instead.
  const home = sameCountry(p.location, j.location);
  if (home !== null) return home ? "works" : "relocate";
  return m.locationFit === "blocked" ? "relocate" : m.locationFit;
}

// Code decides what the model is unreliable at: the quoted location rule, tag hygiene, and the caps.
export function finalize(m: Match, p: MatchProfile, j: MatchJob): Match {
  const locationFit = decideLocation(m, p, j);
  const skills = splitSkills(m.matchedSkills, m.missingSkills, p);
  return applyCaps(
    { ...m, locationFit, reason: cleanReason(m.reason), matchedSkills: skills.matched, missingSkills: skills.missing },
    p.yearsExperience,
  );
}

export async function scoreMatch(p: MatchProfile, j: MatchJob): Promise<Match> {
  return finalize(await generateJson(matchSchema, SYSTEM, matchPrompt(p, j)), p, j);
}

// Text used to find candidate jobs by embedding similarity before the LLM scores them.
export function profileQuery(p: MatchProfile) {
  return [
    p.headline,
    p.targetRoles.length && `Looking for: ${p.targetRoles.join(", ")}`,
    p.skills.length && `Skills: ${p.skills.join(", ")}`,
    p.location && `Location: ${p.location}`,
    p.resumeText?.slice(0, 1500),
  ]
    .filter(Boolean)
    .join("\n");
}
