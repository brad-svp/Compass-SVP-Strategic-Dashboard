CREATE TABLE "accountability_seats" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"owner_id" text,
	"person_name" text DEFAULT '' NOT NULL,
	"role_label" text DEFAULT '' NOT NULL,
	"capacity" text DEFAULT '' NOT NULL,
	"responsibilities" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"parent_id" text,
	"shared_seat" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accountability_kind_check" CHECK ("accountability_seats"."kind" in ('board','leadership','function')),
	CONSTRAINT "accountability_not_self_check" CHECK ("accountability_seats"."parent_id" is null or "accountability_seats"."parent_id" <> "accountability_seats"."id")
);
--> statement-breakpoint
ALTER TABLE "accountability_seats" ADD CONSTRAINT "accountability_seats_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountability_seats" ADD CONSTRAINT "accountability_seats_parent_id_accountability_seats_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."accountability_seats"("id") ON DELETE no action ON UPDATE no action;