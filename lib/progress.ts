import { client } from "@/db";

export const PROGRESS_CHANNEL = "progress";

export type Progress =
  | { kind: "score"; userId: string; done: number; total: number; state: "running" | "finished" | "failed" }
  // No userId: research events go to every signed-in user, so they must not say who asked.
  | { kind: "research"; board: string; step: string; state: "running" | "finished" | "failed" };

// Postgres NOTIFY; /api/progress forwards scoring events to their owner and research events to everyone.
export const notify = (p: Progress) => client.notify(PROGRESS_CHANNEL, JSON.stringify(p));
