import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { applicationDetails, applications, jobs } from "@/db/schema";
import { addUser, reset } from "@/test/db";
import { moveApplication, saveDetails, trackJob, untrackJob } from "./actions";

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

describe("tracker details", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const details = async (userId: string) =>
    (await db.select().from(applicationDetails).where(and(eq(applicationDetails.userId, userId), eq(applicationDetails.jobId, jobId))))[0] ?? null;

  it("saves notes and dates for the user's own card only", async () => {
    await trackJob(jobId);
    expect(await saveDetails(jobId, null, form({ nextStep: "Phone screen", followUpOn: "2026-12-01", notes: "Referred by Sam" }))).toEqual({ ok: true });
    expect(await details("alice")).toMatchObject({ nextStep: "Phone screen", followUpOn: "2026-12-01", notes: "Referred by Sam", appliedOn: null });

    signedIn = "bob"; // not on bob's board
    expect(await saveDetails(jobId, null, form({ notes: "mine now" }))).toEqual({ error: "That job isn't on your board any more." });
    expect(await details("bob")).toBeNull();
    expect((await details("alice"))?.notes).toBe("Referred by Sam");
  });

  it("rejects a bad date without saving", async () => {
    await trackJob(jobId);
    expect(await saveDetails(jobId, null, form({ followUpOn: "next week" }))).toHaveProperty("error");
    expect(await details("alice")).toBeNull();
  });

  it("records the applied date on the first move to Applied, never overwriting one the user set", async () => {
    await trackJob(jobId);
    await moveApplication(jobId, "applied");
    expect((await details("alice"))?.appliedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await saveDetails(jobId, null, form({ appliedOn: "2026-11-01" }));
    await moveApplication(jobId, "saved");
    await moveApplication(jobId, "applied");
    expect((await details("alice"))?.appliedOn).toBe("2026-11-01");
  });

  it("keeps notes through Remove and Undo", async () => {
    await trackJob(jobId);
    await saveDetails(jobId, null, form({ notes: "Keep me" }));
    await untrackJob(jobId);
    await trackJob(jobId, "saved");
    expect((await details("alice"))?.notes).toBe("Keep me");
  });
});
