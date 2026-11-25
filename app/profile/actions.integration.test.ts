import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "@/db/auth-schema";
import { applications, jobs, matches, matchesSeen, profileEmbeddings, profiles } from "@/db/schema";
import { addUser, axis, db, reset } from "@/test/db"; // the same database the @/db mock serves
import { deleteAccount } from "./actions";

vi.mock("@/db", () => import("@/test/db"));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
const signOut = vi.fn(async () => {});
vi.mock("@/lib/auth", () => ({ auth: { api: { signOut: () => signOut() } } }));
vi.mock("@/lib/session", () => ({ requireUser: async () => ({ id: "alice", email: "alice@example.test" }) }));

const confirm = (text: string) => {
  const form = new FormData();
  form.set("confirm", text);
  return form;
};

// Every row any table holds for this user.
async function rowsFor(userId: string) {
  const { rows } = await db.execute<{ n: number }>(sql`
    select (select count(*) from ${profiles} where user_id = ${userId})
         + (select count(*) from ${profileEmbeddings} where user_id = ${userId})
         + (select count(*) from ${matchesSeen} where user_id = ${userId})
         + (select count(*) from ${matches} where user_id = ${userId})
         + (select count(*) from ${applications} where user_id = ${userId})
         + (select count(*) from ${session} where user_id = ${userId})
         + (select count(*) from "user" where id = ${userId}) as n`);
  return Number(rows[0].n);
}

beforeEach(async () => {
  await reset();
  redirect.mockClear();
  signOut.mockClear();
  const [{ id: jobId }] = await db
    .insert(jobs)
    .values({ source: "greenhouse", board: "acme", externalId: "1", company: "Acme", title: "Role", url: "https://acme.test/1", description: "d" })
    .returning({ id: jobs.id });
  for (const id of ["alice", "bob"]) {
    await addUser(id);
    await db.insert(profiles).values({ userId: id, skills: ["React"], resumeText: "resume" });
    await db.insert(profileEmbeddings).values({ userId: id, key: "k", embedding: axis(0) });
    await db.insert(matchesSeen).values({ userId: id, seenAt: new Date() });
    await db.insert(matches).values({ userId: id, jobId, score: 80, reason: "", matchedSkills: [], missingSkills: [], model: "m" });
    await db.insert(applications).values({ userId: id, jobId });
    await db.insert(session).values({ id: `s-${id}`, userId: id, token: `t-${id}`, expiresAt: new Date(Date.now() + 1e9), createdAt: new Date(), updatedAt: new Date() });
  }
});

describe("deleteAccount", () => {
  it("deletes every row of the signed-in user, signs them out, and leaves everyone else alone", async () => {
    expect(await rowsFor("alice")).toBe(7);
    await deleteAccount(null, confirm(" Alice@Example.test "));
    expect(await rowsFor("alice")).toBe(0);
    expect(await rowsFor("bob")).toBe(7);
    expect(await db.select().from(jobs).where(eq(jobs.externalId, "1"))).toHaveLength(1);
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("does nothing unless the email is typed to confirm", async () => {
    expect(await deleteAccount(null, confirm("bob@example.test"))).toEqual({ error: "Type your email exactly to confirm." });
    expect(await deleteAccount(null, confirm(""))).toHaveProperty("error");
    expect(await rowsFor("alice")).toBe(7);
    expect(signOut).not.toHaveBeenCalled();
  });
});
