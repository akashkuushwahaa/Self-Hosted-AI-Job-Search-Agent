import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { fetchBoard, type Company } from "./boards";
import { companies } from "./companies";

const BATCH = 200;
const CONCURRENCY = 5;

// Upserts one board's open jobs and closes the ones it stopped listing.
async function ingestBoard(c: Company) {
  // Dedupe: Postgres rejects an upsert batch that hits the same key twice.
  const rows = [...new Map((await fetchBoard(c)).map((r) => [r.externalId, r])).values()];
  let added = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const upserted = await db
      .insert(jobs)
      .values(rows.slice(i, i + BATCH))
      .onConflictDoUpdate({
        target: [jobs.source, jobs.board, jobs.externalId],
        set: {
          company: sql`excluded.company`,
          title: sql`excluded.title`,
          location: sql`excluded.location`,
          url: sql`excluded.url`,
          description: sql`excluded.description`,
          postedAt: sql`excluded.posted_at`,
          fetchedAt: sql`now()`,
          closedAt: null,
          // Re-embed only when the text the embedding was built from (jobDocument) changed.
          embedding: sql`case when ${jobs.title} = excluded.title and ${jobs.description} = excluded.description
            and ${jobs.company} = excluded.company and ${jobs.location} is not distinct from excluded.location
            then ${jobs.embedding} end`,
        },
      })
      // xmax = 0 only on a freshly inserted row, so this counts new jobs without a second query.
      .returning({ inserted: sql<boolean>`xmax = 0` });
    added += upserted.filter((r) => r.inserted).length;
  }
  // Only reached when the fetch succeeded, so a board outage never closes its jobs.
  const live = rows.map((r) => r.externalId);
  const closed = await db
    .update(jobs)
    .set({ closedAt: sql`now()` })
    .where(
      and(
        eq(jobs.source, c.source),
        eq(jobs.board, c.board),
        isNull(jobs.closedAt),
        live.length ? notInArray(jobs.externalId, live) : undefined,
      ),
    )
    .returning({ id: jobs.id });
  return { open: rows.length, added, closed: closed.length };
}

// Pulls every curated board. One board failing (an outage, a changed API) never stops the rest.
export async function ingestAll(log: (line: string) => void = console.log) {
  let failed = 0;
  let added = 0;
  for (let i = 0; i < companies.length; i += CONCURRENCY) {
    const chunk = companies.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(ingestBoard));
    results.forEach((r, j) => {
      const c = chunk[j];
      if (r.status === "fulfilled") {
        added += r.value.added;
        log(`✓ ${c.name.padEnd(14)} ${r.value.open} open, ${r.value.added} new, ${r.value.closed} closed`);
      } else {
        failed++;
        log(`✗ ${c.name.padEnd(14)} ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      }
    });
  }
  return { boards: companies.length, failed, added };
}
