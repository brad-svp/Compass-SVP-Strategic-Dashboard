CREATE TABLE "staff_view_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"six_mode" text DEFAULT 'mine' NOT NULL,
	"six_staff_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_view_six_mode_check" CHECK ("staff_view_preferences"."six_mode" in ('mine','all','custom'))
);
--> statement-breakpoint
ALTER TABLE "staff_view_preferences" ADD CONSTRAINT "staff_view_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;