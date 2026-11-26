import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, matches } from "@/db/schema";
import { getProfile, topCandidates } from "./candidates";
import { CHAT_MODEL } from "./llm";
import { scoreMatch, type MatchJob } from "./match";
import { notify } from "./progress";

type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

async function scoreAndStore(userId: string, profile: Profile, job: MatchJob & { id: string }) {
  const m = await scoreMatch(profile, job);
  await db
    .insert(matches)
    .values({
      userId,
      jobId: job.id,
      score: m.score,
      reason: m.reason,
      matchedSkills: m.matchedSkills,
      missingSkills: m.missingSkills,
      model: CHAT_MODEL,
    })
    .onConflictDoNothing();
}

// Scores every unscored job in the user's top candidates, announcing progress after each one.
export async function scoreUnscored(userId: string) {
  try {
    const profile = await getProfile(userId);
    if (!profile) throw new Error("no profile");
    const todo = (await topCandidates(userId, profile)).filter((c) => c.score == null);

    let done = 0;
    await notify({ kind: "score", userId, done, total: todo.length, state: "running" });
    for (const job of todo) {
      try {
        await scoreAndStore(userId, profile, job);
      } catch (e) {
        console.error(`scoring ${job.id} failed`, e); // one bad response shouldn't sink the run
      }
      await notify({ kind: "score", userId, done: ++done, total: todo.length, state: "running" });
    }
    await notify({ kind: "score", userId, done, total: todo.length, state: "finished" });
  } catch (e) {
    await notify({ kind: "score", userId, done: 0, total: 0, state: "failed" });
    throw e; // let pg-boss record the failure and retry
  }
}

// Scores one job the user asked about from its page, whether or not it's among their top candidates.
export async function scoreOne(userId: string, jobId: string) {
  const progress = (state: "running" | "finished" | "failed", done = 0) => notify({ kind: "score", userId, jobId, done, total: 1, state });
  try {
    const profile = await getProfile(userId);
    if (!profile) throw new Error("no profile");
    const [job] = await db
      .select({ id: jobs.id, title: jobs.title, company: jobs.company, location: jobs.location, description: jobs.description })
      .from(jobs)
      .where(eq(jobs.id, jobId));
    if (!job) throw new Error(`no job ${jobId}`);
    const [existing] = await db.select({ score: matches.score }).from(matches).where(and(eq(matches.userId, userId), eq(matches.jobId, jobId)));
    if (!existing) {
      await progress("running");
      await scoreAndStore(userId, profile, job);
    }
    await progress("finished", 1);
  } catch (e) {
    await progress("failed");
    throw e;
  }
}
