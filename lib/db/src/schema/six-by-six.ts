import { pgTable, text, integer, timestamp, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { majorMomentsTable, usersTable } from "./foundation";

export const sixItemsTable = pgTable("six_items", {
  id: text("id").primaryKey(),
  momentId: text("moment_id").notNull().references(() => majorMomentsTable.id),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["planned", "in_progress", "blocked", "done"] }).notNull().default("planned"),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  check("six_items_status_check", sql`${t.status} in ('planned','in_progress','blocked','done')`),
  index("six_items_moment_idx").on(t.momentId),
  index("six_items_owner_idx").on(t.ownerId),
]);
export const insertSixItemSchema = createInsertSchema(sixItemsTable).omit({ createdAt: true, updatedAt: true });
export type SixItemRow = typeof sixItemsTable.$inferSelect;
