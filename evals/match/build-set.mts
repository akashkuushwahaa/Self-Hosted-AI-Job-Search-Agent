// Snapshots eval pairs: per persona, the 10 nearest open jobs plus 6 seeded-random ones.
// Labels are filled in by hand afterwards; rerunning overwrites pairs.json.
import { writeFileSync } from "node:fs";
import { and, cosineDistance, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { client, db } from "../../db";
import { jobs } from "../../db/schema";
import { embed } from "../../lib/embed";
import { profileQuery } from "../../lib/match";
import { personas } from "./personas";

const cols = { id: jobs.id, title: jobs.title, company: jobs.company, location: jobs.location, description: jobs.description };
const open = and(isNull(jobs.closedAt), isNotNull(jobs.embedding));
const pairs = [];

for (const [persona, profile] of Object.entries(personas)) {
  const [v] = await embed([profileQuery(profile)], "search_query");
  const near = await db.select(cols).from(jobs).where(open).orderBy(cosineDistance(jobs.embedding, v)).limit(10);
  const random = await db
    .select(cols)
    .from(jobs)
    .where(and(open, notInArray(jobs.id, near.map((j) => j.id))))
    .orderBy(sql`md5(${jobs.id}::text || ${persona})`)
    .limit(6);
  for (const job of [...near, ...random]) {
    pairs.push({ persona, job: { ...job, description: job.description.slice(0, 6000) }, label: null, note: "" });
  }
}

writeFileSync(new URL("./pairs.json", import.meta.url), JSON.stringify(pairs, null, 2) + "\n");
console.log(`wrote ${pairs.length} pairs`);
await client.end();
