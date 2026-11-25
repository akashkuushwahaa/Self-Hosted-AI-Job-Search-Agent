import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications, matches } from "@/db/schema";

// Which of these jobs the user already tracks, for the Track buttons on job lists.
export async function trackedJobIds(userId: string, jobIds: string[]) {
  if (!jobIds.length) return new Set<string>();
  const rows = await db
    .select({ jobId: applications.jobId })
    .from(applications)
    .where(and(eq(applications.userId, userId), inArray(applications.jobId, jobIds)));
  return new Set(rows.map((r) => r.jobId));
}

// The user's match scores for these jobs, for score badges on job lists.
export async function matchScores(userId: string, jobIds: string[]) {
  if (!jobIds.length) return new Map<string, number>();
  const rows = await db
    .select({ jobId: matches.jobId, score: matches.score })
    .from(matches)
    .where(and(eq(matches.userId, userId), inArray(matches.jobId, jobIds)));
  return new Map(rows.map((r) => [r.jobId, r.score]));
}
