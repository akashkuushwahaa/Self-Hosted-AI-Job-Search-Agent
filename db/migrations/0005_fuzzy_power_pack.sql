CREATE TABLE "company_research" (
	"board" text PRIMARY KEY NOT NULL,
	"dossier" jsonb NOT NULL,
	"sources" text[] NOT NULL,
	"model" text NOT NULL,
	"researched_at" timestamp with time zone DEFAULT now() NOT NULL
);
