// Exports your thumbs up/down on match scores as labeled pairs in the eval's format, so real
// judgments can grow the eval set: up → "good", down → "poor".
//
//   npm run eval:feedback -- you@example.com      (or SHORTLIST_USER_EMAIL)
//
// The output holds your profile and resume text, so it goes to a git-ignored file
// (evals/match/feedback.local.json). Review the pairs before merging any into pairs.json.
import { and, eq, isNotNull } from "drizzle-orm";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, db } from "../../db";
import { user } from "../../db/auth-schema";
import { jobFeedback, jobs, profiles } from "../../db/schema";

const email = process.argv[2] ?? process.env.SHORTLIST_USER_EMAIL;
if (!email) throw new Error("Pass the email you sign in with, or set SHORTLIST_USER_EMAIL.");
const [account] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
if (!account) throw new Error(`No user with email ${email}`);
const [profile] = await db.select().from(profiles).where(eq(profiles.userId, account.id));
if (!profile) throw new Error("That user has no profile yet.");

const rated = await db
  .select({
    id: jobs.id, title: jobs.title, company: jobs.company, location: jobs.location, description: jobs.description,
    rating: jobFeedback.rating, ratedScore: jobFeedback.ratedScore,
  })
  .from(jobFeedback)
  .innerJoin(jobs, eq(jobs.id, jobFeedback.jobId))
  .where(and(eq(jobFeedback.userId, account.id), isNotNull(jobFeedback.rating)));

const persona = "you";
const out = {
  exportedAt: new Date().toISOString(),
  personas: {
    [persona]: {
      headline: profile.headline, location: profile.location, yearsExperience: profile.yearsExperience,
      skills: profile.skills, targetRoles: profile.targetRoles, resumeText: profile.resumeText ?? "",
    },
  },
  pairs: rated.map(({ rating, ratedScore, ...job }) => ({
    persona,
    job,
    label: rating === 1 ? "good" : "poor",
    note: `you rated the model's score of ${ratedScore} ${rating === 1 ? "right" : "wrong"}`,
    ratedScore,
  })),
};
const file = join("evals", "match", "feedback.local.json");
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`${out.pairs.length} rated pairs → ${file} (git-ignored: it contains your profile)`);
await client.end();
