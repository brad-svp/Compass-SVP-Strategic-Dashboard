import { pgTable, text, jsonb, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./foundation";

/** Personal UI configuration, deliberately excluded from MCP's business-data catalog. */
export const staffViewPreferencesTable = pgTable("staff_view_preferences", {
  userId: text("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  sixMode: text("six_mode", { enum: ["mine","all","custom"] }).notNull().default("mine"),
  sixStaffIds: jsonb("six_staff_ids").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("staff_view_six_mode_check", sql`${t.sixMode} in ('mine','all','custom')`)]);
