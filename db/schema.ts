import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";
import type { Dossier } from "../lib/dossier";
import { STATUSES } from "../lib/tracker";
import { user } from "./auth-schema";

export * from "./auth-schema";

// Jobs are public listings, shared by every user. Per-user data (scores, tracker) will reference them.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    source: text({ enum: ["greenhouse", "lever", "ashby"] }).notNull(),
    board: text().notNull(),
    externalId: text().notNull(),
    company: text().notNull(),
    title: text().notNull(),
    location: text(),
    url: text().notNull(),
    description: text().notNull(),
    postedAt: timestamp({ withTimezone: true }),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Set when the board stops listing the job; kept rather than deleted so user data survives.
    closedAt: timestamp({ withTimezone: true }),
    // nomic-embed-text; null until `npm run embed`, and reset when title or description changes.
    // shortcut: no HNSW index, exact scan is a few ms at ~10k rows; add one past ~100k.
    embedding: vector({ dimensions: 768 }),
  },
  (t) => [
    uniqueIndex("jobs_source_board_external_key").on(t.source, t.board, t.externalId),
    index("jobs_posted_idx").on(t.postedAt.desc()),
    index("jobs_fts_idx").using("gin", sql`to_tsvector('english', ${t.title} || ' ' || ${t.description})`),
  ],
);

export const profiles = pgTable("profiles", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  headline: text(),
  location: text(),
  yearsExperience: integer(),
  skills: text().array().notNull().default(sql`'{}'`),
  targetRoles: text().array().notNull().default(sql`'{}'`),
  // Only the extracted text is kept: matching needs text, not the PDF.
  resumeText: text(),
  resumeFileName: text(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// The profile's search vector, so /jobs and /matches don't call Ollama on every page load.
// Its own table rather than a profiles column, so the demo snapshot (which has no such column)
// keeps working; the demo replays recorded embeddings instead.
export const profileEmbeddings = pgTable("profile_embeddings", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // Hash of the embed model and the exact text embedded: any profile edit, change to profileQuery
  // or model switch gives a new key, so a stale vector is never used and nothing has to clear it.
  key: text().notNull(),
  embedding: vector({ dimensions: 768 }).notNull(),
});

// What the user notes about a tracked job. Keyed by user and job rather than tied to the
// applications row, so notes survive Remove and Undo. Its own table, not applications columns,
// so the demo snapshot (which predates it) keeps working.
export const applicationDetails = pgTable(
  "application_details",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    appliedOn: date(),
    nextStep: text(),
    followUpOn: date(),
    notes: text(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] })],
);

// When the user last looked at /matches, for "N new since your last visit" after the daily run.
// Its own table for the same reason as profile_embeddings: the demo snapshot predates it.
export const matchesSeen = pgTable("matches_seen", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  seenAt: timestamp({ withTimezone: true }).notNull(),
});

// LLM fit scores. Deleted whenever the user's profile changes, so a score always reflects the current profile.
export const matches = pgTable(
  "matches",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    score: integer().notNull(),
    reason: text().notNull(),
    matchedSkills: text().array().notNull(),
    missingSkills: text().array().notNull(),
    model: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] })],
);

// One brief per company, shared by every user; refreshed when older than a week.
export const companyResearch = pgTable("company_research", {
  board: text().primaryKey(), // the company's board slug in lib/companies.ts
  dossier: jsonb().$type<Dossier>().notNull(),
  sources: text().array().notNull(),
  model: text().notNull(),
  researchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// The user's application tracker: one card per job they saved.
export const applications = pgTable(
  "applications",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text({ enum: STATUSES }).notNull().default("saved"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] })],
);
