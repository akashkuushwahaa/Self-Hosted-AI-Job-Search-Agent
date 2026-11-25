// A real Postgres (PGlite, in-process WASM, with pgvector) migrated from db/migrations, for
// integration tests. Each test file swaps it in for the app's database:
//
//   vi.mock("@/db", () => import("@/test/db"));
//
// so lib/ and app/ code runs unchanged against it. No Docker, no server.
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { user } from "@/db/auth-schema";
import * as schema from "@/db/schema";

const pglite = new PGlite({ extensions: { vector } });
export const db = drizzle({ client: pglite, schema, casing: "snake_case" });
await migrate(db, { migrationsFolder: "db/migrations" });

// Stand-in for the postgres.js client: only lib/progress.ts touches it (NOTIFY), and tests don't listen.
export const client = { notify: async () => {}, listen: async () => ({ unlisten: async () => {} }), end: async () => {} };

export async function reset() {
  await db.execute(sql`truncate table jobs, "user" cascade`);
}

export async function addUser(id: string) {
  await db.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  return id;
}

// A 768-dim unit-ish vector pointing mostly along `axis`, tilted `tilt` toward `axis + 1`.
// Cosine distance between axis(0) and axis(0, t) grows with t; axis(0) and axis(1) are 1 apart.
export function axis(i: number, tilt = 0) {
  const v = new Array(768).fill(0);
  v[i] = 1;
  v[i + 1] = tilt;
  return v;
}
