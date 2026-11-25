import { z } from "zod";

export type Source = "greenhouse" | "lever" | "ashby";
export type Company = { source: Source; board: string; name: string };

export type BoardJob = {
  source: Source;
  board: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// shortcut: regex tag-stripping, fine for ATS markup; swap for a real parser if layouts start breaking.
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<(br|\/p|\/div|\/h\d|\/ul|\/ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const toDate = (v: string | number | null | undefined) => {
  if (v == null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const greenhouseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      absolute_url: z.string(),
      content: z.string().default(""),
      location: z.object({ name: z.string() }).nullish(),
      first_published: z.string().nullish(),
      updated_at: z.string().nullish(),
    }),
  ),
});

const leverSchema = z.array(
  z.object({
    id: z.string(),
    text: z.string(),
    hostedUrl: z.string(),
    createdAt: z.number().nullish(),
    descriptionPlain: z.string().default(""),
    additionalPlain: z.string().default(""),
    lists: z.array(z.object({ text: z.string(), content: z.string() })).default([]),
    categories: z.object({ location: z.string().nullish() }).default({}),
  }),
);

const ashbySchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      jobUrl: z.string(),
      location: z.string().nullish(),
      isRemote: z.boolean().nullish(),
      isListed: z.boolean().default(true),
      publishedAt: z.string().nullish(),
      descriptionPlain: z.string().default(""),
    }),
  ),
});

// Each parser validates the raw response at the trust boundary and normalizes to BoardJob.
export const parsers: Record<Source, (c: Company, raw: unknown) => BoardJob[]> = {
  greenhouse: (c, raw) =>
    greenhouseSchema.parse(raw).jobs.map((j) => ({
      source: "greenhouse",
      board: c.board,
      externalId: String(j.id),
      company: c.name,
      title: j.title,
      location: j.location?.name ?? null,
      url: j.absolute_url,
      // Greenhouse escapes its HTML, so decode once to get markup, then strip it.
      description: htmlToText(decodeEntities(j.content)),
      postedAt: toDate(j.first_published ?? j.updated_at),
    })),

  lever: (c, raw) =>
    leverSchema.parse(raw).map((j) => ({
      source: "lever",
      board: c.board,
      externalId: j.id,
      company: c.name,
      title: j.text,
      location: j.categories.location ?? null,
      url: j.hostedUrl,
      description: [
        j.descriptionPlain,
        ...j.lists.map((l) => `${l.text}\n${htmlToText(l.content)}`),
        j.additionalPlain,
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim(),
      postedAt: toDate(j.createdAt),
    })),

  ashby: (c, raw) =>
    ashbySchema
      .parse(raw)
      .jobs.filter((j) => j.isListed)
      .map((j) => ({
        source: "ashby",
        board: c.board,
        externalId: j.id,
        company: c.name,
        title: j.title,
        location: j.isRemote && !j.location?.toLowerCase().includes("remote") ? `${j.location ?? ""} (Remote)`.trim() : (j.location ?? null),
        url: j.jobUrl,
        description: j.descriptionPlain.trim(),
        postedAt: toDate(j.publishedAt),
      })),
};

const urls: Record<Source, (board: string) => string> = {
  greenhouse: (b) => `https://boards-api.greenhouse.io/v1/boards/${b}/jobs?content=true`,
  lever: (b) => `https://api.lever.co/v0/postings/${b}?mode=json`,
  ashby: (b) => `https://api.ashbyhq.com/posting-api/job-board/${b}`,
};

export async function fetchBoard(c: Company): Promise<BoardJob[]> {
  const res = await fetch(urls[c.source](encodeURIComponent(c.board)), { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${c.source}/${c.board}: HTTP ${res.status}`);
  return parsers[c.source](c, await res.json());
}
