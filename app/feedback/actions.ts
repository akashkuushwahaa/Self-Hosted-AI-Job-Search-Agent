"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobFeedback, jobs, matches } from "@/db/schema";
import { DEMO } from "@/lib/demo";
import { requireUser } from "@/lib/session";

export type FeedbackResult = { error?: string };
const NOT_IN_DEMO = "Hiding and rating jobs work on your own install.";
const jobIdSchema = z.uuid();

async function upsert(userId: string, jobId: string, set: Partial<typeof jobFeedback.$inferInsert>) {
  await db
    .insert(jobFeedback)
    .values({ userId, jobId, ...set })
    .onConflictDoUpdate({ target: [jobFeedback.userId, jobFeedback.jobId], set });
}

async function checked(jobId: string) {
  if (DEMO) return { error: NOT_IN_DEMO } as const;
  const user = await requireUser();
  const id = jobIdSchema.safeParse(jobId);
  if (!id.success) return { error: "That job isn't valid." } as const;
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id.data));
  if (!job) return { error: "This job no longer exists." } as const;
  return { userId: user.id, jobId: id.data };
}

// "Not interested": the job leaves /jobs and /matches (and scoring skips it) for this user only.
// No refresh() here: the row stays on screen as "Hidden · Undo" until the next navigation.
export async function setHidden(jobId: string, hidden: boolean): Promise<FeedbackResult> {
  const c = await checked(jobId);
  if ("error" in c) return c;
  await upsert(c.userId, c.jobId, { hidden });
  return {};
}

// Thumbs up (1) or down (-1) on the model's score, or 0 to clear. Keeps the score as it was, since
// scores are deleted when the profile changes.
export async function rateMatch(jobId: string, rating: number): Promise<FeedbackResult> {
  if (![1, -1, 0].includes(rating)) return { error: "That rating isn't valid." };
  const c = await checked(jobId);
  if ("error" in c) return c;
  const [match] = await db.select({ score: matches.score }).from(matches).where(and(eq(matches.userId, c.userId), eq(matches.jobId, c.jobId)));
  if (!match) return { error: "There's no score to rate yet." };
  await upsert(c.userId, c.jobId, rating ? { rating, ratedScore: match.score } : { rating: null, ratedScore: null });
  return {};
}
