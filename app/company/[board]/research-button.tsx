"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { Progress } from "@/lib/progress";
import { buttonClass, errorClass } from "../../ui";
import { startResearch } from "./actions";

type ResearchProgress = Extract<Progress, { kind: "research" }>;

export function ResearchButton({ board, label }: { board: string; label: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(startResearch.bind(null, board), null);
  const [progress, setProgress] = useState<ResearchProgress | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/progress");
    events.onmessage = (e) => {
      const p: Progress = JSON.parse(e.data);
      if (p.kind !== "research" || p.board !== board) return;
      setProgress(p);
      if (p.state === "finished") router.refresh();
    };
    return () => events.close();
  }, [board, router]);

  const running = progress?.state === "running";
  const queued = state?.ok === "Research started" && !progress;

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 text-sm">
      <button
        disabled={pending || queued || running}
        className={buttonClass()}
      >
        {label}
      </button>
      <span role="status" aria-live="polite" className="text-muted">
        {running && `${progress.step}…`}
        {queued && "Queued, waiting for the worker…"}
        {!progress && state?.ok && state.ok !== "Research started" && state.ok}
      </span>
      {progress?.state === "failed" && (
        <span role="alert" className={errorClass}>Research failed: {progress.step}</span>
      )}
      {state?.error && <span role="alert" className={errorClass}>{state.error}</span>}
    </form>
  );
}
