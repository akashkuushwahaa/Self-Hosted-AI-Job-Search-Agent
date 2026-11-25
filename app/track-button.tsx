"use client";

import { useFormStatus } from "react-dom";
import { trackJob } from "./tracker/actions";
import { buttonClass, Tag } from "./ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={buttonClass("secondary", "sm")}>
      {pending ? "Tracking…" : "Track"}
    </button>
  );
}

export function TrackButton({ jobId, tracked }: { jobId: string; tracked: boolean }) {
  if (tracked) return <Tag tone="good">✓ Tracked</Tag>;
  return (
    <form action={trackJob.bind(null, jobId)}>
      <Submit />
    </form>
  );
}
