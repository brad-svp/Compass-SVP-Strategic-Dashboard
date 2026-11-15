CREATE TABLE "systems" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"how_used" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"used_by_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"owner_id" text,
	"category" text DEFAULT '' NOT NULL,
	"cadence" text DEFAULT '' NOT NULL,
	"access_instructions" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "systems_status_check" CHECK ("systems"."status" in ('active','retired'))
);
--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;