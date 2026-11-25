// Skill tags from the model sometimes list a posting's perks or traits as "missing skills"
// ("work-life harmony", "authentic culture"). These words never name a technical skill.
const NON_SKILL = /\b(culture|mentor\w*|harmony|community|networking|relocation|benefits?|perks?|support|values?|years?|experience|degree|mindset|judg(e)?ment|awareness|adaptab\w*|connection|passion|ownership|collaborat\w*|communication|curiosity|growth|career|impact\w*|balance|teamwork|leadership|player|enthusias\w*|problem[- ]solving|users? first|ideolog\w*|creativ\w*|fundamentals|thoughtful)\b/i;

export const isNonSkill = (tag: string) => NON_SKILL.test(tag);

// Keeps short technical tags, once each (the first spelling wins).
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.trim().toLowerCase();
    if (!key || seen.has(key) || isNonSkill(tag) || key.split(/\s+/).length > 4) return false;
    seen.add(key);
    return true;
  });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const mentions = (text: string, skill: string) => new RegExp(`(?<!\\w)${escape(skill.trim())}(?!\\w)`, "i").test(text);

// The model sometimes lists the candidate's own skills as missing (Python, TypeScript for a
// profile that names both). Whether a skill appears in the profile is a text check, so code does it.
export function splitSkills(
  matched: string[],
  missing: string[],
  candidate: { skills: string[]; resumeText: string | null },
): { matched: string[]; missing: string[] } {
  const known = [...candidate.skills, candidate.resumeText ?? ""].join("\n");
  const cleanMissing = cleanTags(missing);
  const has = cleanMissing.filter((s) => mentions(known, s));
  return {
    matched: cleanTags([...matched, ...has]),
    missing: cleanMissing.filter((s) => !has.includes(s)),
  };
}
