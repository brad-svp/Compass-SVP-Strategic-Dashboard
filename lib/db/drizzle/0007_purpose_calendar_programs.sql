CREATE TABLE "organization_purpose" (
	"id" text PRIMARY KEY NOT NULL,
	"mission" text DEFAULT '' NOT NULL,
	"vision" text DEFAULT '' NOT NULL,
	"values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_purpose_singleton_check" CHECK ("organization_purpose"."id" = 'svp')
);
--> statement-breakpoint
CREATE TABLE "calendar_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_logo_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"pending_path" text NOT NULL,
	"object_path" text,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "program_id" text;--> statement-breakpoint
ALTER TABLE "calendar_programs" ADD CONSTRAINT "calendar_programs_logo_id_program_logo_uploads_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."program_logo_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_logo_uploads" ADD CONSTRAINT "program_logo_uploads_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_programs_name_idx" ON "calendar_programs" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_program_id_calendar_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."calendar_programs"("id") ON DELETE no action ON UPDATE no action;