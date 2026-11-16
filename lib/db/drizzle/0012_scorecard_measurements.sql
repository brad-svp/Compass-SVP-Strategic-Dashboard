CREATE TABLE "scorecard_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"metric_id" text NOT NULL,
	"value" double precision,
	"note" text DEFAULT '' NOT NULL,
	"author_id" text NOT NULL,
	"unit" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_week_start" date,
	"legacy_revision_id" text,
	"legacy_reason" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "scorecard_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"metric_id" text NOT NULL,
	"due_date" date NOT NULL,
	"target" double precision NOT NULL,
	"upper_target" double precision
);
--> statement-breakpoint
ALTER TABLE "scorecard_metrics" ADD COLUMN "calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "scorecard_measurements" ADD CONSTRAINT "scorecard_measurements_metric_id_scorecard_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."scorecard_metrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_measurements" ADD CONSTRAINT "scorecard_measurements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_measurements" ADD CONSTRAINT "scorecard_measurements_legacy_revision_id_scorecard_revisions_id_fk" FOREIGN KEY ("legacy_revision_id") REFERENCES "public"."scorecard_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_measurements" ADD CONSTRAINT "scorecard_measurements_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_milestones" ADD CONSTRAINT "scorecard_milestones_metric_id_scorecard_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."scorecard_metrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scorecard_measurement_trend_idx" ON "scorecard_measurements" USING btree ("metric_id","recorded_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "scorecard_measurement_legacy_idx" ON "scorecard_measurements" USING btree ("legacy_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scorecard_milestone_date_idx" ON "scorecard_milestones" USING btree ("metric_id","due_date");--> statement-breakpoint
ALTER TABLE "scorecard_metrics" ADD CONSTRAINT "scorecard_metrics_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;