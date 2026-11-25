import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { embed, jobDocument } from "./embed";

const BATCH = 32;

// Embeds every open job without an embedding: new ones, and ones whose text changed at ingest.
export async function embedPending(log: (line: string) => void = console.log) {
  let done = 0;
  for (;;) {
    const batch = await db
      .select({ id: jobs.id, title: jobs.title, company: jobs.company, location: jobs.location, description: jobs.description })
      .from(jobs)
      .where(and(isNull(jobs.embedding), isNull(jobs.closedAt)))
      .limit(BATCH);
    if (!batch.length) return done;

    const vectors = await embed(batch.map(jobDocument), "search_document");
    await db.transaction(async (tx) => {
      for (const [i, j] of batch.entries()) await tx.update(jobs).set({ embedding: vectors[i] }).where(eq(jobs.id, j.id));
    });
    done += batch.length;
    if (done % 640 === 0) log(`${done} embedded`);
  }
}
