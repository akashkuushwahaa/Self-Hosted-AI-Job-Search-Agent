import { and, eq, isNull } from "drizzle-orm";
import { client, db } from "../db";
import { jobs } from "../db/schema";
import { embed, jobDocument } from "../lib/embed";

const BATCH = 32;
let done = 0;
const started = Date.now();

for (;;) {
  const batch = await db
    .select({ id: jobs.id, title: jobs.title, company: jobs.company, location: jobs.location, description: jobs.description })
    .from(jobs)
    .where(and(isNull(jobs.embedding), isNull(jobs.closedAt)))
    .limit(BATCH);
  if (!batch.length) break;

  const vectors = await embed(batch.map(jobDocument), "search_document");
  await db.transaction(async (tx) => {
    for (const [i, j] of batch.entries()) await tx.update(jobs).set({ embedding: vectors[i] }).where(eq(jobs.id, j.id));
  });
  done += batch.length;
  if (done % 640 === 0) console.log(`${done} embedded`);
}

console.log(`done: ${done} jobs in ${((Date.now() - started) / 1000).toFixed(0)}s`);
await client.end();
