"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { Progress } from "@/lib/progress";
import type { Tailored } from "@/lib/tailor";
import { useWorkerHint, WORKER_HINT } from "../../use-worker-hint";
import { buttonClass, errorClass } from "../../ui";
import { startTailoring } from "./actions";

export function TailorButton({ jobId, again }: { jobId: string; again: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(() => startTailoring(jobId), null);
  const [progress, setProgress] = useState<"running" | "failed" | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/progress");
    events.onmessage = (e) => {
      const p: Progress = JSON.parse(e.data);
      if (p.kind !== "tailor" || p.jobId !== jobId) return;
      if (p.state === "finished") {
        setProgress(null);
        router.refresh();
      } else setProgress(p.state);
    };
    return () => events.close();
  }, [jobId, router]);

  const queued = Boolean(state?.ok) && !progress;
  const slow = useWorkerHint(queued);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 text-sm">
      <button disabled={pending || queued || progress === "running"} className={buttonClass(again ? "secondary" : "primary", again ? "sm" : "md")}>
        {again ? "Write it again" : "Write my summary, resume points and cover letter"}
      </button>
      <span role="status" aria-live="polite" className="text-muted">
        {progress === "running" && "Writing from your resume with the local model (about a minute)…"}
        {queued && (slow ? WORKER_HINT : "Queued, waiting for the worker…")}
      </span>
      {progress === "failed" && <span role="alert" className={errorClass}>Couldn&apos;t write it. Is Ollama running?</span>}
      {state?.error && <span role="alert" className={errorClass}>{state.error}</span>}
    </form>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
      onBlur={() => setCopied(false)}
      className="rounded-sm text-xs text-muted transition-[color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function TailoredView({ t }: { t: Tailored }) {
  const points = t.highlights.map((h) => `• ${h.point}`).join("\n");
  const block = (title: string, copy: string, body: React.ReactNode) => (
    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {copy && <CopyButton text={copy} label={title.toLowerCase()} />}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed">{body}</div>
    </div>
  );
  return (
    <div className="max-w-prose">
      {t.summary && block("Summary", t.summary, <p>{t.summary}</p>)}
      {t.highlights.length > 0 &&
        block(
          "Resume points",
          points,
          <ul className="list-disc space-y-1 pl-5 marker:text-muted">
            {t.highlights.map((h) => (
              <li key={h.point} title={`From your resume: “${h.evidence}”`}>{h.point}</li>
            ))}
          </ul>,
        )}
      {t.coverLetter && block("Cover letter", t.coverLetter, <p className="whitespace-pre-line">{t.coverLetter}</p>)}
      {t.removed.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-muted">
            Removed {t.removed.length} {t.removed.length === 1 ? "claim" : "claims"} your resume doesn&apos;t back
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted marker:text-muted">
            {t.removed.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
