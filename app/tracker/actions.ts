"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { applications, jobs } from "@/db/schema";
import { trackedJobIds } from "@/lib/applications";
import { DEMO } from "@/lib/demo";
import { COOKIE, parseOverlay, withChange } from "@/lib/demo-tracker";
import { requireUser } from "@/lib/session";
import { parseStatus, type Status } from "@/lib/tracker";

// Expected failures come back as { error } for the UI to show; only real faults throw.
export type TrackerResult = { error?: string };

const jobIdSchema = z.uuid();

// Demo: this visitor's change goes in their own cookie, never the shared snapshot (lib/demo-tracker.ts).
async function demoChange(jobId: string, status: Status | null) {
  const store = await cookies();
  const overlay = withChange(parseOverlay(store.get(COOKIE)?.value), jobId, status);
  store.set(COOKIE, JSON.stringify(overlay), { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
}

// `status` lets Undo put a removed card back where it was.
export async function trackJob(jobId: string, status: string = "saved"): Promise<TrackerResult> {
  const user = await requireUser();
  const id = jobIdSchema.safeParse(jobId);
  const next = parseStatus(status);
  if (!id.success || !next) return { error: "That job or status isn't valid." };
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id.data));
  if (!job) return { error: "This job no longer exists." };
  if (DEMO) {
    if (!(await trackedJobIds(user.id, [id.data])).size) await demoChange(id.data, next);
  } else {
    await db.insert(applications).values({ userId: user.id, jobId: id.data, status: next }).onConflictDoNothing();
  }
  refresh();
  return {};
}

export async function moveApplication(jobId: string, status: string): Promise<TrackerResult> {
  const user = await requireUser();
  const id = jobIdSchema.safeParse(jobId);
  const next = parseStatus(status);
  if (!id.success || !next) return { error: "That job or status isn't valid." };
  if (DEMO) {
    if (!(await trackedJobIds(user.id, [id.data])).size) return { error: "That job isn't on your board any more." };
    await demoChange(id.data, next);
  } else {
    // Scoped to the signed-in user, so one user can never move another's card.
    const moved = await db
      .update(applications)
      .set({ status: next })
      .where(and(eq(applications.userId, user.id), eq(applications.jobId, id.data)))
      .returning({ jobId: applications.jobId });
    if (!moved.length) return { error: "That job isn't on your board any more." };
  }
  refresh();
  return {};
}

export async function untrackJob(jobId: string): Promise<TrackerResult> {
  const user = await requireUser();
  const id = jobIdSchema.safeParse(jobId);
  if (!id.success) return { error: "That job isn't valid." };
  if (DEMO) await demoChange(id.data, null);
  else await db.delete(applications).where(and(eq(applications.userId, user.id), eq(applications.jobId, id.data)));
  refresh();
  return {};
}
