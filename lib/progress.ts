import { client } from "@/db";

export const PROGRESS_CHANNEL = "progress";

export type Progress =
  | { kind: "score"; userId: string; done: number; total: number; state: "running" | "finished" | "failed" }
  | { kind: "research"; userId: string; board: string; step: string; state: "running" | "finished" | "failed" };

// Postgres NOTIFY; /api/progress forwards each user's own events to their browser.
export const notify = (p: Progress) => client.notify(PROGRESS_CHANNEL, JSON.stringify(p));
