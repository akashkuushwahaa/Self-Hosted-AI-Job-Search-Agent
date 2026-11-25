import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { applications, jobs } from "@/db/schema";
import { userApplications } from "@/lib/applications";
import { addUser, reset } from "@/test/db";
import { as, resetCookies } from "@/test/next";
import { moveApplication, trackJob, untrackJob } from "./actions";

vi.mock("@/db", () => import("@/test/db"));
vi.mock("@/lib/demo", async (original) => ({ ...(await original<typeof import("@/lib/demo")>()), DEMO: true }));
vi.mock("next/headers", () => import("@/test/next"));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/lib/session", () => ({ requireUser: async () => ({ id: "demo" }) }));

let saved: string, other: string;
const board = async () => (await userApplications("demo")).map((a) => `${a.jobId === saved ? "saved-job" : "other-job"}:${a.status}`);

beforeEach(async () => {
  await reset();
  resetCookies();
  await addUser("demo");
  const job = (id: string) => ({ source: "greenhouse" as const, board: "acme", externalId: id, company: "Acme", title: id, url: `https://acme.test/${id}`, description: "d" });
  [{ id: saved }, { id: other }] = await db.insert(jobs).values([job("1"), job("2")]).returning({ id: jobs.id });
  await db.insert(applications).values({ userId: "demo", jobId: saved, status: "saved" }); // the snapshot's board
});

describe("demo tracker: every visitor is the same user", () => {
  it("keeps each visitor's changes to themselves and never writes the shared database", async () => {
    as("visitor A");
    await moveApplication(saved, "applied");
    await trackJob(other);
    expect(await board()).toEqual(["saved-job:applied", "other-job:saved"]);

    as("visitor B");
    expect(await board()).toEqual(["saved-job:saved"]);
    await untrackJob(saved);
    expect(await board()).toEqual([]);

    as("visitor A");
    expect(await board()).toEqual(["saved-job:applied", "other-job:saved"]);
    expect(await db.select({ status: applications.status }).from(applications)).toEqual([{ status: "saved" }]);
  });
});
