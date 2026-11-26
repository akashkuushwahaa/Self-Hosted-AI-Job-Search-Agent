CREATE TABLE "application_details" (
	"user_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"applied_on" date,
	"next_step" text,
	"follow_up_on" date,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_details_user_id_job_id_pk" PRIMARY KEY("user_id","job_id")
);
--> statement-breakpoint
ALTER TABLE "application_details" ADD CONSTRAINT "application_details_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_details" ADD CONSTRAINT "application_details_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;