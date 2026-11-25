import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { matchScores, trackedJobIds } from "@/lib/applications";
import { getProfile, profileVector } from "@/lib/candidates";
import { companies } from "@/lib/companies";
import { DEMO, DEMO_QUERIES } from "@/lib/demo";
import { searchJobs } from "@/lib/search";
import { getUser } from "@/lib/session";
import { TrackButton } from "../track-button";
import { buttonClass, inputClass, Muted, PageHeader, ScoreBadge } from "../ui";

const PAGE_SIZE = 25;

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <PageHeader title="Jobs" description={`Open roles from ${companies.length} companies' public career boards.`} />
      <Suspense fallback={<Muted className="mt-6">Loading jobs…</Muted>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/jobs">, "searchParams">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page) || 1);
  const wantsFit = params.sort !== "default"; // best fit is the default whenever there's a profile to fit
  await connection(); // in-process PGlite (demo) would otherwise query during prerendering

  const user = await getUser();
  const profile = user ? await getProfile(user.id) : null;
  const canFit = Boolean(profile && (profile.skills.length || profile.resumeText));
  // Without the local model there's no profile vector; the list falls back to the plain order.
  const fitVector = canFit && wantsFit ? await profileVector(profile!).catch(() => null) : null;
  const { rows, total, more, mode, fit } = await searchJobs(q, page, PAGE_SIZE, fitVector && { vector: fitVector, userId: user!.id });
  const ids = rows.map((r) => r.id);
  const [tracked, scores] = user ? await Promise.all([trackedJobIds(user.id, ids), matchScores(user.id, ids)]) : [null, null];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number, byFit = wantsFit) =>
    `/jobs?${new URLSearchParams({ ...(q && { q }), ...(!byFit && { sort: "default" }), page: String(p) })}`;
  const orderLink = (active: boolean) =>
    `rounded px-2.5 py-1 transition-[background-color,color] duration-150 ${active ? "bg-subtle font-medium text-foreground" : "text-muted hover:text-foreground"}`;

  return (
    <>
      <form className="mt-6 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search jobs</label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder='e.g. frontend internship in India, or "next.js" -senior'
          className={`${inputClass} h-10`}
        />
        <button className={buttonClass()}>Search</button>
      </form>
      {DEMO && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Try</span>
          {DEMO_QUERIES.map((s) => (
            <Link
              key={s}
              href={`/jobs?${new URLSearchParams({ q: s })}`}
              className="rounded-full border border-border px-2.5 py-1 text-muted transition-[background-color,color] duration-150 hover:bg-subtle hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
            >
              {s}
            </Link>
          ))}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Muted className="tabular-nums">
          {mode === "fit"
            ? `${total.toLocaleString()} open jobs, best fit for your profile first`
            : mode === "recent"
              ? `${total.toLocaleString()} open jobs, newest first`
              : `${total.toLocaleString()}${more ? "+" : ""} ${total === 1 && !more ? "match" : "matches"} · ${mode === "hybrid" ? "keyword + semantic" : DEMO ? "keyword only (semantic search in the demo covers the sample searches)" : "keyword only (embedding service unavailable)"}${fit ? ", ranked by fit to your profile" : ""}`}
          {canFit && wantsFit && !fit && " · fit ranking needs the local model"}
        </Muted>
        {canFit && (
          <nav aria-label="Order" className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
            <Link href={href(1, true)} aria-current={wantsFit ? "true" : undefined} className={orderLink(wantsFit)}>Best fit for you</Link>
            <Link href={href(1, false)} aria-current={!wantsFit ? "true" : undefined} className={orderLink(!wantsFit)}>{q ? "Most relevant" : "Newest"}</Link>
          </nav>
        )}
      </div>

      {rows.length ? (
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {rows.map((j) => (
            <li key={j.id} className="flex items-center gap-4 py-3.5">
              {scores?.has(j.id) && <ScoreBadge score={scores.get(j.id)!} />}
              <div className="min-w-0 flex-1">
                <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">
                  {j.title}
                </Link>
                <p className="mt-0.5 text-sm text-muted">
                  <Link href={`/company/${j.board}`} className="text-foreground/80 hover:underline">{j.company}</Link>
                  {j.location && ` · ${j.location}`}
                  {j.postedAt && ` · ${j.postedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`}
                </p>
              </div>
              {tracked && <TrackButton jobId={j.id} tracked={tracked.has(j.id)} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {q ? `No open jobs match “${q}”. Try fewer words or a broader role.` : "No open jobs yet. Run the ingest to pull them in."}
        </p>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={href(page - 1)} className={buttonClass("secondary", "sm")}>← Previous</Link> : <span />}
          <span className="text-muted tabular-nums">Page {page} of {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className={buttonClass("secondary", "sm")}>Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
