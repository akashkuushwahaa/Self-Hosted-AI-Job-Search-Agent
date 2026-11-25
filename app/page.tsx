import { count, isNull } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { companies } from "@/lib/companies";
import { buttonClass, REPO_URL, Tag } from "./ui";

const steps = [
  ["Ingest", "Greenhouse, Lever and Ashby boards into Postgres, no API keys."],
  ["Search", "Keyword and pgvector semantic search, merged with reciprocal rank fusion."],
  ["Score", "qwen2.5 via Ollama, with code-checked seniority, location and skill gates."],
  ["Research", "Playwright reads the company's site; the model writes a brief with checked facts."],
  ["Track", "A drag-and-drop board with optimistic updates, plus an MCP server for Claude."],
] as const;

const stack = ["Next.js 16", "Postgres + pgvector", "Ollama", "pg-boss", "Playwright", "MCP"];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4">
      <section className="py-16 sm:py-24">
        <p className="text-sm font-medium text-accent">Self-hosted AI job search</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          A job-search agent that runs on your own machine.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Pulls jobs from {companies.length} companies&apos; public career boards, ranks them against a resume with a
          local LLM, and tracks applications. No paid APIs, no keys that expire.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/matches" className={buttonClass()}>Try the live demo →</Link>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
            View source ↗
          </a>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        <Stat label="open jobs">
          <Suspense fallback="—">
            <OpenJobs />
          </Suspense>
        </Stat>
        <Stat label="companies">{companies.length}</Stat>
        <Stat label="AUC on a labeled eval">0.91</Stat>
        <Stat label="to run">$0</Stat>
      </dl>

      <section className="py-16">
        <h2 className="text-sm font-medium text-muted">How it works</h2>
        <ol className="mt-4 divide-y divide-border border-y border-border">
          {steps.map(([name, detail], i) => (
            <li key={name} className="grid gap-1 py-4 sm:grid-cols-[3rem_8rem_1fr] sm:gap-4">
              <span className="font-mono text-sm text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-medium">{name}</span>
              <span className="text-muted">{detail}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="pb-20">
        <h2 className="text-sm font-medium text-muted">Built with</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {stack.map((s) => (
            <li key={s}><Tag>{s}</Tag></li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-1 bg-background px-5 py-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums">{children}</dd>
    </div>
  );
}

async function OpenJobs() {
  await connection(); // in-process PGlite (demo) would otherwise query during prerendering
  try {
    const [{ open }] = await db.select({ open: count() }).from(jobs).where(isNull(jobs.closedAt));
    return open.toLocaleString();
  } catch {
    return "—"; // database down: the landing page still renders
  }
}
