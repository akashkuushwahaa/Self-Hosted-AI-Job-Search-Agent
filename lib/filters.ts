// Search filters for /jobs and the MCP search tool. Nothing is stored per job: each filter is a
// pattern over the title or location, run in Postgres. The same word lists build a JS RegExp, so the
// patterns are unit-tested here and the SQL matches them exactly.
import { companyByBoard } from "./companies";
import { CITIES, COUNTRIES } from "./location";

export const LEVELS = {
  intern: "Internship",
  entry: "New grad / entry level",
  senior: "Senior and above",
} as const;
export type Level = keyof typeof LEVELS;

export const POSTED = { 1: "Past 24 hours", 7: "Past week", 30: "Past month" } as const;

export type Filters = { remote: boolean; country: string | null; company: string | null; postedDays: number | null; level: Level | null };
export const NO_FILTERS: Filters = { remote: false, country: null, company: null, postedDays: null, level: null };

type Words = readonly string[];

const LEVEL_WORDS: Record<Level, Words> = {
  intern: ["intern", "interns", "internship", "internships", "co-op", "apprentice", "apprenticeship"],
  entry: ["new grad", "new grads", "new graduate", "new graduates", "graduate", "entry level", "entry-level", "early career", "early-career", "junior", "jr"],
  senior: ["senior", "sr", "staff", "principal", "lead", "director", "head", "vp", "vice president", "distinguished", "chief"],
};

export const REMOTE_PATTERN: Words = ["remote", "anywhere", "work from home", "wfh"];

export const levelPattern = (level: Level) => LEVEL_WORDS[level];

// Names and cities match in any case; short codes ("US", "UK") only in capitals, as in lib/location.ts.
export function countryPattern(code: string): { names: Words; codes: Words | null } | null {
  const country = COUNTRIES[code];
  if (!country) return null;
  const cities = Object.entries(CITIES).filter(([, c]) => c === code).map(([city]) => city);
  return { names: [...country.names, ...cities], codes: country.codes?.length ? country.codes : null };
}

export const COUNTRY_OPTIONS = Object.entries(COUNTRIES)
  .map(([code, { names }]) => ({ code, label: names[0].replace(/\b\w/g, (c) => c.toUpperCase()) }))
  .sort((a, b) => a.label.localeCompare(b.label));

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
const alternation = (words: Words) => words.map(escape).join("|");

// Whole words only, with the boundary lib/location.ts uses: not after a letter, digit, _ or ".",
// not before a letter, digit or _. So "intern" skips "Internal" and "lead" skips "Leadership".
export const toPostgres = (words: Words) => `(^|[^[:alnum:]_.])(${alternation(words)})($|[^[:alnum:]_])`;
export const toRegExp = (words: Words, flags: string) => new RegExp(`(?:^|[^\\w.])(?:${alternation(words)})(?:$|[^\\w])`, flags);

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// URL params in, valid filters out. Anything unknown is dropped rather than failing the page.
export function parseFilters(params: Params): Filters {
  const country = one(params.country);
  const company = one(params.company);
  const posted = Number(one(params.posted));
  const level = one(params.level);
  return {
    remote: one(params.remote) === "1",
    country: country && COUNTRIES[country] ? country : null,
    company: company && companyByBoard(company) ? company : null,
    postedDays: posted in POSTED ? posted : null,
    level: level && level in LEVELS ? (level as Level) : null,
  };
}

export function filterParams(f: Filters): Record<string, string> {
  return {
    ...(f.remote && { remote: "1" }),
    ...(f.country && { country: f.country }),
    ...(f.company && { company: f.company }),
    ...(f.postedDays && { posted: String(f.postedDays) }),
    ...(f.level && { level: f.level }),
  };
}

export const hasFilters = (f: Filters) => Object.keys(filterParams(f)).length > 0;
