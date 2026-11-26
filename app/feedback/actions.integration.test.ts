import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { jobFeedback, jobs, matches, profiles } from "@/db/schema";
import { getProfile, topCandidates } from "@/lib/candidates";
import { searchJobs } from "@/lib/search";
import { addUser, axis, reset } from "@/test/db";
import { rateMatch, setHidden } from "./actions";

vi.mock("@/db", () => import("@/test/db"));
let signedIn = "alice";
vi.mock("@/lib/session", () => ({ requireUser: async () => ({ id: signedIn }) }));
vi.mock("@/lib/embed", () => ({ EMBED_MODEL: "test", embed: async () => [axis(0)] }));

let a: string;
const titles = (rows: { title: string }[]) => rows.map((r) => r.title).sort();

beforeEach(async () => {
  await reset();
  signedIn = "alice";
  await addUser("alice");
  await addUser("bob");
  await db.insert(profiles).values([{ userId: "alice", skills: ["React"] }, { userId: "bob", skills: ["React"] }]);
  const job = (id: string, title: string) => ({
    source: "greenhouse" as const, board: "acme", externalId: id, company: "Acme", title, url: `https://acme.test/${id}`,
    description: `${title} with React`, embedding: axis(0, Number(id) / 10),
  });
  [{ id: a }] = await db.insert(jobs).values([job("1", "Frontend Engineer"), job("2", "Frontend Developer")]).returning({ id: jobs.id });
});

describe("Not interested", () => {
  it("hides the job from every search path and from For you, for that user only", async () => {
    expect(await setHidden(a, true)).toEqual({});
    const fit = { vector: axis(0), userId: "alice" };
    expect(titles((await searchJobs("", 1, 10, { viewer: "alice" })).rows)).toEqual(["Frontend Developer"]);
    expect(titles((await searchJobs("", 1, 10, { fit })).rows)).toEqual(["Frontend Developer"]);
    expect(titles((await searchJobs("frontend", 1, 10, { viewer: "alice" })).rows)).toEqual(["Frontend Developer"]);
    expect(titles(await topCandidates("alice", (await getProfile("alice"))!))).toEqual(["Frontend Developer"]);
    // bob, and a signed-out visitor, still see both
    expect(titles(await topCandidates("bob", (await getProfile("bob"))!))).toEqual(["Frontend Developer", "Frontend Engineer"]);
    expect((await searchJobs("", 1, 10)).total).toBe(2);
  });

  it("undoes", async () => {
    await setHidden(a, true);
    await setHidden(a, false);
    expect((await searchJobs("", 1, 10, { viewer: "alice" })).total).toBe(2);
  });

  it("rejects a job that doesn't exist", async () => {
    expect(await setHidden("00000000-0000-4000-8000-000000000000", true)).toEqual({ error: "This job no longer exists." });
  });
});

describe("rating a score", () => {
  const feedback = async () => (await db.select().from(jobFeedback).where(and(eq(jobFeedback.userId, "alice"), eq(jobFeedback.jobId, a))))[0];

  it("needs a score, and keeps the score as it was when rated", async () => {
    expect(await rateMatch(a, 1)).toEqual({ error: "There's no score to rate yet." });
    await db.insert(matches).values({ userId: "alice", jobId: a, score: 64, reason: "", matchedSkills: [], missingSkills: [], model: "m" });
    expect(await rateMatch(a, -1)).toEqual({});
    await db.delete(matches); // a profile edit deletes scores; the rated pair survives
    expect(await feedback()).toMatchObject({ rating: -1, ratedScore: 64, hidden: false });
  });

  it("clears with 0 and rejects other values", async () => {
    await db.insert(matches).values({ userId: "alice", jobId: a, score: 80, reason: "", matchedSkills: [], missingSkills: [], model: "m" });
    await rateMatch(a, 1);
    await rateMatch(a, 0);
    expect(await feedback()).toMatchObject({ rating: null, ratedScore: null });
    expect(await rateMatch(a, 5)).toHaveProperty("error");
  });
});
