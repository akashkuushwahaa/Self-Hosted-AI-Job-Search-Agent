CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"board" text NOT NULL,
	"external_id" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"url" text NOT NULL,
	"description" text NOT NULL,
	"posted_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_board_external_key" ON "jobs" USING btree ("source","board","external_id");--> statement-breakpoint
CREATE INDEX "jobs_posted_idx" ON "jobs" USING btree ("posted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_fts_idx" ON "jobs" USING gin (to_tsvector('english', "title" || ' ' || "description"));