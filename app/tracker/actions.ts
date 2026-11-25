"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { applications, jobs } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { parseStatus } from "@/lib/tracker";

const jobIdSchema = z.uuid();

export async function trackJob(jobId: string) {
  const user = await requireUser();
  const id = jobIdSchema.parse(jobId);
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id));
  if (!job) throw new Error("No such job");
  await db.insert(applications).values({ userId: user.id, jobId: id }).onConflictDoNothing();
  refresh();
}

export async function moveApplication(jobId: string, status: string) {
  const user = await requireUser();
  const next = parseStatus(status);
  if (!next) throw new Error("Unknown status");
  // Scoped to the signed-in user, so one user can never move another's card.
  await db
    .update(applications)
    .set({ status: next })
    .where(and(eq(applications.userId, user.id), eq(applications.jobId, jobIdSchema.parse(jobId))));
  refresh();
}

export async function untrackJob(jobId: string) {
  const user = await requireUser();
  await db.delete(applications).where(and(eq(applications.userId, user.id), eq(applications.jobId, jobIdSchema.parse(jobId))));
  refresh();
}
