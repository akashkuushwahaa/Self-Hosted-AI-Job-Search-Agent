"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { matchesSeen } from "@/db/schema";
import { getProfile } from "@/lib/candidates";
import { DEMO, DEMO_UNAVAILABLE } from "@/lib/demo";
import { getBoss, SCORE_QUEUE } from "@/lib/queue";
import { requireUser } from "@/lib/session";
import type { FormState } from "../profile/actions";

export async function startScoring(): Promise<FormState> {
  if (DEMO) return { error: DEMO_UNAVAILABLE };
  const user = await requireUser();
  if (!(await getProfile(user.id))) return { error: "Fill in your profile first" };
  const boss = await getBoss();
  const id = await boss.send(SCORE_QUEUE, { userId: user.id }, { singletonKey: user.id });
  // null means this user already has a run queued or active; the queue policy rejected the duplicate.
  return { ok: id ? "Scoring started" : "Already scoring" };
}

// Called by the page once it's actually on screen (not on prefetch), and again as new scores land.
export async function markMatchesSeen() {
  if (DEMO) return; // the demo's scores never change, and its snapshot has no matches_seen table
  const user = await requireUser();
  await db
    .insert(matchesSeen)
    .values({ userId: user.id, seenAt: sql`now()` })
    .onConflictDoUpdate({ target: matchesSeen.userId, set: { seenAt: sql`now()` } });
}
