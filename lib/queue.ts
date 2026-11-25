import { PgBoss } from "pg-boss";

export const SCORE_QUEUE = "score-matches";
export type ScoreJob = { userId: string };
export const RESEARCH_QUEUE = "research-company";
export type ResearchJob = { board: string; userId: string };

// One started instance per process; kept on globalThis so Next dev's hot reload doesn't open new pools.
const g = globalThis as unknown as { boss?: Promise<PgBoss> };

export function getBoss(): Promise<PgBoss> {
  g.boss ??= (async () => {
    const boss = new PgBoss(process.env.DATABASE_URL!);
    boss.on("error", console.error);
    await boss.start();
    // exclusive + singletonKey=userId: one queued-or-active scoring run per user.
    await boss.createQueue(SCORE_QUEUE, { policy: "exclusive", expireInSeconds: 3600, retryLimit: 1 });
    // singletonKey=board: two users asking about the same company share one run.
    await boss.createQueue(RESEARCH_QUEUE, { policy: "exclusive", expireInSeconds: 600, retryLimit: 1 });
    return boss;
  })();
  return g.boss;
}
