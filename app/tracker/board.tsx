"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { groupByStatus, STATUS_LABELS, STATUSES, type Status } from "@/lib/tracker";
import { errorClass, linkClass } from "../ui";
import { moveApplication, trackJob, untrackJob, type TrackerResult } from "./actions";

type Card = {
  jobId: string;
  status: Status;
  title: string;
  company: string;
  board: string;
  location: string | null;
  url: string;
  closed: boolean;
};

type Change = { jobId: string; status: Status | null } | { restore: Card };
type Notice = { error: string } | { removed: Card };

const UNDO_MS = 6_000;

// Network failures and server faults reject; expected failures come back as { error }.
const attempt = (action: Promise<TrackerResult>, fallback: string) => action.catch(() => ({ error: fallback }));

export function Board({ cards }: { cards: Card[] }) {
  const [, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  // Cards move instantly; the server's version replaces this once the action finishes, so a failed
  // change snaps back on its own and the notice says why.
  const [optimistic, update] = useOptimistic(cards, (state, change: Change) => {
    if ("restore" in change) return state.some((c) => c.jobId === change.restore.jobId) ? state : [...state, change.restore];
    return change.status ? state.map((c) => (c.jobId === change.jobId ? { ...c, status: change.status! } : c)) : state.filter((c) => c.jobId !== change.jobId);
  });

  useEffect(() => {
    if (!notice || !("removed" in notice)) return;
    const timer = setTimeout(() => setNotice(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const move = (jobId: string, status: Status) =>
    startTransition(async () => {
      update({ jobId, status });
      const { error } = await attempt(moveApplication(jobId, status), "Couldn't move that card. Try again.");
      setNotice(error ? { error } : null);
    });
  const remove = (card: Card) =>
    startTransition(async () => {
      update({ jobId: card.jobId, status: null });
      const { error } = await attempt(untrackJob(card.jobId), "Couldn't remove that card. Try again.");
      setNotice(error ? { error } : { removed: card });
    });
  const undo = (card: Card) =>
    startTransition(async () => {
      setNotice(null);
      update({ restore: card });
      const { error } = await attempt(trackJob(card.jobId, card.status), "Couldn't put that card back. Track it again from its job page.");
      if (error) setNotice({ error });
    });

  const columns = groupByStatus(optimistic);
  return (
    <>
      {optimistic.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          Nothing tracked yet. Use <strong className="text-foreground">Track</strong> on a job in{" "}
          <Link href="/jobs" className={linkClass}>Jobs</Link> or <Link href="/matches" className={linkClass}>For you</Link>.
        </p>
      ) : (
        <div className="relative -mx-4 mt-6 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {STATUSES.map((status) => (
            <section
              key={status}
              aria-label={STATUS_LABELS[status]}
              className="min-h-40 w-64 shrink-0 rounded-lg border border-border bg-subtle/50 p-2 lg:w-auto"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const jobId = e.dataTransfer.getData("text/plain");
                if (optimistic.some((c) => c.jobId === jobId)) move(jobId, status); // ignore text dragged in from elsewhere
              }}
            >
              <h2 className="flex items-center justify-between px-1.5 py-1 text-sm font-medium">
                {STATUS_LABELS[status]} <span className="text-xs font-normal text-muted tabular-nums">{columns[status].length}</span>
              </h2>
              <ul className="mt-2 space-y-2">
                {columns[status].map((c) => (
                  <li
                    key={c.jobId}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.jobId)}
                    className="cursor-grab rounded-md border border-border bg-background p-3 text-sm transition-[border-color] duration-150 hover:border-muted/40 active:cursor-grabbing"
                  >
                    <Link href={`/jobs/${c.jobId}`} className="font-medium hover:underline">{c.title}</Link>
                    <p className="mt-0.5 text-muted">
                      <Link href={`/company/${c.board}`} className="hover:underline">{c.company}</Link>
                      {c.location && ` · ${c.location}`}
                    </p>
                    {c.closed && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">No longer listed</p>}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {/* Keyboard and touch alternative to dragging. */}
                      <label className="sr-only" htmlFor={`status-${c.jobId}`}>Status for {c.title}</label>
                      <select
                        id={`status-${c.jobId}`}
                        value={c.status}
                        onChange={(e) => move(c.jobId, e.target.value as Status)}
                        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 text-xs focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                      <button onClick={() => remove(c)} className="h-8 shrink-0 rounded-md px-1.5 text-xs text-muted transition-[color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {/* One live region for both kinds of notice, so screen readers hear errors and the undo offer. */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-4">
        {notice && (
          <p className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm shadow-lg">
            {"error" in notice ? (
              <span className={errorClass}>{notice.error}</span>
            ) : (
              <>
                <span>Removed <span className="font-medium">{notice.removed.title}</span></span>
                <button
                  onClick={() => undo(notice.removed)}
                  className="rounded-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Undo
                </button>
              </>
            )}
            <button onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">✕</button>
          </p>
        )}
      </div>
    </>
  );
}
