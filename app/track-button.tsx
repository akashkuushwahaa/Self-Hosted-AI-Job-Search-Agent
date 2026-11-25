"use client";

import { useActionState } from "react";
import { trackJob, type TrackerResult } from "./tracker/actions";
import { buttonClass, errorClass, Tag } from "./ui";

export function TrackButton({ jobId, tracked }: { jobId: string; tracked: boolean }) {
  const [state, action, pending] = useActionState<TrackerResult | null>(
    () => trackJob(jobId).catch(() => ({ error: "Couldn't track this job. Try again." })),
    null,
  );
  if (tracked) return <Tag tone="good">✓ Tracked</Tag>;
  return (
    <form action={action} className="flex items-center gap-2">
      {state?.error && <span role="alert" className={`${errorClass} text-xs`}>{state.error}</span>}
      <button disabled={pending} className={buttonClass("secondary", "sm")}>
        {pending ? "Tracking…" : "Track"}
      </button>
    </form>
  );
}
