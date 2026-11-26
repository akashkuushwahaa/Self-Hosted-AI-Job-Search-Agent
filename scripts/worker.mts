// Background worker: `npm run worker`, alongside `npm run dev`.
import { getBoss, REFRESH_QUEUE, RESEARCH_QUEUE, SCORE_QUEUE, type ResearchJob, type ScoreJob } from "../lib/queue";
import { refreshJobs } from "../lib/refresh";
import { researchCompany } from "../lib/research-run";
import { scoreOne, scoreUnscored } from "../lib/scoring";

// Daily ingest → embed → score, in this machine's time zone. "off" turns it off.
const REFRESH_CRON = process.env.REFRESH_CRON ?? "0 6 * * *";
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

const boss = await getBoss();
await boss.work<ScoreJob>(SCORE_QUEUE, async ([job]) => {
  const { userId, jobId } = job.data;
  console.log(jobId ? `scoring job ${jobId} for ${userId}` : `scoring for ${userId}`);
  await (jobId ? scoreOne(userId, jobId) : scoreUnscored(userId));
  console.log(`done for ${userId}`);
});
await boss.work<ResearchJob>(RESEARCH_QUEUE, async ([job]) => {
  console.log(`researching ${job.data.board}`);
  await researchCompany(job.data.board);
  console.log(`researched ${job.data.board}`);
});
await boss.work(REFRESH_QUEUE, async () => {
  console.log("refreshing jobs");
  const r = await refreshJobs((line) => console.log(`  ${line}`));
  console.log(`refreshed: ${r.added} new jobs, ${r.embedded} embedded, scoring queued for ${r.users} users`);
});

if (REFRESH_CRON === "off") {
  await boss.unschedule(REFRESH_QUEUE);
  console.log("daily refresh off (REFRESH_CRON=off)");
} else {
  // missed: "once" — a laptop asleep (or a worker stopped) at the scheduled time catches up with
  // one run when it's back, instead of skipping the day.
  await boss.schedule(REFRESH_QUEUE, REFRESH_CRON, null, { tz, missed: "once" });
  console.log(`daily refresh scheduled: "${REFRESH_CRON}" (${tz})`);
}
console.log(`worker listening on ${SCORE_QUEUE}, ${RESEARCH_QUEUE}, ${REFRESH_QUEUE}`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await boss.stop(); // graceful: waits for the active job up to pg-boss's stop timeout
    process.exit(0);
  });
}
