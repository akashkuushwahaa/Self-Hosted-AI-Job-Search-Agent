import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {} // no .env in CI; DATABASE_URL comes from the environment

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
