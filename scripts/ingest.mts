import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { client, db } from "../db";
import { jobs } from "../db/schema";
import { fetchBoard, type Company } from "../lib/boards";
import { companies } from "../lib/companies";

const BATCH = 200;
const CONCURRENCY = 5;

async function ingest(c: Company) {
  // Dedupe: Postgres rejects an upsert batch that hits the same key twice.
  const rows = [...new Map((await fetchBoard(c)).map((r) => [r.externalId, r])).values()];
  for (let i = 0; i < rows.length; i += BATCH) {
    await db
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
          // Re-embed only when the text the embedding was built from changed.
          embedding: sql`case when ${jobs.title} = excluded.title and ${jobs.description} = excluded.description then ${jobs.embedding} end`,
        },
      });
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
  return { open: rows.length, closed: closed.length };
}

let failed = 0;
for (let i = 0; i < companies.length; i += CONCURRENCY) {
  const chunk = companies.slice(i, i + CONCURRENCY);
  const results = await Promise.allSettled(chunk.map(ingest));
  results.forEach((r, j) => {
    const c = chunk[j];
    if (r.status === "fulfilled") console.log(`✓ ${c.name.padEnd(14)} ${r.value.open} open, ${r.value.closed} closed`);
    else {
      failed++;
      console.error(`✗ ${c.name.padEnd(14)} ${r.reason instanceof Error ? r.reason.message : r.reason}`);
    }
  });
}
console.log(`done: ${companies.length - failed}/${companies.length} boards`);
await client.end();
