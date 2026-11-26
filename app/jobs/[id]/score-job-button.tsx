"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { Progress } from "@/lib/progress";
import { useWorkerHint, WORKER_HINT } from "../../use-worker-hint";
import { buttonClass, errorClass } from "../../ui";
import { startScoringJob } from "./actions";

type ScoreProgress = Extract<Progress, { kind: "score" }>;

export function ScoreJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(() => startScoringJob(jobId), null);
  const [progress, setProgress] = useState<ScoreProgress | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/progress");
    events.onmessage = (e) => {
      const p: Progress = JSON.parse(e.data);
      if (p.kind !== "score" || p.jobId !== jobId) return;
      setProgress(p);
      if (p.state === "finished") router.refresh(); // the page re-renders with the score
    };
    return () => events.close();
  }, [jobId, router]);

  const queued = Boolean(state?.ok) && !progress;
  const running = progress?.state === "running";
  const slow = useWorkerHint(queued);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 text-sm">
      <button disabled={pending || queued || running} className={buttonClass("secondary", "sm")}>Score this job</button>
      <span role="status" aria-live="polite" className="text-muted">
        {running && "Scoring with the local model…"}
        {queued && (slow ? WORKER_HINT : "Queued, waiting for the worker…")}
      </span>
      {progress?.state === "failed" && <span role="alert" className={errorClass}>Scoring failed. Is Ollama running?</span>}
      {state?.error && <span role="alert" className={errorClass}>{state.error}</span>}
    </form>
  );
}
