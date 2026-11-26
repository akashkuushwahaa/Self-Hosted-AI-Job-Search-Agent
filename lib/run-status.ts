import { DEMO } from "./demo";
import { getBoss } from "./queue";

// The last background run for something (a user's scoring, a company's research), read back from
// pg-boss's own job table. Live progress is an SSE event, gone on refresh; this survives it, so a
// page can still say "the last run failed: fetch failed" an hour later.
export type RunStatus = { state: "queued" | "running" | "finished" | "failed"; at: Date; error: string | null };

type JobRow = {
  state: "created" | "retry" | "active" | "completed" | "cancelled" | "failed";
  createdOn: Date;
  startedOn: Date | null;
  completedOn: Date | null;
  output: unknown;
};

export function toRunStatus(job: JobRow): RunStatus | null {
  switch (job.state) {
    case "created":
    case "retry":
      return { state: "queued", at: job.createdOn, error: null };
    case "active":
      return { state: "running", at: job.startedOn ?? job.createdOn, error: null };
    case "completed":
      return { state: "finished", at: job.completedOn ?? job.createdOn, error: null };
    case "failed": {
      const message = (job.output as { message?: unknown } | null)?.message;
      return { state: "failed", at: job.completedOn ?? job.createdOn, error: typeof message === "string" ? message : null };
    }
    default:
      return null; // cancelled: nothing to report
  }
}

// Newest job for `key` on `queue` that `relevant` accepts. pg-boss returns oldest first, and a key
// has at most a few dozen jobs within its retention, so reading them all is cheap.
export async function lastRun(queue: string, key: string, relevant: (data: unknown) => boolean = () => true): Promise<RunStatus | null> {
  if (DEMO) return null; // the demo has no queue
  const jobs = await (await getBoss()).findJobs(queue, { key });
  const job = jobs.filter((j) => relevant(j.data)).at(-1);
  return job ? toRunStatus(job as JobRow) : null;
}

export function timeAgo(date: Date, now = new Date()) {
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 45) return "just now";
  const [n, unit] = s < 3600 ? [Math.round(s / 60), "minute"] : s < 86400 ? [Math.round(s / 3600), "hour"] : [Math.round(s / 86400), "day"];
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}
