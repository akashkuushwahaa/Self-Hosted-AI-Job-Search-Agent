import { z } from "zod";
import { generateJson } from "./llm";
import { cleanTags, mentions } from "./skills";

export const extractedProfileSchema = z.object({
  headline: z.string().max(120),
  location: z.string().max(120),
  yearsExperience: z.number().int().min(0).max(60).nullable(),
  skills: z.array(z.string()).max(40),
  targetRoles: z.array(z.string()).max(5),
});
export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;

const SYSTEM = `You read a resume and fill in a job-search profile. Report only what the resume states.

- headline: a short professional headline (under 10 words) built from the resume's own summary or most recent title. "" if nothing fits.
- location: "City, Country" where the candidate lives, as written. "" if absent.
- yearsExperience: total years of work experience, internships included, as an integer. Sum the roles and round down, so under a year is 0. null only if no role has dates.
- skills: technical skills the resume names: languages, frameworks, databases, tools, platforms. Short names, no sentences, no soft skills.
- targetRoles: up to three job titles this candidate is a good fit for now, based on their experience and level (for a student: intern or new-grad titles).`;

export function extractProfile(resumeText: string): Promise<ExtractedProfile> {
  return generateJson(extractedProfileSchema, SYSTEM, resumeText.slice(0, 12_000));
}

type Current = {
  headline: string | null;
  location: string | null;
  yearsExperience: number | null;
  skills: string[];
  targetRoles: string[];
} | null;

// What an extraction may change: empty fields get filled, skills get added to, and nothing
// the user typed is overwritten. Skills must appear in the resume text (the model adds ones it expects).
export function mergeExtracted(current: Current, extracted: ExtractedProfile, resumeText: string) {
  const values: Partial<NonNullable<Current>> = {};
  const filled: string[] = [];
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K], label: string) => {
    values[key] = value;
    filled.push(label);
  };

  const headline = extracted.headline.trim();
  const location = extracted.location.trim();
  if (!current?.headline && headline) set("headline", headline, "headline");
  if (!current?.location && location) set("location", location, "location");
  if (current?.yearsExperience == null && extracted.yearsExperience != null)
    set("yearsExperience", extracted.yearsExperience, "years of experience");

  const have = current?.skills ?? [];
  const known = new Set(have.map((s) => s.toLowerCase()));
  const added = cleanTags(extracted.skills).filter((s) => mentions(resumeText, s) && !known.has(s.toLowerCase()));
  if (added.length) set("skills", [...have, ...added].slice(0, 100), `${added.length} skills`);

  // Titles skip the skill filter: "Support Engineer" is a real role.
  const roles = [...new Set(extracted.targetRoles.map((r) => r.trim()).filter(Boolean))].slice(0, 3);
  if (!current?.targetRoles.length && roles.length) set("targetRoles", roles, "target roles");
  return { values, filled };
}
