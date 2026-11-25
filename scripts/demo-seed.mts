// Prepares the demo candidate in the real database, then queues their scoring and a few company briefs.
// Run with the worker up; build-demo.mts later snapshots the results into PGlite.
import { client, db } from "../db";
import { user } from "../db/auth-schema";
import { profiles } from "../db/schema";
import { personas } from "../evals/match/personas";
import { DEMO_EMAIL, DEMO_USER_ID } from "../lib/demo";
import { getBoss, RESEARCH_QUEUE, SCORE_QUEUE } from "../lib/queue";

const BRIEFS = ["vercel", "razorpaysoftwareprivatelimited", "linear", "supabase", "sarvam"];

await db.insert(user).values({ id: DEMO_USER_ID, name: "Demo candidate", email: DEMO_EMAIL }).onConflictDoNothing();
const profile = personas["intern-frontend-india"];
await db
  .insert(profiles)
  .values({ userId: DEMO_USER_ID, ...profile, resumeFileName: "demo-resume.pdf" })
  .onConflictDoUpdate({ target: profiles.userId, set: { ...profile } });

const boss = await getBoss();
console.log("score job", await boss.send(SCORE_QUEUE, { userId: DEMO_USER_ID }, { singletonKey: DEMO_USER_ID }));
for (const board of BRIEFS) console.log(board, await boss.send(RESEARCH_QUEUE, { board, userId: DEMO_USER_ID }, { singletonKey: board }));
await boss.stop({ graceful: false });
await client.end();
