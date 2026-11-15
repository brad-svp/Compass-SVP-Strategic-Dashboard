import { pgTable, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./foundation";
export const programLogoUploadsTable = pgTable("program_logo_uploads", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull().references(() => usersTable.id),
  pendingPath: text("pending_path").notNull(),
  objectPath: text("object_path"),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  ready: boolean("ready").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const calendarProgramsTable = pgTable("calendar_programs", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  logoId: text("logo_id").references(() => programLogoUploadsTable.id),
  active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("calendar_programs_name_idx").on(sql`lower(${t.name})`)]);
