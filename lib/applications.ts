import { and, asc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { applications, matches } from "@/db/schema";
import { DEMO } from "./demo";
import { applyOverlay, COOKIE, parseOverlay } from "./demo-tracker";

// The user's tracked jobs and statuses, oldest first. In the demo, the snapshot's board with this
// visitor's own changes (from their cookie) applied.
export async function userApplications(userId: string) {
  const rows = await db
    .select({ jobId: applications.jobId, status: applications.status })
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(asc(applications.createdAt));
  if (!DEMO) return rows;
  return applyOverlay(rows, parseOverlay((await cookies()).get(COOKIE)?.value));
}

// Which of these jobs the user already tracks, for the Track buttons on job lists.
export async function trackedJobIds(userId: string, jobIds: string[]) {
  if (!jobIds.length) return new Set<string>();
  if (DEMO) {
    const wanted = new Set(jobIds);
    return new Set((await userApplications(userId)).map((a) => a.jobId).filter((id) => wanted.has(id)));
  }
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
