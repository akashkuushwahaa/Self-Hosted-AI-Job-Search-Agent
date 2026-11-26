import { z } from "zod";

export const SOURCES = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee"] as const;
export type Source = (typeof SOURCES)[number];
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

const smartRecruitersSchema = z.object({
  postings: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      postingUrl: z.string(),
      releasedDate: z.string().nullish(),
      location: z.object({ fullLocation: z.string().nullish(), remote: z.boolean().nullish() }).default({}),
      jobAd: z.object({
        sections: z.record(z.string(), z.object({ title: z.string().nullish(), text: z.string().nullish() }).nullish()).default({}),
      }),
    }),
  ),
});

const workableSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      shortcode: z.string(),
      shortlink: z.string(),
      description: z.string().default(""),
      city: z.string().nullish(),
      state: z.string().nullish(),
      country: z.string().nullish(),
      telecommuting: z.boolean().nullish(),
      published_on: z.string().nullish(),
    }),
  ),
});

const recruiteeSchema = z.object({
  offers: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      status: z.string(),
      careers_url: z.string(),
      description: z.string().default(""),
      requirements: z.string().default(""),
      location: z.string().nullish(),
      remote: z.boolean().nullish(),
      published_at: z.string().nullish(),
    }),
  ),
});

const withRemote = (location: string | null | undefined, remote: boolean | null | undefined) =>
  remote && !location?.toLowerCase().includes("remote") ? `${location ?? ""} (Remote)`.trim() : location || null;

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

  // Raw is { postings: [detail, …] }: the list endpoint has no descriptions, so fetchBoard gathers details.
  smartrecruiters: (c, raw) =>
    smartRecruitersSchema.parse(raw).postings.map((j) => {
      const { companyDescription, jobDescription, ...rest } = j.jobAd.sections;
      // The role first, the company blurb last: embeddings read the head of the description.
      const parts = [
        jobDescription?.text && htmlToText(jobDescription.text),
        ...Object.values(rest).map((s) => s?.text && `${s.title ? `${s.title}\n` : ""}${htmlToText(s.text)}`),
        companyDescription?.text && htmlToText(companyDescription.text),
      ];
      return {
        source: "smartrecruiters" as const,
        board: c.board,
        externalId: j.id,
        company: c.name,
        title: j.name,
        location: withRemote(j.location.fullLocation, j.location.remote),
        url: j.postingUrl,
        description: parts.filter(Boolean).join("\n\n").trim(),
        postedAt: toDate(j.releasedDate),
      };
    }),

  workable: (c, raw) =>
    workableSchema.parse(raw).jobs.map((j) => ({
      source: "workable",
      board: c.board,
      externalId: j.shortcode,
      company: c.name,
      title: j.title,
      location: withRemote([j.city, j.state, j.country].filter(Boolean).join(", "), j.telecommuting),
      url: j.shortlink,
      description: htmlToText(j.description),
      postedAt: toDate(j.published_on),
    })),

  recruitee: (c, raw) =>
    recruiteeSchema
      .parse(raw)
      .offers.filter((o) => o.status === "published")
      .map((o) => ({
        source: "recruitee",
        board: c.board,
        externalId: String(o.id),
        company: c.name,
        title: o.title,
        location: withRemote(o.location, o.remote),
        url: o.careers_url,
        description: [htmlToText(o.description), htmlToText(o.requirements)].filter(Boolean).join("\n\n"),
        // "2026-11-24 10:10:44 UTC" isn't a format Date reliably parses.
        postedAt: toDate(o.published_at?.replace(" UTC", "Z").replace(" ", "T")),
      })),
};

const urls: Record<Source, (board: string) => string> = {
  greenhouse: (b) => `https://boards-api.greenhouse.io/v1/boards/${b}/jobs?content=true`,
  lever: (b) => `https://api.lever.co/v0/postings/${b}?mode=json`,
  ashby: (b) => `https://api.ashbyhq.com/posting-api/job-board/${b}`,
  smartrecruiters: (b) => `https://api.smartrecruiters.com/v1/companies/${b}/postings`,
  workable: (b) => `https://apply.workable.com/api/v1/widget/accounts/${b}?details=true`,
  recruitee: (b) => `https://${b}.recruitee.com/api/offers/`,
};

async function getJson(url: string, label: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return res.json();
}

// SmartRecruiters lists postings in pages without descriptions; each posting's detail has them.
// Few requests at a time, to stay polite to a public API.
async function smartRecruiters(c: Company) {
  const base = urls.smartrecruiters(encodeURIComponent(c.board));
  const refs: { id: string }[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = z
      .object({ totalFound: z.number(), content: z.array(z.object({ id: z.string() })) })
      .parse(await getJson(`${base}?limit=100&offset=${offset}`, `smartrecruiters/${c.board}`));
    refs.push(...page.content);
    if (!page.content.length || refs.length >= page.totalFound) break;
  }
  const postings: unknown[] = [];
  for (let i = 0; i < refs.length; i += 5) {
    postings.push(...(await Promise.all(refs.slice(i, i + 5).map((r) => getJson(`${base}/${r.id}`, `smartrecruiters/${c.board}/${r.id}`)))));
  }
  return { postings };
}

export async function fetchBoard(c: Company): Promise<BoardJob[]> {
  const raw = c.source === "smartrecruiters" ? await smartRecruiters(c) : await getJson(urls[c.source](encodeURIComponent(c.board)), `${c.source}/${c.board}`);
  return parsers[c.source](c, raw);
}
