import { pgTable, text, integer, boolean, timestamp, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./foundation";

export const accountabilitySeatsTable = pgTable("accountability_seats", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["board", "leadership", "function"] }).notNull(),
  ownerId: text("owner_id").references(() => usersTable.id),
  personName: text("person_name").notNull().default(""),
  roleLabel: text("role_label").notNull().default(""),
  capacity: text("capacity").notNull().default(""),
  responsibilities: text("responsibilities").array().notNull().default(sql`ARRAY[]::text[]`),
  parentId: text("parent_id").references((): AnyPgColumn => accountabilitySeatsTable.id),
  sharedSeat: boolean("shared_seat").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  check("accountability_kind_check", sql`${t.kind} in ('board','leadership','function')`),
  check("accountability_not_self_check", sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
]);
export const insertAccountabilitySeatSchema = createInsertSchema(accountabilitySeatsTable).omit({ createdAt: true, updatedAt: true });
