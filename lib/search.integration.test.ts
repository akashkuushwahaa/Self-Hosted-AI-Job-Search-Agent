import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { jobs, matches } from "@/db/schema";
import { addUser, axis, reset } from "@/test/db";
import { NO_FILTERS } from "./filters";
import { searchJobs } from "./search";

vi.mock("@/db", () => import("@/test/db"));
// Query embeddings by text; anything else fails like Ollama being down (keyword-only search).
const queryVectors: Record<string, number[]> = {};
vi.mock("./embed", () => ({
  embed: async ([text]: string[]) => {
    if (!queryVectors[text]) throw new Error("embedding service unavailable");
    return [queryVectors[text]];
  },
}));

let n = 0;
async function job(title: string, extra: Partial<typeof jobs.$inferInsert> = {}) {
  const [row] = await db
    .insert(jobs)
    .values({
      source: "greenhouse",
      board: "acme",
      externalId: String(++n),
      company: "Acme",
      title,
      location: "Bengaluru, India",
      url: `https://example.test/${n}`,
      description: `${title}. A role at Acme.`,
      postedAt: new Date(Date.UTC(2026, 10, n)),
      ...extra,
    })
    .returning({ id: jobs.id });
  return row.id;
}

const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

beforeEach(reset);

describe("searchJobs without a query", () => {
  it("lists open jobs newest first and leaves closed ones out", async () => {
    await job("Older role");
    await job("Newer role");
    await job("Closed role", { closedAt: new Date() });
    const r = await searchJobs("", 1, 10);
    expect(r.mode).toBe("recent");
    expect(titles(r.rows)).toEqual(["Newer role", "Older role"]);
    expect(r.total).toBe(2);
  });

  it("applies filters in SQL", async () => {
    await job("Software Engineer Intern");
    await job("Software Engineer Intern", { location: "Dublin, Ireland" });
    await job("Senior Software Engineer");
    await job("Internal Tools Engineer");
    const r = await searchJobs("", 1, 10, { filters: { ...NO_FILTERS, level: "intern", country: "IN" } });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ title: "Software Engineer Intern", location: "Bengaluru, India" });
  });
});

describe("searchJobs with a query", () => {
  it("falls back to keyword search when there's no embedding service", async () => {
    await job("Frontend Engineer");
    await job("Backend Engineer");
    const r = await searchJobs("frontend", 1, 10);
    expect(r.mode).toBe("keyword");
    expect(titles(r.rows)).toEqual(["Frontend Engineer"]);
  });

  it("keeps semantic hits near the query and drops far ones", async () => {
    queryVectors["design systems"] = axis(0);
    await job("Near", { embedding: axis(0, 0.1) }); // cosine distance ~0.005
    await job("Close enough", { embedding: axis(0, 0.4) }); // ~0.07, inside best + 0.08
    await job("Unrelated", { embedding: axis(1) }); // 1.0
    const r = await searchJobs("design systems", 1, 10);
    expect(r.mode).toBe("hybrid");
    expect(titles(r.rows)).toEqual(["Near", "Close enough"]);
    expect(r.total).toBe(2);
  });

  it("returns nothing when no job is near a query nothing matches by keyword", async () => {
    queryVectors["pastry chef"] = axis(10);
    await job("Engineer", { embedding: axis(0) });
    const r = await searchJobs("pastry chef", 1, 10);
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });
});

describe("searchJobs ordered by fit", () => {
  it("puts jobs scored 40+ first, then unscored by closeness, then jobs judged poor", async () => {
    const userId = await addUser("u1");
    const poor = await job("Scored 30", { embedding: axis(0) }); // closest, but the model judged it poor
    await job("Unscored far", { embedding: axis(0, 2) });
    await job("Unscored near", { embedding: axis(0, 0.5) });
    const good = await job("Scored 70", { embedding: axis(1) });
    const score = { reason: "", matchedSkills: [], missingSkills: [], model: "test", userId };
    await db.insert(matches).values([{ ...score, jobId: poor, score: 30 }, { ...score, jobId: good, score: 70 }]);

    const r = await searchJobs("", 1, 10, { fit: { vector: axis(0), userId } });
    expect(r.mode).toBe("fit");
    expect(titles(r.rows)).toEqual(["Scored 70", "Unscored near", "Unscored far", "Scored 30"]);
  });
});
