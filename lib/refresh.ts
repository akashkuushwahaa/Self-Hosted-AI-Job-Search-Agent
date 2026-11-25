import { isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { embedPending } from "./embed-jobs";
import { ingestAll } from "./ingest";
import { getBoss, SCORE_QUEUE } from "./queue";

// The daily agent run: pull every board, embed what's new or changed, then queue a scoring run for
// each user with a profile. Scoring reuses the per-user score queue, so it shows live progress on
// /matches like a button press, never runs twice for one user, and only scores jobs that are new
// among that user's top candidates.
export async function refreshJobs(log: (line: string) => void = console.log) {
  const ingest = await ingestAll(log);
  log(`ingest: ${ingest.boards - ingest.failed}/${ingest.boards} boards, ${ingest.added} new jobs`);
  const embedded = await embedPending(log);
  log(`embedded ${embedded} jobs`);

  const users = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(or(sql`cardinality(${profiles.skills}) > 0`, isNotNull(profiles.resumeText)));
  const boss = await getBoss();
  for (const { userId } of users) await boss.send(SCORE_QUEUE, { userId }, { singletonKey: userId });
  log(`queued scoring for ${users.length} users`);
  return { ...ingest, embedded, users: users.length };
}
