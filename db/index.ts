import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEMO } from "../lib/demo";
import * as schema from "./schema";

if (!DEMO && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set; copy .env.example to .env");

// postgres.js connects on first query only. Demo mode never queries it: every LISTEN/NOTIFY path is off there.
// On globalThis, like the PGlite instance and pg-boss, so Next dev's hot reload reuses one pool
// instead of opening a new one on every edit.
const g = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
export const client = (g.pgClient ??= postgres(process.env.DATABASE_URL ?? "postgres://demo-mode-unused@localhost/none"));
const postgresDb = drizzle({ client, schema, casing: "snake_case" });

// Demo: Postgres compiled to WASM, loaded from the committed snapshot. One instance per process
// (on globalThis), so pages, server actions and route handlers all see the same in-memory data.
function demoDb() {
  const g = globalThis as unknown as { demoDb?: ReturnType<typeof drizzlePglite<typeof schema>> };
  g.demoDb ??= drizzlePglite({
    client: new PGlite({
      extensions: { vector },
      loadDataDir: new Blob([readFileSync(join(process.cwd(), "demo", "pgdata.tar.gz"))]),
    }),
    schema,
    casing: "snake_case",
  });
  return g.demoDb;
}

// Both are Drizzle Postgres databases with the same query API; the cast lets callers stay driver-agnostic.
export const db = DEMO ? (demoDb() as unknown as typeof postgresDb) : postgresDb;
