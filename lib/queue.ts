import { PgBoss } from "pg-boss";

export const SCORE_QUEUE = "score-matches";
// jobId: score just that job (from its page). singletonKey `${userId}:${jobId}`, so it runs beside a
// full run instead of being refused by the exclusive policy.
export type ScoreJob = { userId: string; jobId?: string };
export const RESEARCH_QUEUE = "research-company";
export type ResearchJob = { board: string; userId: string };
export const REFRESH_QUEUE = "refresh-jobs";

// One started instance per process; kept on globalThis so Next dev's hot reload doesn't open new pools.
const g = globalThis as unknown as { boss?: Promise<PgBoss> };

export function getBoss(): Promise<PgBoss> {
  g.boss ??= (async () => {
    const boss = new PgBoss(process.env.DATABASE_URL!);
    boss.on("error", console.error);
    await boss.start();
    // exclusive + singletonKey=userId: one queued-or-active scoring run per user.
    // singletonKey=board (research): two users asking about the same company share one run.
    // refresh: one at a time; the first full embed of a fresh install can take a while.
    const queues = [
      [SCORE_QUEUE, 3600],
      [RESEARCH_QUEUE, 600],
      [REFRESH_QUEUE, 3 * 3600],
    ] as const;
    for (const [name, expireInSeconds] of queues) {
      await boss.createQueue(name, { policy: "exclusive", expireInSeconds, retryLimit: 1 });
      // work() refreshes the heartbeat while a handler runs. If the worker dies mid-job, the job is
      // failed and retried within about a minute, instead of sitting "active" (and blocking new runs
      // under the exclusive policy) until it expires. updateQueue so existing installs get it too.
      await boss.updateQueue(name, { heartbeatSeconds: 30 });
    }
    return boss;
  })();
  return g.boss;
}
