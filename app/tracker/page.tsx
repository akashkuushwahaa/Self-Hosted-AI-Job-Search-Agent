import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { applications, jobs } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { linkClass, Muted, PageHeader } from "../ui";
import { Board } from "./board";

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
  const cards = await db
    .select({
      jobId: applications.jobId,
      status: applications.status,
      title: jobs.title,
      company: jobs.company,
      board: jobs.board,
      location: jobs.location,
      url: jobs.url,
      closed: jobs.closedAt,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.userId, user.id))
    .orderBy(asc(applications.createdAt));

  if (!cards.length) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
        Nothing tracked yet. Use <strong className="text-foreground">Track</strong> on a job in{" "}
        <Link href="/jobs" className={linkClass}>Jobs</Link> or <Link href="/matches" className={linkClass}>For you</Link>.
      </p>
    );
  }
  return <Board cards={cards.map(({ closed, ...c }) => ({ ...c, closed: closed != null }))} />;
}
