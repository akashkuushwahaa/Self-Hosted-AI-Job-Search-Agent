"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { groupByStatus, STATUS_LABELS, STATUSES, type Status } from "@/lib/tracker";
import { moveApplication, untrackJob } from "./actions";

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

export function Board({ cards }: { cards: Card[] }) {
  const [, startTransition] = useTransition();
  // Cards move instantly; the server's version replaces this once the action finishes.
  const [optimistic, update] = useOptimistic(cards, (state, change: { jobId: string; status: Status | null }) =>
    change.status ? state.map((c) => (c.jobId === change.jobId ? { ...c, status: change.status! } : c)) : state.filter((c) => c.jobId !== change.jobId),
  );

  const move = (jobId: string, status: Status) =>
    startTransition(async () => {
      update({ jobId, status });
      await moveApplication(jobId, status);
    });
  const remove = (jobId: string) =>
    startTransition(async () => {
      update({ jobId, status: null });
      await untrackJob(jobId);
    });

  const columns = groupByStatus(optimistic);
  return (
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
                  <button onClick={() => remove(c.jobId)} className="h-8 shrink-0 rounded-md px-1.5 text-xs text-muted transition-[color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
