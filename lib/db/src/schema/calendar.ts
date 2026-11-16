import { pgTable, text, integer, boolean, timestamp, date, jsonb, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./foundation";
import { calendarProgramsTable } from "./calendar-programs";
export const calendarEventsTable = pgTable("calendar_events", {
  id: text("id").primaryKey(), title: text("title").notNull(), program: text("program").notNull().default(""),
  programId: text("program_id").references(() => calendarProgramsTable.id),
  planningYear: integer("planning_year").notNull(), planningMonth: integer("planning_month"),
  startDate: date("start_date"), endDate: date("end_date"),
  allDay: boolean("all_day").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }), endsAt: timestamp("ends_at", { withTimezone: true }),
  location: text("location").notNull().default(""),
  dateStatus: text("date_status", { enum: ["proposed", "confirmed", "tbd", "cancelled"] }).notNull().default("proposed"),
  locationStatus: text("location_status", { enum: ["proposed", "confirmed", "tbd", "not_applicable"] }).notNull().default("tbd"),
  audience: text("audience").array().notNull().default(sql`'{}'::text[]`),
  wixUrl: text("wix_url").notNull().default(""), notes: text("notes").notNull().default(""),
  ownerId: text("owner_id").references(() => usersTable.id),
  sourceId: text("source_id"), sourceUrl: text("source_url"), sourceData: jsonb("source_data"),
  version: integer("version").notNull().default(1), deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  check("calendar_month_check", sql`${t.planningMonth} is null or ${t.planningMonth} between 1 and 12`),
  uniqueIndex("calendar_source_id_idx").on(t.sourceId),
  check("calendar_dates_check", sql`(${t.startDate} is null and ${t.endDate} is null and ${t.startsAt} is null and ${t.endsAt} is null) or (${t.startDate} is not null and ${t.endDate} >= ${t.startDate} and ((${t.allDay} and ${t.startsAt} is null and ${t.endsAt} is null) or (not ${t.allDay} and ${t.startsAt} is not null and ${t.endsAt} > ${t.startsAt})))`),
  check("calendar_date_status_check", sql`${t.dateStatus} in ('proposed','confirmed','tbd','cancelled')`),
  check("calendar_location_status_check", sql`${t.locationStatus} in ('proposed','confirmed','tbd','not_applicable')`),
]);
export const calendarSubscriptionsTable = pgTable("calendar_subscriptions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => usersTable.id),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("calendar_subscription_user_idx").on(t.userId),
  uniqueIndex("calendar_subscription_hash_idx").on(t.tokenHash),
]);
export const insertCalendarEventSchema = createInsertSchema(calendarEventsTable).omit({ createdAt: true, updatedAt: true });
