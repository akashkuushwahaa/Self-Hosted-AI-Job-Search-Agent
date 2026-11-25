import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { db } from "@/db";
import { companyResearch, jobs, matches } from "@/db/schema";
import { trackedJobIds } from "@/lib/applications";
import { getProfile } from "@/lib/candidates";
import { splitSkills } from "@/lib/skills";
import { getUser } from "@/lib/session";
import { cleanReason, toBlocks } from "@/lib/text";
import { TrackButton } from "../../track-button";
import { buttonClass, linkClass, Muted, PageHeader, ScoreBadge, Tag } from "../../ui";

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Suspense fallback={<Muted>Loading job…</Muted>}>
        <Job params={params} />
      </Suspense>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

async function Job({ params }: Pick<PageProps<"/jobs/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound(); // a malformed id would otherwise be a Postgres error
  await connection(); // in-process PGlite (demo) would otherwise query during prerendering

  const [[job], user] = await Promise.all([db.select().from(jobs).where(eq(jobs.id, id)), getUser()]);
  if (!job) notFound();

  const [[match], tracked, [brief], profile] = await Promise.all([
    user ? db.select().from(matches).where(and(eq(matches.userId, user.id), eq(matches.jobId, id))) : [],
    user ? trackedJobIds(user.id, [id]) : null,
    db.select({ summary: companyResearch.dossier }).from(companyResearch).where(eq(companyResearch.board, job.board)),
    user ? getProfile(user.id) : null,
  ]);
  const skills = match && splitSkills(match.matchedSkills, match.missingSkills, profile ?? { skills: [], resumeText: null });

  return (
    <>
      <PageHeader
        title={job.title}
        description={
          <>
            <Link href={`/company/${job.board}`} className={linkClass}>{job.company}</Link>
            {job.location && ` · ${job.location}`}
            {job.postedAt && ` · posted ${job.postedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`}
          </>
        }
      >
        <div className="flex items-center gap-2">
          {user && <TrackButton jobId={job.id} tracked={Boolean(tracked?.has(id))} />}
          {job.closedAt ? (
            <Tag>No longer listed</Tag>
          ) : (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className={buttonClass()}>Apply ↗</a>
          )}
        </div>
      </PageHeader>

      {match && skills && (
        <Section title="Your match">
          <div className="flex gap-4">
            <ScoreBadge score={match.score} />
            <div className="min-w-0">
              <p className="text-sm">{cleanReason(match.reason)}</p>
              {(skills.matched.length > 0 || skills.missing.length > 0) && (
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {skills.matched.map((s) => <Tag key={`+${s}`} tone="good">{s}</Tag>)}
                  {skills.missing.map((s) => <Tag key={`-${s}`} tone="bad">missing: {s}</Tag>)}
                </p>
              )}
            </div>
          </div>
        </Section>
      )}
      {user && !match && (
        <Muted className="mt-8">
          Not scored for you yet. Scores come from <Link href="/matches" className={linkClass}>For you</Link>, which scores the jobs closest to your profile.
        </Muted>
      )}

      {brief && (
        <Section title={`About ${job.company}`}>
          <p className="text-sm">{brief.summary.summary}</p>
          <Link href={`/company/${job.board}`} className={`${linkClass} mt-2 inline-block text-sm`}>Full company brief →</Link>
        </Section>
      )}

      <Section title="The posting">
        <div className="max-w-prose space-y-4 text-sm leading-relaxed">
          {toBlocks(job.description).map((b, i) =>
            b.kind === "ul" ? (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted">
                {b.lines.map((line, j) => <li key={j}>{line}</li>)}
              </ul>
            ) : (
              <p key={i}>
                {b.lines.map((line, j) => (
                  <span key={j}>{j > 0 && <br />}{line}</span>
                ))}
              </p>
            ),
          )}
        </div>
      </Section>
    </>
  );
}
