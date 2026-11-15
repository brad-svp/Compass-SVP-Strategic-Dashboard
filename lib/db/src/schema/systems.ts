import { pgTable, text, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./foundation";

export const systemsTable = pgTable("systems", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  purpose: text("purpose").notNull().default(""),
  howUsed: text("how_used").notNull().default(""),
  audience: text("audience").notNull().default(""),
  usedByIds: text("used_by_ids").array().notNull().default(sql`'{}'::text[]`),
  ownerId: text("owner_id").references(() => usersTable.id),
  category: text("category").notNull().default(""),
  cadence: text("cadence").notNull().default(""),
  accessInstructions: text("access_instructions").notNull().default(""),
  status: text("status", { enum: ["active", "retired"] }).notNull().default("active"),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("systems_status_check", sql`${t.status} in ('active','retired')`)]);
export const insertSystemSchema = createInsertSchema(systemsTable).omit({ createdAt: true, updatedAt: true });
