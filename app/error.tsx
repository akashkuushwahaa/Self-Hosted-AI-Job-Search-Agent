"use client"; // error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass, PageHeader } from "./ui";

// Any page that throws while rendering lands here, inside the normal layout and nav.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  // In production, server errors arrive with only a digest that matches the server log line.
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <PageHeader
        title="Something went wrong"
        description="This page failed to load. If you run Shortlist yourself, check that Postgres (and Ollama, for scoring) are running."
      />
      <div className="mt-6 flex items-center gap-2">
        <button onClick={() => retry()} className={buttonClass()}>Try again</button>
        <Link href="/" className={buttonClass("secondary")}>Home</Link>
      </div>
      {digest && <p className="mt-4 font-mono text-xs text-muted">Error {digest}</p>}
    </main>
  );
}
