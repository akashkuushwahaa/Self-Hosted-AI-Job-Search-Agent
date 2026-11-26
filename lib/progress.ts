import { client } from "@/db";

export const PROGRESS_CHANNEL = "progress";

export type Progress =
  // jobId: a single job scored from its page; absent for a run over the top candidates.
  | { kind: "score"; userId: string; jobId?: string; done: number; total: number; state: "running" | "finished" | "failed" }
  // No userId: research events go to every signed-in user, so they must not say who asked.
  // filled: what the model added to the profile, for the "Filled in …" message.
  | { kind: "profile"; userId: string; state: "running" | "finished" | "failed"; filled?: string[] }
  | { kind: "tailor"; userId: string; jobId: string; state: "running" | "finished" | "failed" }
  | { kind: "research"; board: string; step: string; state: "running" | "finished" | "failed" };

// Postgres NOTIFY; /api/progress forwards scoring events to their owner and research events to everyone.
export const notify = (p: Progress) => client.notify(PROGRESS_CHANNEL, JSON.stringify(p));
