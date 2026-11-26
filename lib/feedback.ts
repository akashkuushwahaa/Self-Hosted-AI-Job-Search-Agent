import { and, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobFeedback, jobs } from "@/db/schema";
import { DEMO } from "./demo";

// Leaves out jobs this user marked "Not interested". The demo snapshot predates the table, and its
// visitors can't hide jobs, so there it's no condition at all.
export function notHiddenFor(userId: string | null | undefined): SQL | undefined {
  if (DEMO || !userId) return undefined;
  return sql`not exists (select 1 from ${jobFeedback} where ${jobFeedback.userId} = ${userId} and ${jobFeedback.jobId} = ${jobs.id} and ${jobFeedback.hidden})`;
}

// This user's ratings for these jobs (1 up, -1 down), for the thumbs on score badges.
export async function ratingsFor(userId: string, jobIds: string[]) {
  if (DEMO || !jobIds.length) return new Map<string, number>();
  const rows = await db
    .select({ jobId: jobFeedback.jobId, rating: jobFeedback.rating })
    .from(jobFeedback)
    .where(and(eq(jobFeedback.userId, userId), inArray(jobFeedback.jobId, jobIds), isNotNull(jobFeedback.rating)));
  return new Map(rows.map((r) => [r.jobId, r.rating!]));
}
