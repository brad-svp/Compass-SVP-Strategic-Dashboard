CREATE TABLE "scorecard_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"metric_id" text NOT NULL,
	"week_start" date NOT NULL,
	"value" double precision,
	"note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"author_id" text NOT NULL,
	"direction" text NOT NULL,
	"target" double precision NOT NULL,
	"upper_target" double precision,
	"unit" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scorecard_week_monday_check" CHECK (extract(isodow from "scorecard_entries"."week_start") = 1)
);
--> statement-breakpoint
CREATE TABLE "scorecard_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"owner_id" text NOT NULL,
	"area_id" text NOT NULL,
	"direction" text NOT NULL,
	"target" double precision NOT NULL,
	"upper_target" double precision,
	"unit" text DEFAULT '' NOT NULL,
	"decimals" integer DEFAULT 0 NOT NULL,
	"linked_key_result_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scorecard_metric_direction_check" CHECK ("scorecard_metrics"."direction" in ('at_least','at_most','range')),
	CONSTRAINT "scorecard_metric_range_check" CHECK (("scorecard_metrics"."direction" = 'range' and "scorecard_metrics"."upper_target" is not null and "scorecard_metrics"."upper_target" >= "scorecard_metrics"."target") or ("scorecard_metrics"."direction" <> 'range' and "scorecard_metrics"."upper_target" is null)),
	CONSTRAINT "scorecard_metric_decimals_check" CHECK ("scorecard_metrics"."decimals" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "scorecard_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"version" integer NOT NULL,
	"value" double precision,
	"note" text NOT NULL,
	"reason" text NOT NULL,
	"author_id" text NOT NULL,
	"direction" text NOT NULL,
	"target" double precision NOT NULL,
	"upper_target" double precision,
	"unit" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "objectives" DROP CONSTRAINT "objective_alignment_check";--> statement-breakpoint
ALTER TABLE "scorecard_entries" ADD CONSTRAINT "scorecard_entries_metric_id_scorecard_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."scorecard_metrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_entries" ADD CONSTRAINT "scorecard_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_metrics" ADD CONSTRAINT "scorecard_metrics_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_metrics" ADD CONSTRAINT "scorecard_metrics_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_metrics" ADD CONSTRAINT "scorecard_metrics_linked_key_result_id_key_results_id_fk" FOREIGN KEY ("linked_key_result_id") REFERENCES "public"."key_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_revisions" ADD CONSTRAINT "scorecard_revisions_entry_id_scorecard_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."scorecard_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_revisions" ADD CONSTRAINT "scorecard_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scorecard_metric_week_idx" ON "scorecard_entries" USING btree ("metric_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "scorecard_revision_version_idx" ON "scorecard_revisions" USING btree ("entry_id","version");--> statement-breakpoint
CREATE INDEX "scorecard_revision_entry_idx" ON "scorecard_revisions" USING btree ("entry_id");--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objective_alignment_check" CHECK (("objectives"."level"='company' and "objectives"."parent_objective_id" is null) or ("objectives"."level"='individual' and "objectives"."parent_objective_id" is not null));