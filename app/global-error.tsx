"use client"; // error boundaries must be Client Components

import "./globals.css";

// Only for failures in the root layout itself (app/error.tsx covers pages). It replaces the layout,
// so it brings its own <html> and <body>.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-4 font-sans">
        <title>Something went wrong · Shortlist</title>
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">Shortlist couldn&apos;t load. If you run it yourself, check that Postgres is running.</p>
          <button
            onClick={() => retry()}
            className="mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/85"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
