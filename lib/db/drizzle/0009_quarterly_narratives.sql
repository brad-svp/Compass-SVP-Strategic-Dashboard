CREATE TABLE "quarter_narratives" (
	"cycle_id" text NOT NULL,
	"quarter" text NOT NULL,
	"narrative" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quarter_narratives_cycle_id_quarter_pk" PRIMARY KEY("cycle_id","quarter")
);
--> statement-breakpoint
ALTER TABLE "quarter_narratives" ADD CONSTRAINT "quarter_narratives_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarter_narratives" ADD CONSTRAINT "quarter_narratives_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;