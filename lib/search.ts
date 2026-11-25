import { and, cosineDistance, desc, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs, matches } from "@/db/schema";
import { embed } from "./embed";
import { relevant, MAX_DISTANCE } from "./relevance";
import { rrf } from "./rrf";

const CANDIDATES = 100;

const open = isNull(jobs.closedAt);
const columns = { id: jobs.id, board: jobs.board, company: jobs.company, title: jobs.title, location: jobs.location, url: jobs.url, postedAt: jobs.postedAt };
// Same expression as jobs_fts_idx, so Postgres can use the index.
const doc = sql`to_tsvector('english', ${jobs.title} || ' ' || ${jobs.description})`;

async function ids(where: SQL | undefined, ...orderBy: SQL[]) {
  const rows = await db.select({ id: jobs.id }).from(jobs).where(where).orderBy(...orderBy).limit(CANDIDATES);
  return rows.map((r) => r.id);
}

export type SearchMode = "recent" | "hybrid" | "keyword" | "fit";

export type Fit = { vector: number[]; userId: string };

// Best evidence first: jobs the model scored 40+ (by score), then unscored jobs by closeness to the
// profile, then jobs the model already judged poor. Embedding closeness alone put a US-only
// internship scored 30 at the top for a candidate in India.
function fitOrder(fit: Fit) {
  const score = sql`(select ${matches.score} from ${matches} where ${matches.userId} = ${fit.userId} and ${matches.jobId} = ${jobs.id})`;
  return [
    sql`case when ${score} >= 40 then 0 when ${score} is null then 1 else 2 end`,
    sql`${score} desc nulls last`,
    cosineDistance(jobs.embedding, fit.vector),
  ];
}

// `fit`: the user's profile vector and scores. With no query it orders every open job by fit;
// with a query it joins keyword and semantic results as a third ranked list.
export async function searchJobs(q: string, page: number, pageSize: number, fit?: Fit | null) {
  if (!q && fit) {
    const where = and(open, isNotNull(jobs.embedding));
    const [rows, [{ total }]] = await Promise.all([
      db.select(columns).from(jobs).where(where).orderBy(...fitOrder(fit)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: sql<number>`count(*)::int` }).from(jobs).where(where),
    ]);
    return { rows, total, more: false, mode: "fit" as SearchMode, fit: true };
  }
  if (!q) {
    const [rows, [{ total }]] = await Promise.all([
      db.select(columns).from(jobs).where(open).orderBy(desc(jobs.postedAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: sql<number>`count(*)::int` }).from(jobs).where(open),
    ]);
    return { rows, total, more: false, mode: "recent" as SearchMode, fit: false };
  }

  const query = sql`websearch_to_tsquery('english', ${q})`;
  const keyword = ids(and(open, sql`${doc} @@ ${query}`), desc(sql`ts_rank(${doc}, ${query})`));
  // Search still works without Ollama, just keyword-only.
  const semantic = embed([q], "search_query", 5_000).then(
    async ([v]) => {
      const distance = cosineDistance(jobs.embedding, v);
      const hits = await db
        .select({ id: jobs.id, distance: sql<number>`${distance}` })
        .from(jobs)
        .where(and(open, isNotNull(jobs.embedding), sql`${distance} < ${MAX_DISTANCE}`))
        .orderBy(distance)
        .limit(CANDIDATES);
      return relevant(hits.map((h) => ({ id: h.id, distance: Number(h.distance) }))).map((h) => h.id);
    },
    () => null,
  );
  const [kw, sem] = await Promise.all([keyword, semantic]);

  const lists = sem ? [kw, sem] : [kw];
  if (fit) {
    // Re-rank this query's candidates by closeness to the profile (jobs without an embedding sort last).
    const candidates = [...new Set(lists.flat())];
    if (candidates.length) lists.push(await ids(inArray(jobs.id, candidates), ...fitOrder(fit)));
  }
  const ranked = lists.length > 1 ? rrf(lists) : kw;
  const pageIds = ranked.slice((page - 1) * pageSize, page * pageSize);
  const found = pageIds.length ? await db.select(columns).from(jobs).where(inArray(jobs.id, pageIds)) : [];
  const byId = new Map(found.map((r) => [r.id, r]));
  return {
    rows: pageIds.map((id) => byId.get(id)!).filter(Boolean),
    total: ranked.length,
    // The keyword list stops at CANDIDATES, so more jobs may match than we ranked.
    more: kw.length === CANDIDATES,
    mode: (sem ? "hybrid" : "keyword") as SearchMode,
    fit: Boolean(fit),
  };
}
