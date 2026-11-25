import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { applications, jobs } from "@/db/schema";
import { addUser, reset } from "@/test/db";
import { moveApplication, trackJob, untrackJob } from "./actions";

vi.mock("@/db", () => import("@/test/db"));
vi.mock("next/cache", () => ({ refresh: () => {} }));
let signedIn = "alice";
vi.mock("@/lib/session", () => ({ requireUser: async () => ({ id: signedIn }) }));

let jobId: string;
const status = async (userId: string) =>
  (await db.select({ status: applications.status }).from(applications).where(and(eq(applications.userId, userId), eq(applications.jobId, jobId))))[0]
    ?.status ?? null;

beforeEach(async () => {
  await reset();
  await addUser("alice");
  await addUser("bob");
  [{ id: jobId }] = await db
    .insert(jobs)
    .values({ source: "greenhouse", board: "acme", externalId: "1", company: "Acme", title: "Role", url: "https://acme.test/1", description: "d" })
    .returning({ id: jobs.id });
  signedIn = "alice";
});

describe("tracker actions", () => {
  it("track, move and untrack the signed-in user's card", async () => {
    expect(await trackJob(jobId)).toEqual({});
    expect(await status("alice")).toBe("saved");
    expect(await moveApplication(jobId, "interviewing")).toEqual({});
    expect(await status("alice")).toBe("interviewing");
    expect(await untrackJob(jobId)).toEqual({});
    expect(await status("alice")).toBeNull();
  });

  it("undo puts a removed card back with its old status", async () => {
    await trackJob(jobId);
    await moveApplication(jobId, "offer");
    await untrackJob(jobId);
    await trackJob(jobId, "offer");
    expect(await status("alice")).toBe("offer");
  });

  it("never touches another user's card", async () => {
    await trackJob(jobId);
    await moveApplication(jobId, "applied");
    signedIn = "bob";
    expect(await moveApplication(jobId, "rejected")).toEqual({ error: "That job isn't on your board any more." });
    await untrackJob(jobId);
    expect(await status("alice")).toBe("applied");
    expect(await status("bob")).toBeNull();
  });

  it("returns errors for bad input instead of throwing", async () => {
    expect(await trackJob("not-a-uuid")).toHaveProperty("error");
    expect(await trackJob("00000000-0000-4000-8000-000000000000")).toEqual({ error: "This job no longer exists." });
    await trackJob(jobId);
    expect(await moveApplication(jobId, "hired")).toHaveProperty("error");
    expect(await status("alice")).toBe("saved");
  });
});
