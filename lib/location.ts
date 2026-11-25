// Decides a posting's stated location rule in code. The model only quotes the rule; a 7B model
// judged "must be authorized to work in the US" as merely "relocate" for a candidate in India.

// Countries by code; short uppercase codes are matched case-sensitively so "us" in "join us" doesn't count.
export const COUNTRIES: Record<string, { names: string[]; codes?: string[] }> = {
  US: { names: ["united states", "america"], codes: ["US", "USA", "U.S."] },
  IN: { names: ["india"] },
  GB: { names: ["united kingdom", "england"], codes: ["UK"] },
  DE: { names: ["germany"] },
  IE: { names: ["ireland"] },
  NL: { names: ["netherlands"] },
  CA: { names: ["canada"] },
  SG: { names: ["singapore"] },
  JP: { names: ["japan"] },
  RS: { names: ["serbia"] },
  DK: { names: ["denmark"] },
  PT: { names: ["portugal"] },
  MX: { names: ["mexico"] },
  PL: { names: ["poland"] },
  AU: { names: ["australia"] },
};

// Cities and regions that appear in the boards and in profiles, mapped to their country.
export const CITIES: Record<string, string> = {
  "san francisco": "US", "new york": "US", nyc: "US", seattle: "US", austin: "US", boston: "US", chicago: "US",
  "los angeles": "US", denver: "US", miami: "US", "washington dc": "US", "bay area": "US", "palo alto": "US",
  bengaluru: "IN", bangalore: "IN", gurugram: "IN", gurgaon: "IN", ahmedabad: "IN", pune: "IN", hyderabad: "IN",
  mumbai: "IN", delhi: "IN", noida: "IN", chennai: "IN", karnataka: "IN", maharashtra: "IN", "tamil nadu": "IN", telangana: "IN",
  london: "GB", berlin: "DE", munich: "DE", dublin: "IE", cork: "IE", amsterdam: "NL", toronto: "CA", vancouver: "CA",
  tokyo: "JP", belgrade: "RS", aarhus: "DK", lisbon: "PT", sydney: "AU", warsaw: "PL",
};

const word = (name: string, flags: string) => new RegExp(`(?<![\\w.])${name.replace(/[.]/g, "\\.")}(?![\\w])`, flags);

function places(text: string) {
  const countries = new Set<string>();
  const cities = new Set<string>();
  for (const [code, { names, codes = [] }] of Object.entries(COUNTRIES)) {
    if (names.some((n) => word(n, "i").test(text)) || codes.some((c) => word(c, "").test(text))) countries.add(code);
  }
  for (const [city, code] of Object.entries(CITIES)) {
    if (word(city, "i").test(text)) {
      cities.add(city);
      countries.add(code);
    }
  }
  return { countries, cities };
}

const NEGATED = /not eligible|excluding|except|outside of|cannot be (hired|based)/i;
// Wording that makes a sentence a rule about where someone must live or be allowed to work.
const RULE_HINT = /authori[sz]ed to work|work authori[sz]ation|based in|eligib|reside|must live|located in|on-?site|in-office/i;

const overlaps = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x));

// The model's quote is only a pointer: it often paraphrases ("Must be based in Gurugram" for "We are
// looking to speak to candidates who are based in Gurugram") and sometimes invents a rule from the job's
// city. Accept it only if the posting has a rule sentence naming the same place, and use that sentence.
export function findRuleSentence(quote: string, description: string): string | null {
  const wanted = places(quote);
  if (!wanted.countries.size) return null;
  for (const sentence of description.split(/[.\n•]+/)) {
    if (!RULE_HINT.test(sentence)) continue;
    const found = places(sentence);
    if (overlaps(found.cities, wanted.cities) || overlaps(found.countries, wanted.countries)) return sentence.trim();
  }
  return null;
}

// true: the candidate can't meet the rule. false: they can. null: no rule the posting states, or not enough to decide.
export function ruleBlocks(quote: string | null, candidateLocation: string | null, description: string): boolean | null {
  if (!quote || !candidateLocation) return null;
  const rule = findRuleSentence(quote, description);
  if (!rule) return null;
  const candidate = places(candidateLocation);
  const required = places(rule);
  if (!candidate.countries.size) return null;
  if (NEGATED.test(rule)) return overlaps(candidate.cities, required.cities);
  return !overlaps(candidate.countries, required.countries);
}

// true/false when both places resolve to a known country, else null.
export function sameCountry(a: string | null, b: string | null): boolean | null {
  if (!a || !b) return null;
  const x = places(a).countries;
  const y = places(b).countries;
  if (!x.size || !y.size) return null;
  return [...x].some((c) => y.has(c));
}
