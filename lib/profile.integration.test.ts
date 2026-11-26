import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { jobs, matches, profiles } from "@/db/schema";
import { addUser, reset } from "@/test/db";
import { fillProfileFromResume } from "./profile";
import type { Progress } from "./progress";

vi.mock("@/db", () => import("@/test/db"));
const events: Progress[] = [];
vi.mock("./progress", () => ({ notify: async (p: Progress) => void events.push(p) }));
// The model's answer; the real mergeExtracted decides what it may change.
vi.mock("./resume-profile", async (original) => ({
  ...(await original<typeof import("./resume-profile")>()),
  extractProfile: async () => ({
    headline: "Frontend engineer",
    location: "Pune, India",
    yearsExperience: 1,
    skills: ["React", "Kubernetes"], // Kubernetes isn't in the resume text, so it must not be added
    targetRoles: ["Frontend Engineer"],
  }),
}));

const RESUME = "Intern at Acme: built dashboards in React and TypeScript.";
const profile = async () => (await db.select().from(profiles).where(eq(profiles.userId, "u1")))[0];

beforeEach(async () => {
  await reset();
  events.length = 0;
  await addUser("u1");
});

describe("fillProfileFromResume", () => {
  it("fills empty fields, adds only skills the resume contains, keeps what the user typed", async () => {
    await db.insert(profiles).values({ userId: "u1", headline: "My own headline", skills: ["TypeScript"], resumeText: RESUME });
    expect(await fillProfileFromResume("u1")).toEqual(["location", "years of experience", "1 skills", "target roles"]);
    expect(await profile()).toMatchObject({
      headline: "My own headline",
      location: "Pune, India",
      yearsExperience: 1,
      skills: ["TypeScript", "React"],
      targetRoles: ["Frontend Engineer"],
    });
    expect(events.map((e) => e.state)).toEqual(["running", "finished"]);
    expect(events.at(-1)).toMatchObject({ kind: "profile", userId: "u1", filled: ["location", "years of experience", "1 skills", "target roles"] });
  });

  it("drops old scores only when it changed something", async () => {
    const [{ id: jobId }] = await db
      .insert(jobs)
      .values({ source: "greenhouse", board: "acme", externalId: "1", company: "Acme", title: "Role", url: "https://acme.test/1", description: "d" })
      .returning({ id: jobs.id });
    const score = { userId: "u1", jobId, score: 70, reason: "", matchedSkills: [], missingSkills: [], model: "m" };
    await db.insert(profiles).values({
      userId: "u1", headline: "h", location: "l", yearsExperience: 1, skills: ["React"], targetRoles: ["r"], resumeText: RESUME,
    });
    await db.insert(matches).values(score);
    expect(await fillProfileFromResume("u1")).toEqual([]); // nothing left to fill
    expect(await db.select().from(matches)).toHaveLength(1);
  });

  it("fails without a resume, so the page can say so", async () => {
    await db.insert(profiles).values({ userId: "u1" });
    await expect(fillProfileFromResume("u1")).rejects.toThrow("no resume");
    expect(events.at(-1)).toMatchObject({ kind: "profile", state: "failed" });
  });
});
