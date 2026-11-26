import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { axis, reset } from "@/test/db";
import type { BoardJob } from "./boards";
import { embedPending } from "./embed-jobs";
import { ingestAll } from "./ingest";

vi.mock("@/db", () => import("@/test/db"));
vi.mock("./companies", () => ({ companies: [{ source: "greenhouse", board: "acme", name: "Acme", site: "https://acme.test" }] }));
// The board's current listing; `null` makes the fetch fail like an outage.
let listing: BoardJob[] | null = [];
vi.mock("./boards", async (original) => ({
  ...(await original<typeof import("./boards")>()),
  fetchBoard: async () => {
    if (!listing) throw new Error("HTTP 503");
    return listing;
  },
}));
const embedded: string[] = [];
vi.mock("./embed", async (original) => ({
  ...(await original<typeof import("./embed")>()),
  embed: async (texts: string[]) => {
    embedded.push(...texts);
    return texts.map(() => axis(0));
  },
}));

const posting = (id: string, changes: Partial<BoardJob> = {}): BoardJob => ({
  source: "greenhouse",
  board: "acme",
  externalId: id,
  company: "Acme",
  title: `Role ${id}`,
  location: "Bengaluru",
  url: `https://acme.test/${id}`,
  description: `About role ${id}.`,
  postedAt: null,
  ...changes,
});

const quiet = () => {};
const state = async () =>
  Object.fromEntries(
    (await db.select({ id: jobs.externalId, closedAt: jobs.closedAt, embedding: jobs.embedding }).from(jobs)).map((j) => [
      j.id,
      { open: j.closedAt == null, embedded: j.embedding != null },
    ]),
  );

beforeEach(async () => {
  await reset();
  embedded.length = 0;
  listing = [posting("1"), posting("2"), posting("3")];
  await ingestAll(quiet);
  await db.update(jobs).set({ embedding: axis(0) }); // as if `embed` had run
});

describe("ingestAll", () => {
  it("counts new jobs and leaves unchanged ones (and their embeddings) alone", async () => {
    listing = [posting("1"), posting("2"), posting("3"), posting("4")];
    expect(await ingestAll(quiet)).toEqual({ boards: 1, failed: 0, added: 1 });
    expect(await state()).toEqual({
      1: { open: true, embedded: true },
      2: { open: true, embedded: true },
      3: { open: true, embedded: true },
      4: { open: true, embedded: false },
    });
  });

  it("closes jobs the board stopped listing, keeps their embedding, and reopens them if they come back", async () => {
    listing = [posting("1"), posting("2")];
    await ingestAll(quiet);
    expect((await state())[3]).toEqual({ open: false, embedded: true });

    listing = [posting("1"), posting("2"), posting("3")];
    await ingestAll(quiet);
    expect((await state())[3]).toEqual({ open: true, embedded: true });
  });

  it("clears the embedding only when the embedded text changed", async () => {
    listing = [
      posting("1", { description: "A rewritten description." }),
      posting("2", { location: "Remote - India" }),
      posting("3", { url: "https://acme.test/3?moved", postedAt: new Date() }), // not part of the embedded text
    ];
    await ingestAll(quiet);
    expect(await state()).toEqual({
      1: { open: true, embedded: false },
      2: { open: true, embedded: false },
      3: { open: true, embedded: true },
    });
  });

  it("never closes jobs when the board fetch fails", async () => {
    listing = null;
    expect(await ingestAll(quiet)).toMatchObject({ failed: 1, added: 0 });
    expect(Object.values(await state()).every((j) => j.open)).toBe(true);
  });
});

describe("embedPending", () => {
  it("embeds open jobs without an embedding, and nothing else", async () => {
    listing = [posting("1", { title: "Retitled" }), posting("2")]; // 1 changed, 3 closed
    await ingestAll(quiet);
    await db.update(jobs).set({ embedding: null }).where(eq(jobs.externalId, "3")); // closed and unembedded
    expect(await embedPending(quiet)).toBe(1);
    expect(embedded).toHaveLength(1);
    expect(embedded[0]).toContain("Retitled at Acme (Bengaluru)");
    expect(await embedPending(quiet)).toBe(0);
  });
});
