import { z } from "zod";
import { generateJson } from "./llm";
import type { Page } from "./research";

// A brief is reused for a week, then can be refreshed.
const FRESH_FOR_MS = 7 * 24 * 60 * 60 * 1000;
export const isFresh = (researchedAt: Date | undefined) => !!researchedAt && Date.now() - researchedAt.getTime() < FRESH_FOR_MS;

export const dossierSchema = z.object({
  summary: z.string().max(700),
  products: z.array(z.string()).max(6),
  techStack: z.array(z.string()).max(15),
  culture: z.array(z.string()).max(6),
  talkingPoints: z.array(z.string()).max(5),
});
export type Dossier = z.infer<typeof dossierSchema>;

const SYSTEM = `You write a short company brief for a job seeker, from the company's own web pages below.

Use only facts stated in the pages. When the pages don't say, leave that list empty rather than guessing.
- summary: two or three sentences on what the company does and for whom.
- products: main products, by name.
- techStack: technologies the pages name: languages, frameworks, databases, infrastructure.
- culture: stated values or ways of working, as short phrases.
- talkingPoints: up to five specific facts from the pages a candidate could bring up in an interview.`;

export async function writeDossier(company: string, pages: Page[]): Promise<Dossier> {
  const body = pages.map((p) => `<page url="${p.url}">\n${p.text}\n</page>`).join("\n\n");
  return groundDossier(await generateJson(dossierSchema, SYSTEM, `Company: ${company}\n\n${body}`), pages);
}

// A 7B model lists technology it knows about the company even when told to use only the pages
// (PostHog: 8 of 8 tech items were on none of the 4 pages). Names can be checked against the
// text, so keep only those the pages actually contain. Culture and talking points are paraphrases.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentioned = (name: string, text: string) => new RegExp(`(?<!\\w)${escape(name.trim())}(?!\\w)`, "i").test(text);

export function groundDossier(d: Dossier, pages: Page[]): Dossier {
  const text = pages.map((p) => p.text).join("\n");
  return {
    ...d,
    products: d.products.filter((n) => mentioned(n, text)),
    techStack: d.techStack.filter((n) => mentioned(n, text)),
  };
}
