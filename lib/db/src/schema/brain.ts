import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex, vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable, areasTable } from "./foundation";
import { calendarProgramsTable } from "./calendar-programs";
export type BrainLink = { domain: string; id: string; label: string };
export type BrainPage = { text: string; label: string; page: number | null };
export const brainEntries = pgTable("brain_entries", {
  id: text("id").primaryKey(), title: text("title").notNull(), summary: text("summary").notNull().default(""),
  content: text("content").notNull().default(""), kind: text("kind").notNull(),
  programId: text("program_id").references(() => calendarProgramsTable.id), areaId: text("area_id").references(() => areasTable.id),
  ownerId: text("owner_id").notNull().references(() => usersTable.id), authorId: text("author_id").notNull().references(() => usersTable.id),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  sourceUrls: text("source_urls").array().notNull().default(sql`'{}'::text[]`),
  links: jsonb("links").$type<BrainLink[]>().notNull().default([]),
  visibility: text("visibility").notNull().default("staff"), reviewStatus: text("review_status").notNull().default("unreviewed"),
  retired: boolean("retired").notNull().default(false), conflict: text("conflict").notNull().default(""),
  mergedIntoId: text("merged_into_id"), reviewIntervalDays: integer("review_interval_days").notNull().default(90),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }), reviewerId: text("reviewer_id").references(() => usersTable.id),
  reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
  version: integer("version").notNull().default(1), via: text("via").notNull().default("web"),
  requestKey: text("request_key"), indexStatus: text("index_status").notNull().default("pending"), indexedVersion: integer("indexed_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("brain_request_key_idx").on(t.authorId, t.requestKey),
  index("brain_search_idx").using("gin", sql`to_tsvector('english', ${t.title} || ' ' || ${t.summary} || ' ' || ${t.content})`),
  index("brain_review_idx").on(t.reviewStatus, t.reviewDueAt),
]);
export const brainVersions = pgTable("brain_versions", {
  id: text("id").primaryKey(), entryId: text("entry_id").notNull().references(() => brainEntries.id),
  version: integer("version").notNull(), snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  fileIds: text("file_ids").array().notNull().default(sql`'{}'::text[]`),
  actorId: text("actor_id").notNull().references(() => usersTable.id), action: text("action").notNull(), note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("brain_version_idx").on(t.entryId, t.version)]);
export const brainFiles = pgTable("brain_files", {
  id: text("id").primaryKey(), entryId: text("entry_id").notNull().references(() => brainEntries.id),
  actorId: text("actor_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(), contentType: text("content_type").notNull(), size: integer("size").notNull(),
  pendingPath: text("pending_path").notNull(), objectPath: text("object_path"),
  replacesId: text("replaces_id"), expectedVersion: integer("expected_version").notNull(),
  status: text("status").notNull().default("uploading"), error: text("error"),
  pages: jsonb("pages").$type<BrainPage[]>().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const brainJobs = pgTable("brain_jobs", {
  id: text("id").primaryKey(), entryId: text("entry_id").notNull().references(() => brainEntries.id), version: integer("version").notNull(),
  status: text("status").notNull().default("pending"), attempts: integer("attempts").notNull().default(0),
  error: text("error"), availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("brain_job_version_idx").on(t.entryId, t.version), index("brain_job_claim_idx").on(t.status, t.availableAt)]);
export const brainChunks = pgTable("brain_chunks", {
  id: text("id").primaryKey(), entryId: text("entry_id").notNull().references(() => brainEntries.id), version: integer("version").notNull(),
  fileId: text("file_id").references(() => brainFiles.id), label: text("label").notNull(), page: integer("page"),
  text: text("text").notNull(), embedding: vector("embedding", { dimensions: 384 }).notNull(),
  model: text("model").notNull(),
}, t => [index("brain_chunk_entry_idx").on(t.entryId, t.version), index("brain_vector_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  index("brain_chunk_fts_idx").using("gin", sql`to_tsvector('english', ${t.text})`)]);
export const brainSettings = pgTable("brain_settings", {
  id: text("id").primaryKey(), reviewIntervalDays: integer("review_interval_days").notNull().default(90), version: integer("version").notNull().default(1),
});
