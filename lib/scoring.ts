import { db } from "@/db";
import { matches } from "@/db/schema";
import { getProfile, topCandidates } from "./candidates";
import { CHAT_MODEL } from "./llm";
import { scoreMatch } from "./match";
import { notify } from "./progress";

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
