// Background worker: `npm run worker`, alongside `npm run dev`.
import { getBoss, RESEARCH_QUEUE, SCORE_QUEUE, type ResearchJob, type ScoreJob } from "../lib/queue";
import { researchCompany } from "../lib/research-run";
import { scoreUnscored } from "../lib/scoring";

const boss = await getBoss();
await boss.work<ScoreJob>(SCORE_QUEUE, async ([job]) => {
  console.log(`scoring for ${job.data.userId}`);
  await scoreUnscored(job.data.userId);
  console.log(`done for ${job.data.userId}`);
});
await boss.work<ResearchJob>(RESEARCH_QUEUE, async ([job]) => {
  console.log(`researching ${job.data.board}`);
  await researchCompany(job.data.board, job.data.userId);
  console.log(`researched ${job.data.board}`);
});
console.log(`worker listening on ${SCORE_QUEUE}, ${RESEARCH_QUEUE}`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await boss.stop(); // graceful: waits for the active job up to pg-boss's stop timeout
    process.exit(0);
  });
}
