"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { Progress } from "@/lib/progress";
import { buttonClass, errorClass } from "../ui";
import { useWorkerHint, WORKER_HINT } from "../use-worker-hint";
import { startScoring } from "./actions";

export function ScoreButton({ unscored }: { unscored: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(startScoring, null);
  const [progress, setProgress] = useState<Extract<Progress, { kind: "score" }> | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/progress");
    events.onmessage = (e) => {
      const p: Progress = JSON.parse(e.data);
      if (p.kind !== "score" || p.jobId) return; // single-job scores belong to their job page
      setProgress(p);
      router.refresh(); // re-render the list with the newly scored job
    };
    return () => events.close();
  }, [router]);

  const running = progress?.state === "running";
  const queued = Boolean(state?.ok) && !progress; // accepted by the queue, worker hasn't reported yet
  const slow = useWorkerHint(queued);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 text-sm">
      <button
        disabled={pending || queued || running}
        className={buttonClass()}
      >
        Score {unscored} with AI
      </button>
      <span role="status" aria-live="polite" className="text-muted tabular-nums">
        {running && `Scoring ${progress.done} of ${progress.total}…`}
        {queued && (slow ? WORKER_HINT : state?.ok === "Already scoring" ? "Already scoring…" : "Queued, waiting for the worker…")}
      </span>
      {progress?.state === "failed" && <span role="alert" className={errorClass}>Scoring failed. Is Ollama running?</span>}
      {state?.error && <span role="alert" className={errorClass}>{state.error}</span>}
    </form>
  );
}
