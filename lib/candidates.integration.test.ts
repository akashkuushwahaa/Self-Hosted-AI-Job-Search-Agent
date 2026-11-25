import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { profileEmbeddings, profiles } from "@/db/schema";
import { addUser, axis, reset } from "@/test/db";
import { getProfile, profileVector } from "./candidates";

vi.mock("@/db", () => import("@/test/db"));
let calls = 0;
vi.mock("./embed", () => ({ EMBED_MODEL: "test-model", embed: async () => [axis(++calls)] }));

beforeEach(async () => {
  await reset();
  calls = 0;
  await addUser("u1");
  await db.insert(profiles).values({ userId: "u1", headline: "Frontend engineer", skills: ["React"] });
});

describe("profileVector", () => {
  it("embeds once, then serves the cached vector", async () => {
    const profile = (await getProfile("u1"))!;
    const first = await profileVector(profile);
    expect(await profileVector(profile)).toEqual(first);
    expect(calls).toBe(1);
    expect(await db.select().from(profileEmbeddings)).toHaveLength(1);
  });

  it("re-embeds after the profile text changes, and keeps one row per user", async () => {
    const profile = (await getProfile("u1"))!;
    const before = await profileVector(profile);
    const after = await profileVector({ ...profile, skills: ["React", "GraphQL"] });
    expect(after).not.toEqual(before);
    expect(calls).toBe(2);
    expect(await db.select().from(profileEmbeddings)).toHaveLength(1);
  });

  it("is removed with the user", async () => {
    await profileVector((await getProfile("u1"))!);
    await reset();
    expect(await db.select().from(profileEmbeddings)).toHaveLength(0);
  });
});
