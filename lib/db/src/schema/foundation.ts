import { pgTable, text, integer, boolean, timestamp, date, jsonb, check, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const areasTable = pgTable("areas", {
  id: text("id").primaryKey(), name: text("name").notNull().unique(),
  color: text("color").notNull(), sortOrder: integer("sort_order").notNull().default(0), ...timestamps(),
});
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), clerkId: text("clerk_id").unique(),
  email: text("email").unique(), name: text("name").notNull(), avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
  areaId: text("area_id").notNull().references(() => areasTable.id),
  roleDescription: text("role_description").notNull().default(""), active: boolean("active").notNull().default(true),
  ...timestamps(),
}, (t) => [check("users_role_check", sql`${t.role} in ('admin','staff')`)]);
export const cyclesTable = pgTable("cycles", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  startDate: date("start_date").notNull(), endDate: date("end_date").notNull(),
  status: text("status", { enum: ["planning", "active", "closed"] }).notNull().default("planning"),
  ...timestamps(),
}, (t) => [
  check("cycles_date_check", sql`${t.endDate} >= ${t.startDate}`),
  check("cycles_status_check", sql`${t.status} in ('planning','active','closed')`),
]);
export const periodsTable = pgTable("periods", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  startDate: date("start_date").notNull(), endDate: date("end_date").notNull(),
  meetingDate: date("meeting_date"), meetingNotes: text("meeting_notes").notNull().default(""),
  status: text("status", { enum: ["draft", "active", "closed"] }).notNull().default("draft"), ...timestamps(),
});
export const majorMomentsTable = pgTable("major_moments", {
  id: text("id").primaryKey(), periodId: text("period_id").notNull().references(() => periodsTable.id),
  version: integer("version").notNull().default(1),
  position: integer("position").notNull(), title: text("title").notNull().default(""),
  eventDate: date("event_date"), ...timestamps(),
}, (t) => [check("moments_position_check", sql`${t.position} between 1 and 6`), uniqueIndex("moments_period_position_idx").on(t.periodId, t.position)]);
export const auditLogTable = pgTable("audit_log", {
  id: text("id").primaryKey(), actorId: text("actor_id").references(() => usersTable.id),
  action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(),
  before: jsonb("before"), after: jsonb("after"), via: text("via", { enum: ["web", "mcp"] }).notNull(),
  ...timestamps(),
});
export const insertAreaSchema = createInsertSchema(areasTable).omit({ createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export const insertCycleSchema = createInsertSchema(cyclesTable).omit({ createdAt: true, updatedAt: true });
