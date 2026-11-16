import { pgTable, text, integer, boolean, timestamp, date, doublePrecision, bigserial, check, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable, areasTable } from "./foundation";
import { keyResultsTable } from "./okrs";
import { calendarEventsTable } from "./calendar";

const goal = () => ({
  direction: text("direction", { enum: ["at_least", "at_most", "range"] }).notNull(),
  target: doublePrecision("target").notNull(),
  upperTarget: doublePrecision("upper_target"),
  unit: text("unit").notNull().default(""),
});
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const scorecardMetricsTable = pgTable("scorecard_metrics", {
  id: text("id").primaryKey(), title: text("title").notNull(),
  description: text("description").notNull().default(""),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  areaId: text("area_id").notNull().references(() => areasTable.id),
  ...goal(), decimals: integer("decimals").notNull().default(0),
  linkedKeyResultId: text("linked_key_result_id").references(() => keyResultsTable.id),
  calendarEventId: text("calendar_event_id").references(() => calendarEventsTable.id),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true), ...timestamps(),
}, t => [
  check("scorecard_metric_direction_check", sql`${t.direction} in ('at_least','at_most','range')`),
  check("scorecard_metric_range_check", sql`(${t.direction} = 'range' and ${t.upperTarget} is not null and ${t.upperTarget} >= ${t.target}) or (${t.direction} <> 'range' and ${t.upperTarget} is null)`),
  check("scorecard_metric_decimals_check", sql`${t.decimals} between 0 and 4`),
]);
export const scorecardEntriesTable = pgTable("scorecard_entries", {
  id: text("id").primaryKey(), metricId: text("metric_id").notNull().references(() => scorecardMetricsTable.id),
  weekStart: date("week_start").notNull(),
  value: doublePrecision("value"), note: text("note").notNull().default(""),
  version: integer("version").notNull().default(1),
  authorId: text("author_id").notNull().references(() => usersTable.id),
  ...goal(), ...timestamps(),
}, t => [
  uniqueIndex("scorecard_metric_week_idx").on(t.metricId, t.weekStart),
  check("scorecard_week_monday_check", sql`extract(isodow from ${t.weekStart}) = 1`),
]);
export const scorecardRevisionsTable = pgTable("scorecard_revisions", {
  id: text("id").primaryKey(), entryId: text("entry_id").notNull().references(() => scorecardEntriesTable.id),
  version: integer("version").notNull(), value: doublePrecision("value"),
  note: text("note").notNull(), reason: text("reason").notNull(),
  authorId: text("author_id").notNull().references(() => usersTable.id), ...goal(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("scorecard_revision_version_idx").on(t.entryId, t.version),
  index("scorecard_revision_entry_idx").on(t.entryId),
]);

export const scorecardMilestonesTable = pgTable("scorecard_milestones", {
  id:text("id").primaryKey(), metricId:text("metric_id").notNull().references(()=>scorecardMetricsTable.id),
  dueDate:date("due_date").notNull(), target:doublePrecision("target").notNull(), upperTarget:doublePrecision("upper_target"),
},t=>[uniqueIndex("scorecard_milestone_date_idx").on(t.metricId,t.dueDate)]);

export const scorecardMeasurementsTable = pgTable("scorecard_measurements", {
  sequence:bigserial("sequence",{mode:"number"}).notNull(),
  id:text("id").primaryKey(), metricId:text("metric_id").notNull().references(()=>scorecardMetricsTable.id),
  value:doublePrecision("value"), note:text("note").notNull().default(""),
  authorId:text("author_id").notNull().references(()=>usersTable.id), unit:text("unit").notNull(),
  recordedAt:timestamp("recorded_at",{withTimezone:true}).notNull().defaultNow(),
  sourceWeekStart:date("source_week_start"), legacyRevisionId:text("legacy_revision_id").references(()=>scorecardRevisionsTable.id),
  legacyReason:text("legacy_reason"), deletedAt:timestamp("deleted_at",{withTimezone:true}),
  deletedBy:text("deleted_by").references(()=>usersTable.id),
},t=>[
  index("scorecard_measurement_trend_idx").on(t.metricId,t.recordedAt,t.id),
  uniqueIndex("scorecard_measurement_legacy_idx").on(t.legacyRevisionId),
]);
