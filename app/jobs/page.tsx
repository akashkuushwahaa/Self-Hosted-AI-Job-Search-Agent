import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { matchScores, trackedJobIds } from "@/lib/applications";
import { getProfile, profileVector } from "@/lib/candidates";
import { companies } from "@/lib/companies";
import { DEMO, DEMO_QUERIES } from "@/lib/demo";
import { COUNTRY_OPTIONS, filterParams, hasFilters, LEVELS, parseFilters, POSTED } from "@/lib/filters";
import { searchJobs } from "@/lib/search";
import { getUser } from "@/lib/session";
import { HideableRow } from "../feedback/controls";
import { TrackButton } from "../track-button";
import { buttonClass, inputClass, linkClass, Muted, PageHeader, ScoreBadge } from "../ui";

export const metadata: Metadata = { title: "Jobs" };

const PAGE_SIZE = 25;
const sortedCompanies = [...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.board, c.name] as const);

function FilterSelect({ name, label, value, any, options }: { name: string; label: string; value: string | null; any: string; options: readonly (readonly [string, string])[] }) {
  return (
    <>
      <label htmlFor={`filter-${name}`} className="sr-only">{label}</label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className={`h-8 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-accent ${value ? "text-foreground" : "text-muted"}`}
      >
        <option value="">{any}</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </>
  );
}

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
  // The filter form submits every field, empty or not; drop the empty ones so shared URLs stay clean.
  if (Object.values(params).some((v) => v === "")) {
    const clean = Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== "");
    redirect(`/jobs${clean.length ? `?${new URLSearchParams(clean)}` : ""}`);
  }
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page) || 1);
  const wantsFit = params.sort !== "default"; // best fit is the default whenever there's a profile to fit
  const filters = parseFilters(params);
  const filtered = hasFilters(filters);
  await connection(); // in-process PGlite (demo) would otherwise query during prerendering

  const user = await getUser();
  const profile = user ? await getProfile(user.id) : null;
  const canFit = Boolean(profile && (profile.skills.length || profile.resumeText));
  // Without the local model there's no profile vector; the list falls back to the plain order.
  const fitVector = canFit && wantsFit ? await profileVector(profile!).catch(() => null) : null;
  const { rows, total, more, mode, fit } = await searchJobs(q, page, PAGE_SIZE, { fit: fitVector && { vector: fitVector, userId: user!.id }, filters, viewer: user?.id });
  const ids = rows.map((r) => r.id);
  const [tracked, scores] = user ? await Promise.all([trackedJobIds(user.id, ids), matchScores(user.id, ids)]) : [null, null];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number, byFit = wantsFit) =>
    `/jobs?${new URLSearchParams({ ...(q && { q }), ...filterParams(filters), ...(!byFit && { sort: "default" }), page: String(p) })}`;
  const orderLink = (active: boolean) =>
    `rounded px-2.5 py-1 transition-[background-color,color] duration-150 ${active ? "bg-subtle font-medium text-foreground" : "text-muted hover:text-foreground"}`;

  return (
    <>
      <form className="mt-6" role="search">
        <div className="flex gap-2">
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
        </div>
        {/* Plain GET fields: filters live in the URL, so results can be shared and work without JS. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <FilterSelect name="level" label="Level" value={filters.level} any="Any level" options={Object.entries(LEVELS)} />
          <FilterSelect name="country" label="Country" value={filters.country} any="Any country" options={COUNTRY_OPTIONS.map((c) => [c.code, c.label])} />
          <FilterSelect name="company" label="Company" value={filters.company} any="Any company" options={sortedCompanies} />
          <FilterSelect name="posted" label="Posted" value={filters.postedDays ? String(filters.postedDays) : null} any="Any time" options={Object.entries(POSTED)} />
          <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs">
            <input type="checkbox" name="remote" value="1" defaultChecked={filters.remote} className="accent-accent" />
            Remote
          </label>
          {!wantsFit && <input type="hidden" name="sort" value="default" />}
          <button className={buttonClass("secondary", "sm")}>Apply</button>
          {filtered && (
            <Link href={`/jobs?${new URLSearchParams({ ...(q && { q }), ...(!wantsFit && { sort: "default" }) })}`} className={`${linkClass} text-xs text-muted`}>
              Clear filters
            </Link>
          )}
        </div>
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
          {rows.map((j) => {
            const row = "flex items-center gap-4 py-3.5";
            const content = (
            <>
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
            </>
            );
            // Signed-in users can hide a job; signed-out visitors and the demo get a plain row.
            return user && !DEMO ? (
              <HideableRow key={j.id} jobId={j.id} title={j.title} className={row}>{content}</HideableRow>
            ) : (
              <li key={j.id} className={row}>{content}</li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {filtered
            ? "No open jobs match these filters. Try removing one."
            : q
              ? `No open jobs match “${q}”. Try fewer words or a broader role.`
              : "No open jobs yet. Run the ingest to pull them in."}
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
