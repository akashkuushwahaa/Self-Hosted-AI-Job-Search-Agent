"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { getProfile } from "@/lib/candidates";
import { DEMO, DEMO_UNAVAILABLE } from "@/lib/demo";
import { getBoss, SCORE_QUEUE, TAILOR_QUEUE } from "@/lib/queue";
import { requireUser } from "@/lib/session";
import type { FormState } from "../../profile/actions";

export async function startScoringJob(jobId: string): Promise<FormState> {
  if (DEMO) return { error: DEMO_UNAVAILABLE };
  const user = await requireUser();
  if (!z.uuid().safeParse(jobId).success) return { error: "That job isn't valid." };
  const profile = await getProfile(user.id);
  if (!profile || (!profile.skills.length && !profile.resumeText)) return { error: "Add skills or a resume to your profile first." };
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId));
  if (!job) return { error: "This job no longer exists." };
  const boss = await getBoss();
  const id = await boss.send(SCORE_QUEUE, { userId: user.id, jobId }, { singletonKey: `${user.id}:${jobId}` });
  return { ok: id ? "Scoring started" : "Already scoring" };
}

// Queues a tailored summary, resume points and cover letter for this job (lib/tailor.ts).
export async function startTailoring(jobId: string): Promise<FormState> {
  if (DEMO) return { error: DEMO_UNAVAILABLE };
  const user = await requireUser();
  if (!z.uuid().safeParse(jobId).success) return { error: "That job isn't valid." };
  const profile = await getProfile(user.id);
  if (!profile?.resumeText) return { error: "Upload a resume on your profile first." };
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId));
  if (!job) return { error: "This job no longer exists." };
  const boss = await getBoss();
  const id = await boss.send(TAILOR_QUEUE, { userId: user.id, jobId }, { singletonKey: `${user.id}:${jobId}` });
  return { ok: id ? "Writing" : "Already writing" };
}
