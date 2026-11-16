CREATE TABLE "brain_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"version" integer NOT NULL,
	"file_id" text,
	"label" text NOT NULL,
	"page" integer,
	"text" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"model" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"program_id" text,
	"area_id" text,
	"owner_id" text NOT NULL,
	"author_id" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visibility" text DEFAULT 'staff' NOT NULL,
	"review_status" text DEFAULT 'unreviewed' NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"conflict" text DEFAULT '' NOT NULL,
	"merged_into_id" text,
	"review_interval_days" integer DEFAULT 90 NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewer_id" text,
	"review_due_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"via" text DEFAULT 'web' NOT NULL,
	"request_key" text,
	"index_status" text DEFAULT 'pending' NOT NULL,
	"indexed_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_files" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"pending_path" text NOT NULL,
	"object_path" text,
	"replaces_id" text,
	"expected_version" integer NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"error" text,
	"pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"review_interval_days" integer DEFAULT 90 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"file_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_oauth_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"client_id" text NOT NULL,
	"scopes" text[] NOT NULL,
	"resource" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "brain_oauth_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"challenge" text NOT NULL,
	"state" text,
	"scopes" text[] NOT NULL,
	"resource" text NOT NULL,
	"actor_id" text,
	"code_hash" text,
	"consumed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_oauth_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"kind" text NOT NULL,
	"consumed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brain_chunks" ADD CONSTRAINT "brain_chunks_entry_id_brain_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."brain_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_chunks" ADD CONSTRAINT "brain_chunks_file_id_brain_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."brain_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_entries" ADD CONSTRAINT "brain_entries_program_id_calendar_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."calendar_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_entries" ADD CONSTRAINT "brain_entries_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_entries" ADD CONSTRAINT "brain_entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_entries" ADD CONSTRAINT "brain_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_entries" ADD CONSTRAINT "brain_entries_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_files" ADD CONSTRAINT "brain_files_entry_id_brain_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."brain_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_files" ADD CONSTRAINT "brain_files_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_jobs" ADD CONSTRAINT "brain_jobs_entry_id_brain_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."brain_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_versions" ADD CONSTRAINT "brain_versions_entry_id_brain_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."brain_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_versions" ADD CONSTRAINT "brain_versions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_oauth_grants" ADD CONSTRAINT "brain_oauth_grants_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_oauth_requests" ADD CONSTRAINT "brain_oauth_requests_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_oauth_tokens" ADD CONSTRAINT "brain_oauth_tokens_grant_id_brain_oauth_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."brain_oauth_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brain_chunk_entry_idx" ON "brain_chunks" USING btree ("entry_id","version");--> statement-breakpoint
CREATE INDEX "brain_vector_idx" ON "brain_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "brain_chunk_fts_idx" ON "brain_chunks" USING gin (to_tsvector('english', "text"));--> statement-breakpoint
CREATE UNIQUE INDEX "brain_request_key_idx" ON "brain_entries" USING btree ("author_id","request_key");--> statement-breakpoint
CREATE INDEX "brain_search_idx" ON "brain_entries" USING gin (to_tsvector('english', "title" || ' ' || "summary" || ' ' || "content"));--> statement-breakpoint
CREATE INDEX "brain_review_idx" ON "brain_entries" USING btree ("review_status","review_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "brain_job_version_idx" ON "brain_jobs" USING btree ("entry_id","version");--> statement-breakpoint
CREATE INDEX "brain_job_claim_idx" ON "brain_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "brain_version_idx" ON "brain_versions" USING btree ("entry_id","version");