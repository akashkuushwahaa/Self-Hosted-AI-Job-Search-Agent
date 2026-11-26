import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { jobs, profiles, tailoredApplications } from "@/db/schema";
import { addUser, reset } from "@/test/db";
import type { Progress } from "./progress";
import { tailorApplication } from "./tailor";

vi.mock("@/db", () => import("@/test/db"));
const events: Progress[] = [];
vi.mock("./progress", () => ({ notify: async (p: Progress) => void events.push(p) }));
vi.mock("./llm", () => ({
  CHAT_MODEL: "test-model",
  generateJson: async () => ({
    jobSkills: ["React", "Kubernetes"],
    summary: "React engineer. Runs Kubernetes clusters.",
    highlights: [{ point: "Built React dashboards", evidence: "built dashboards in React" }],
    coverLetter: "I built dashboards in React.",
  }),
}));

let jobId: string;
beforeEach(async () => {
  await reset();
  events.length = 0;
  await addUser("u1");
  [{ id: jobId }] = await db
    .insert(jobs)
    .values({ source: "greenhouse", board: "acme", externalId: "1", company: "Acme", title: "Frontend Engineer", url: "https://acme.test/1", description: "React, Kubernetes" })
    .returning({ id: jobs.id });
});

describe("tailorApplication", () => {
  it("stores the grounded version and tells the job page", async () => {
    await db.insert(profiles).values({ userId: "u1", skills: ["React"], resumeText: "Intern: built dashboards in React." });
    await tailorApplication("u1", jobId);
    const [row] = await db.select().from(tailoredApplications);
    expect(row).toMatchObject({ userId: "u1", jobId, model: "test-model" });
    expect(row.content).toEqual({
      summary: "React engineer.",
      highlights: [{ point: "Built React dashboards", evidence: "built dashboards in React" }],
      coverLetter: "I built dashboards in React.",
      removed: ["Runs Kubernetes clusters."],
    });
    expect(events.map((e) => e.state)).toEqual(["running", "finished"]);
  });

  it("writing again replaces it", async () => {
    await db.insert(profiles).values({ userId: "u1", skills: ["React"], resumeText: "Intern: built dashboards in React." });
    await tailorApplication("u1", jobId);
    await tailorApplication("u1", jobId);
    expect(await db.select().from(tailoredApplications)).toHaveLength(1);
  });

  it("needs a resume", async () => {
    await db.insert(profiles).values({ userId: "u1", skills: ["React"] });
    await expect(tailorApplication("u1", jobId)).rejects.toThrow("upload a resume first");
    expect(events.at(-1)).toMatchObject({ kind: "tailor", jobId, state: "failed" });
  });
});
