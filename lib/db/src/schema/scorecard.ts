import { pgTable, text, integer, boolean, timestamp, date, doublePrecision, check, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable, areasTable } from "./foundation";
import { keyResultsTable } from "./okrs";

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
