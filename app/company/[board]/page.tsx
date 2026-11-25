import { and, count, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/db";
import { companyResearch, jobs } from "@/db/schema";
import { companyByBoard } from "@/lib/companies";
import { DEMO } from "@/lib/demo";
import { isFresh } from "@/lib/dossier";
import { getUser } from "@/lib/session";
import { linkClass, Muted, PageHeader, Tag } from "../../ui";
import { ResearchButton } from "./research-button";

export default function CompanyPage({ params }: PageProps<"/company/[board]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Suspense fallback={<Muted>Loading company…</Muted>}>
        <Company params={params} />
      </Suspense>
    </main>
  );
}

function List({ title, items, tags = false }: { title: string; items: string[]; tags?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>
      {tags ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {items.map((item) => <li key={item}><Tag>{item}</Tag></li>)}
        </ul>
      ) : (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-muted">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}

async function Company({ params }: Pick<PageProps<"/company/[board]">, "params">) {
  const { board } = await params;
  const company = companyByBoard(board);
  if (!company) notFound();
  await connection(); // in-process PGlite (demo) would otherwise query during prerendering

  const [user, [research], [{ open }]] = await Promise.all([
    getUser(),
    db.select().from(companyResearch).where(eq(companyResearch.board, board)),
    db.select({ open: count() }).from(jobs).where(and(eq(jobs.board, board), isNull(jobs.closedAt))),
  ]);
  const stale = !isFresh(research?.researchedAt);
  const d = research?.dossier;

  return (
    <>
      <PageHeader
        title={company.name}
        description={
          <>
            <a href={company.site} target="_blank" rel="noopener noreferrer" className={linkClass}>{new URL(company.site).hostname}</a>
            <span className="tabular-nums">{` · ${open} open jobs`}</span>
          </>
        }
      >
        {!user ? (
          <Muted><a href="/login" className={linkClass}>Sign in</a> to research this company.</Muted>
        ) : stale && !DEMO ? (
          <ResearchButton board={board} label={research ? "Refresh research" : "Research this company"} />
        ) : null}
      </PageHeader>

      {d ? (
        <article className="mt-8 max-w-prose">
          <p className="text-lg leading-relaxed">{d.summary}</p>
          <List title="Products" items={d.products} tags />
          <List title="Tech they mention" items={d.techStack} tags />
          <List title="How they work" items={d.culture} />
          <List title="Talking points for an interview" items={d.talkingPoints} />
          <p className="mt-10 border-t border-border pt-4 text-xs text-muted">
            Written by {research.model} from {research.sources.length} pages of their site on{" "}
            {research.researchedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}:{" "}
            {research.sources.map((s, i) => (
              <span key={s}>
                {i > 0 && ", "}
                <a href={s} target="_blank" rel="noopener noreferrer" className={linkClass}>{new URL(s).pathname === "/" ? "home" : new URL(s).pathname}</a>
              </span>
            ))}
            . Check anything important against the source.
          </p>
        </article>
      ) : (
        <p className="mt-8 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          {DEMO ? "No brief recorded for this company in the demo. Research runs on your own machine." : "No research yet."}
        </p>
      )}
    </>
  );
}
