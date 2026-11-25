"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companyResearch } from "@/db/schema";
import { companyByBoard } from "@/lib/companies";
import { isFresh } from "@/lib/dossier";
import { DEMO, DEMO_UNAVAILABLE } from "@/lib/demo";
import { getBoss, RESEARCH_QUEUE } from "@/lib/queue";
import { requireUser } from "@/lib/session";
import type { FormState } from "../../profile/actions";

export async function startResearch(board: string): Promise<FormState> {
  if (DEMO) return { error: DEMO_UNAVAILABLE };
  const user = await requireUser();
  // Only boards from the curated list: research must never crawl a URL a user typed.
  if (!companyByBoard(board)) return { error: "Unknown company" };

  const [existing] = await db.select({ at: companyResearch.researchedAt }).from(companyResearch).where(eq(companyResearch.board, board));
  if (isFresh(existing?.at)) return { ok: "Already up to date" };

  const boss = await getBoss();
  const id = await boss.send(RESEARCH_QUEUE, { board, userId: user.id }, { singletonKey: board });
  return { ok: id ? "Research started" : "Already researching" };
}
