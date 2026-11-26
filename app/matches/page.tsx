import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { matchesSeen } from "@/db/schema";
import { trackedJobIds } from "@/lib/applications";
import { getProfile, topCandidates } from "@/lib/candidates";
import { ratingsFor } from "@/lib/feedback";
import { SCORE_QUEUE, type ScoreJob } from "@/lib/queue";
import { lastRun, timeAgo } from "@/lib/run-status";
import { DEMO } from "@/lib/demo";
import { requireUser } from "@/lib/session";
import { TrackButton } from "../track-button";
import { errorClass, linkClass, Muted, PageHeader, ScoreBadge, Tag } from "../ui";
import { HideableRow, RateScore } from "../feedback/controls";
import { MarkSeen } from "./mark-seen";
import { ScoreButton } from "./score-button";

export const metadata: Metadata = { title: "For you" };

export default function MatchesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Suspense
        fallback={
          <>
            <PageHeader title="For you" description="The open jobs closest to your profile, scored by a local model." />
            <Muted className="mt-6">Finding jobs close to your profile…</Muted>
          </>
        }
      >
        <Matches />
      </Suspense>
    </main>
  );
}

const header = (action?: React.ReactNode) => (
  <PageHeader title="For you" description="The open jobs closest to your profile, scored by a local model.">
    {action}
  </PageHeader>
);

async function Matches() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile || (!profile.skills.length && !profile.resumeText)) {
    return (
      <>
        {header()}
        <p className="mt-6">
          Add your skills or upload a resume on your <Link href="/profile" className={linkClass}>profile</Link> to get matches.
        </p>
      </>
    );
  }

  let jobs;
  try {
    jobs = await topCandidates(user.id, profile);
  } catch {
    return (
      <>
        {header()}
        <p className={`mt-6 ${errorClass}`} role="alert">The local model isn&apos;t running. Start Ollama and reload.</p>
      </>
    );
  }
  const unscored = jobs.filter((j) => j.score == null).length;
  const [tracked, [seen], ratings] = await Promise.all([
    trackedJobIds(user.id, jobs.map((j) => j.id)),
    DEMO ? [] : db.select({ at: matchesSeen.seenAt }).from(matchesSeen).where(eq(matchesSeen.userId, user.id)),
    ratingsFor(user.id, jobs.map((j) => j.id)),
  ]);
  // The last full scoring run (not single jobs scored from their page), which outlives a refresh.
  const run = await lastRun(SCORE_QUEUE, user.id, (data) => !(data as ScoreJob).jobId).catch(() => null);
  // Scored since the last visit (the daily run, or scoring that finished after the user left).
  // A first visit marks nothing new: every score would be.
  const isNew = (j: { scoredAt: Date | null }) => Boolean(seen && j.scoredAt && j.scoredAt > seen.at);
  const fresh = jobs.filter(isNew).length;
  const latest = jobs.reduce((max, j) => (j.scoredAt && j.scoredAt.getTime() > max ? j.scoredAt.getTime() : max), 0);

  return (
    <>
      {header(unscored > 0 && !DEMO ? <ScoreButton unscored={unscored} /> : undefined)}
      <Muted className="mt-6 tabular-nums">
        {jobs.length} jobs{unscored ? `, ${unscored} not scored yet` : ", all scored"}
        {fresh > 0 && <span className="text-accent">{` · ${fresh} new since your last visit`}</span>}
        {run?.state === "finished" && ` · last scored ${timeAgo(run.at)}`}
        {(run?.state === "queued" || run?.state === "running") && ` · a scoring run is ${run.state === "queued" ? "waiting for the worker" : "in progress"}`}
      </Muted>
      {run?.state === "failed" && (
        <p role="alert" className={`mt-2 ${errorClass}`}>
          The last scoring run failed {timeAgo(run.at)}{run.error ? `: ${run.error}` : ""}. Check that Ollama is running and both models are pulled.
        </p>
      )}
      {!DEMO && <MarkSeen latest={latest} />}

      <ul className="mt-2 divide-y divide-border border-y border-border">
        {jobs.map((j) => {
          const row = "flex gap-4 py-5";
          const content = (
          <>
            <div className="flex w-12 shrink-0 flex-col items-center gap-1.5">
              <ScoreBadge score={j.score} />
              {!DEMO && j.score != null && <RateScore jobId={j.id} rating={ratings.get(j.id) ?? null} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
                  {isNew(j) && <span className="ml-2 align-middle"><Tag tone="good">New</Tag></span>}
                  <p className="mt-0.5 text-sm text-muted">
                    <Link href={`/company/${j.board}`} className="text-foreground/80 hover:underline">{j.company}</Link>
                    {j.location && ` · ${j.location}`}
                  </p>
                </div>
                <TrackButton jobId={j.id} tracked={tracked.has(j.id)} />
              </div>
              {j.reason && <p className="mt-2 max-w-prose sm:line-clamp-3 text-sm text-muted" title={j.reason}>{j.reason}</p>}
              {j.matchedSkills?.length || j.missingSkills?.length ? (
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {j.matchedSkills?.map((s) => <Tag key={`+${s}`} tone="good">{s}</Tag>)}
                  {j.missingSkills?.map((s) => <Tag key={`-${s}`} tone="bad">missing: {s}</Tag>)}
                </p>
              ) : null}
            </div>
          </>
          );
          return DEMO ? (
            <li key={j.id} className={row}>{content}</li>
          ) : (
            <HideableRow key={j.id} jobId={j.id} title={j.title} className={row}>{content}</HideableRow>
          );
        })}
      </ul>
    </>
  );
}
