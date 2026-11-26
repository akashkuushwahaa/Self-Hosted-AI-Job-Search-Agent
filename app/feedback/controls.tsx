"use client";

import { useState, useTransition } from "react";
import { errorClass } from "../ui";
import { rateMatch, setHidden } from "./actions";

const quiet = "rounded-sm text-xs text-muted transition-[color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";

// A job row with "Not interested". Hidden rows collapse to one line with Undo until the next
// navigation; the server already leaves them out of every list from then on.
export function HideableRow({ jobId, title, className, children }: { jobId: string; title: string; className: string; children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const change = (next: boolean) =>
    startTransition(async () => {
      const { error } = await setHidden(jobId, next).catch(() => ({ error: "Couldn't save that. Try again." }));
      setError(error ?? null);
      if (!error) setHiddenState(next);
    });

  if (hidden) {
    return (
      <li className="flex items-center gap-3 py-3 text-sm text-muted">
        <span>Hidden “{title}”. It won&apos;t show in Jobs or For you.</span>
        <button onClick={() => change(false)} disabled={pending} className={`${quiet} font-medium text-accent`}>Undo</button>
        {error && <span role="alert" className={`${errorClass} text-xs`}>{error}</span>}
      </li>
    );
  }
  return (
    <li className={className}>
      {children}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button onClick={() => change(true)} disabled={pending} className={quiet} aria-label={`Not interested in ${title}`}>Not interested</button>
        {error && <span role="alert" className={`${errorClass} text-xs`}>{error}</span>}
      </div>
    </li>
  );
}

// Thumbs up/down on a match score: is the model right? Rated pairs export as eval labels.
export function RateScore({ jobId, rating: initial }: { jobId: string; rating: number | null }) {
  const [rating, setRating] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rate = (value: 1 | -1) =>
    startTransition(async () => {
      const next = rating === value ? 0 : value; // pressing the active thumb clears it
      const { error } = await rateMatch(jobId, next).catch(() => ({ error: "Couldn't save that." }));
      setError(error ?? null);
      if (!error) setRating(next || null);
    });
  const thumb = (value: 1 | -1, label: string, glyph: string) => (
    <button
      onClick={() => rate(value)}
      disabled={pending}
      aria-pressed={rating === value}
      aria-label={label}
      title={label}
      className={`grid size-6 place-items-center rounded text-xs transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 ${rating === value ? "bg-accent/15 text-accent" : "text-muted hover:bg-subtle hover:text-foreground"}`}
    >
      {glyph}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Is this score right?">
      {thumb(1, "Score looks right", "👍")}
      {thumb(-1, "Score looks wrong", "👎")}
      {error && <span role="alert" className={`${errorClass} ml-1 text-xs`}>{error}</span>}
    </div>
  );
}
