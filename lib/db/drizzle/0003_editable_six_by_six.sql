CREATE TABLE "six_items" (
	"id" text PRIMARY KEY NOT NULL,
	"moment_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "six_items_status_check" CHECK ("six_items"."status" in ('planned','in_progress','blocked','done'))
);
--> statement-breakpoint
ALTER TABLE "major_moments" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "six_items" ADD CONSTRAINT "six_items_moment_id_major_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."major_moments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "six_items" ADD CONSTRAINT "six_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "six_items_moment_idx" ON "six_items" USING btree ("moment_id");--> statement-breakpoint
CREATE INDEX "six_items_owner_idx" ON "six_items" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moments_period_position_idx" ON "major_moments" USING btree ("period_id","position");