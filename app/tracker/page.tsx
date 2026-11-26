import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { detailsFor, userApplications } from "@/lib/applications";
import { DEMO } from "@/lib/demo";
import { localToday } from "@/lib/tracker";
import { requireUser } from "@/lib/session";
import { Muted, PageHeader } from "../ui";
import { Board } from "./board";

export const metadata: Metadata = { title: "Tracker" };

export default function TrackerPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <PageHeader title="Tracker" description="Drag cards between columns, or use the status menu." />
      <Suspense fallback={<Muted className="mt-6">Loading your applications…</Muted>}>
        <Applications />
      </Suspense>
    </main>
  );
}

async function Applications() {
  const user = await requireUser();
  const tracked = await userApplications(user.id);
  const found = tracked.length
    ? await db
        .select({ id: jobs.id, title: jobs.title, company: jobs.company, board: jobs.board, location: jobs.location, url: jobs.url, closed: jobs.closedAt })
        .from(jobs)
        .where(inArray(jobs.id, tracked.map((a) => a.jobId)))
    : [];
  const byId = new Map(found.map(({ id, closed, ...job }) => [id, { ...job, closed: closed != null }]));
  const details = await detailsFor(user.id, tracked.map((a) => a.jobId));
  const cards = tracked.flatMap((a) => {
    const job = byId.get(a.jobId);
    return job ? [{ jobId: a.jobId, status: a.status, ...job, details: details.get(a.jobId) ?? null }] : [];
  });

  // Board renders even when empty, so the Undo toast survives removing the last card.
  return <Board cards={cards} today={localToday()} editable={!DEMO} />;
}
