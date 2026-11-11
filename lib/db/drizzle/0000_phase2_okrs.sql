CREATE TABLE "areas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "areas_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"via" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cycles_date_check" CHECK ("cycles"."end_date" >= "cycles"."start_date"),
	CONSTRAINT "cycles_status_check" CHECK ("cycles"."status" in ('planning','active','closed'))
);
--> statement-breakpoint
CREATE TABLE "major_moments" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"event_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moments_position_check" CHECK ("major_moments"."position" between 1 and 6)
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"meeting_date" date,
	"meeting_notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"email" text,
	"name" text NOT NULL,
	"avatar_url" text,
	"role" text DEFAULT 'staff' NOT NULL,
	"area_id" text NOT NULL,
	"role_description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('admin','staff'))
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" text PRIMARY KEY NOT NULL,
	"key_result_id" text NOT NULL,
	"author_id" text NOT NULL,
	"measurement_type" text NOT NULL,
	"value" double precision,
	"confidence" double precision,
	"note" text NOT NULL,
	"progress" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_in_values_check" CHECK (("check_ins"."measurement_type"='metric' and "check_ins"."value" is not null and "check_ins"."confidence" is null) or ("check_ins"."measurement_type"='confidence' and "check_ins"."confidence" between 0 and 100 and "check_ins"."confidence" is not null and "check_ins"."value" is null))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_results" (
	"id" text PRIMARY KEY NOT NULL,
	"objective_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"measurement_type" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"start_value" double precision DEFAULT 0 NOT NULL,
	"target_value" double precision DEFAULT 100 NOT NULL,
	"current_value" double precision,
	"confidence" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kr_measurement_check" CHECK ("key_results"."measurement_type" in ('metric','confidence')),
	CONSTRAINT "kr_target_check" CHECK ("key_results"."target_value" <> "key_results"."start_value"),
	CONSTRAINT "kr_confidence_check" CHECK ("key_results"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" text PRIMARY KEY NOT NULL,
	"cycle_id" text NOT NULL,
	"level" text NOT NULL,
	"owner_id" text NOT NULL,
	"area_id" text NOT NULL,
	"parent_objective_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"time_scope" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"ai_drafted" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objective_level_check" CHECK ("objectives"."level" in ('company','individual')),
	CONSTRAINT "objective_status_check" CHECK ("objectives"."status" in ('draft','active','closed')),
	CONSTRAINT "objective_scope_check" CHECK ("objectives"."time_scope" in ('annual','Q1','Q2','Q3','Q4')),
	CONSTRAINT "objective_alignment_check" CHECK (("objectives"."level"='company' and "objectives"."time_scope"='annual' and "objectives"."parent_objective_id" is null) or ("objectives"."level"='individual' and "objectives"."parent_objective_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "major_moments" ADD CONSTRAINT "major_moments_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_key_result_id_key_results_id_fk" FOREIGN KEY ("key_result_id") REFERENCES "public"."key_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_parent_objective_id_objectives_id_fk" FOREIGN KEY ("parent_objective_id") REFERENCES "public"."objectives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_ins_kr_idx" ON "check_ins" USING btree ("key_result_id");--> statement-breakpoint
CREATE INDEX "comments_entity_idx" ON "comments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "key_results_objective_idx" ON "key_results" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "objectives_cycle_idx" ON "objectives" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "objectives_owner_idx" ON "objectives" USING btree ("owner_id");