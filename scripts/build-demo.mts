// Builds the demo snapshot from the real database: demo/pgdata.tar.gz (PGlite data dir) and
// demo/embeddings.json (recorded query embeddings). Needs Postgres and Ollama; run demo-seed.mts first.
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { mkdirSync, writeFileSync } from "node:fs";
import { client, db } from "../db";
import { user } from "../db/auth-schema";
import * as schema from "../db/schema";
import { applications, companyResearch, jobs, matches, profiles } from "../db/schema";
import { DEMO, DEMO_QUERIES, DEMO_USER_ID } from "../lib/demo";
import { embed, recordingKey } from "../lib/embed";
import { profileQuery } from "../lib/match";
import { searchJobs } from "../lib/search";

if (DEMO) throw new Error("Unset DEMO_MODE: this reads from the real database.");
const PER_COMPANY = 40;

const [demoUser] = await db.select().from(user).where(eq(user.id, DEMO_USER_ID));
const [profile] = await db.select().from(profiles).where(eq(profiles.userId, DEMO_USER_ID));
if (!demoUser || !profile) throw new Error("No demo candidate yet: run scripts/demo-seed.mts and the worker first.");
const scored = await db.select().from(matches).where(eq(matches.userId, DEMO_USER_ID));
console.log(`demo candidate has ${scored.length} scored matches`);

// Record every embedding the demo will ask for, and collect the jobs those queries return.
const recorded: Record<string, number[]> = {};
const record = async (text: string) => {
  const [v] = await embed([text], "search_query");
  recorded[recordingKey("search_query", text)] = v;
};
await record(profileQuery(profile));
const jobIds = new Set(scored.map((m) => m.jobId));
for (const q of DEMO_QUERIES) {
  await record(q);
  for (const j of (await searchJobs(q, 1, 25)).rows) jobIds.add(j.id);
}
for (const board of new Set((await db.selectDistinct({ board: jobs.board }).from(jobs)).map((r) => r.board))) {
  const recent = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.board, board), isNull(jobs.closedAt), isNotNull(jobs.embedding)))
    .orderBy(desc(jobs.postedAt))
    .limit(PER_COMPANY);
  recent.forEach((r) => jobIds.add(r.id));
}

const lite = new PGlite({ extensions: { vector } });
const demo = drizzle({ client: lite, schema, casing: "snake_case" });
await migrate(demo, { migrationsFolder: "db/migrations" });

const ids = [...jobIds];
for (let i = 0; i < ids.length; i += 200) {
  await demo.insert(jobs).values(await db.select().from(jobs).where(inArray(jobs.id, ids.slice(i, i + 200))));
}
await demo.insert(user).values(demoUser);
await demo.insert(profiles).values(profile);
if (scored.length) await demo.insert(matches).values(scored);
const briefs = await db.select().from(companyResearch);
if (briefs.length) await demo.insert(companyResearch).values(briefs);

// A started board, so the tracker isn't empty on first visit.
const best = [...scored].sort((a, b) => b.score - a.score);
const board: [number, "saved" | "applied" | "interviewing"][] = [[0, "interviewing"], [1, "applied"], [2, "saved"], [3, "saved"]];
for (const [i, status] of board) if (best[i]) await demo.insert(applications).values({ userId: DEMO_USER_ID, jobId: best[i].jobId, status });

mkdirSync("demo", { recursive: true });
const dump = await lite.dumpDataDir("gzip");
writeFileSync("demo/pgdata.tar.gz", Buffer.from(await dump.arrayBuffer()));
writeFileSync("demo/embeddings.json", JSON.stringify(recorded) + "\n");
console.log(`snapshot: ${ids.length} jobs, ${briefs.length} briefs, ${Object.keys(recorded).length} recorded embeddings, ${(dump.size / 1e6).toFixed(1)} MB`);

await lite.close();
await client.end();
