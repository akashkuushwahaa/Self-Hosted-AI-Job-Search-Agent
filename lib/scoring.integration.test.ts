import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { jobs, matches, profiles } from "@/db/schema";
import { addUser, reset } from "@/test/db";
import type { Progress } from "./progress";
import { scoreOne } from "./scoring";

vi.mock("@/db", () => import("@/test/db"));
const events: Progress[] = [];
vi.mock("./progress", () => ({ notify: async (p: Progress) => void events.push(p) }));
let calls = 0;
vi.mock("./match", () => ({
  scoreMatch: async () => (++calls, { score: 72, reason: "Good fit.", matchedSkills: ["React"], missingSkills: [] }),
}));

let jobId: string;
beforeEach(async () => {
  await reset();
  events.length = 0;
  calls = 0;
  await addUser("u1");
  await db.insert(profiles).values({ userId: "u1", skills: ["React"] });
  [{ id: jobId }] = await db
    .insert(jobs)
    .values({ source: "greenhouse", board: "acme", externalId: "1", company: "Acme", title: "Frontend Engineer", url: "https://acme.test/1", description: "React" })
    .returning({ id: jobs.id });
});

describe("scoreOne", () => {
  it("scores and stores the one job, with progress tagged by job", async () => {
    await scoreOne("u1", jobId);
    expect(await db.select({ score: matches.score, reason: matches.reason }).from(matches)).toEqual([{ score: 72, reason: "Good fit." }]);
    expect(events.map((e) => [e.kind === "score" && e.jobId, e.state])).toEqual([[jobId, "running"], [jobId, "finished"]]);
  });

  it("doesn't call the model again for a job already scored", async () => {
    await scoreOne("u1", jobId);
    await scoreOne("u1", jobId);
    expect(calls).toBe(1);
    expect(events.at(-1)).toMatchObject({ jobId, state: "finished" });
  });

  it("reports failure without a profile, so pg-boss can retry", async () => {
    await db.delete(profiles);
    await expect(scoreOne("u1", jobId)).rejects.toThrow("no profile");
    expect(events.at(-1)).toMatchObject({ jobId, state: "failed" });
  });
});
