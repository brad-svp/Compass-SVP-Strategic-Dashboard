CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"program" text DEFAULT '' NOT NULL,
	"planning_year" integer NOT NULL,
	"start_date" date,
	"end_date" date,
	"all_day" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"location" text DEFAULT '' NOT NULL,
	"date_status" text DEFAULT 'proposed' NOT NULL,
	"location_status" text DEFAULT 'tbd' NOT NULL,
	"audience" text[] DEFAULT '{}'::text[] NOT NULL,
	"wix_url" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"owner_id" text,
	"source_id" text,
	"source_url" text,
	"source_data" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_dates_check" CHECK (("calendar_events"."start_date" is null and "calendar_events"."end_date" is null and "calendar_events"."starts_at" is null and "calendar_events"."ends_at" is null) or ("calendar_events"."start_date" is not null and "calendar_events"."end_date" >= "calendar_events"."start_date" and (("calendar_events"."all_day" and "calendar_events"."starts_at" is null and "calendar_events"."ends_at" is null) or (not "calendar_events"."all_day" and "calendar_events"."starts_at" is not null and "calendar_events"."ends_at" > "calendar_events"."starts_at")))),
	CONSTRAINT "calendar_date_status_check" CHECK ("calendar_events"."date_status" in ('proposed','confirmed','tbd','cancelled')),
	CONSTRAINT "calendar_location_status_check" CHECK ("calendar_events"."location_status" in ('proposed','confirmed','tbd','not_applicable'))
);
--> statement-breakpoint
CREATE TABLE "calendar_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_source_id_idx" ON "calendar_events" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_subscription_user_idx" ON "calendar_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_subscription_hash_idx" ON "calendar_subscriptions" USING btree ("token_hash");