import { pgTable, text, integer, boolean, timestamp, doublePrecision, check, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { usersTable, areasTable, cyclesTable } from "./foundation";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const objectivesTable = pgTable("objectives", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => cyclesTable.id),
  level: text("level", { enum: ["company", "individual"] }).notNull(),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  areaId: text("area_id").notNull().references(() => areasTable.id),
  parentObjectiveId: text("parent_objective_id").references((): AnyPgColumn => objectivesTable.id),
  title: text("title").notNull(), description: text("description").notNull().default(""),
  timeScope: text("time_scope", { enum: ["annual", "Q1", "Q2", "Q3", "Q4"] }).notNull(),
  status: text("status", { enum: ["draft", "active", "closed"] }).notNull().default("draft"),
  aiDrafted: boolean("ai_drafted").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }), ...timestamps(),
}, t => [
  index("objectives_cycle_idx").on(t.cycleId), index("objectives_owner_idx").on(t.ownerId),
  check("objective_level_check", sql`${t.level} in ('company','individual')`),
  check("objective_status_check", sql`${t.status} in ('draft','active','closed')`),
  check("objective_scope_check", sql`${t.timeScope} in ('annual','Q1','Q2','Q3','Q4')`),
  check("objective_alignment_check", sql`(${t.level}='company' and ${t.parentObjectiveId} is null) or (${t.level}='individual' and ${t.parentObjectiveId} is not null)`),
]);
export const keyResultsTable = pgTable("key_results", {
  id: text("id").primaryKey(), objectiveId: text("objective_id").notNull().references(() => objectivesTable.id),
  ownerId: text("owner_id").notNull().references(() => usersTable.id), title: text("title").notNull(),
  measurementType: text("measurement_type", { enum: ["metric", "confidence"] }).notNull(),
  unit: text("unit").notNull().default(""), startValue: doublePrecision("start_value").notNull().default(0),
  targetValue: doublePrecision("target_value").notNull().default(100),
  currentValue: doublePrecision("current_value"), confidence: doublePrecision("confidence"),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }), ...timestamps(),
}, t => [
  index("key_results_objective_idx").on(t.objectiveId),
  check("kr_measurement_check", sql`${t.measurementType} in ('metric','confidence')`),
  check("kr_target_check", sql`${t.targetValue} <> ${t.startValue}`),
  check("kr_confidence_check", sql`${t.confidence} between 0 and 100`),
]);
export const checkInsTable = pgTable("check_ins", {
  id: text("id").primaryKey(), keyResultId: text("key_result_id").notNull().references(() => keyResultsTable.id),
  authorId: text("author_id").notNull().references(() => usersTable.id),
  measurementType: text("measurement_type", { enum: ["metric", "confidence"] }).notNull(),
  value: doublePrecision("value"), confidence: doublePrecision("confidence"),
  note: text("note").notNull(), progress: doublePrecision("progress").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index("check_ins_kr_idx").on(t.keyResultId),
  check("check_in_values_check", sql`(${t.measurementType}='metric' and ${t.value} is not null and ${t.confidence} is null) or (${t.measurementType}='confidence' and ${t.confidence} between 0 and 100 and ${t.confidence} is not null and ${t.value} is null)`),
]);
export const commentsTable = pgTable("comments", {
  id: text("id").primaryKey(), entityType: text("entity_type", { enum: ["objective", "key_result"] }).notNull(),
  entityId: text("entity_id").notNull(), authorId: text("author_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(), editedAt: timestamp("edited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("comments_entity_idx").on(t.entityType, t.entityId)]);
export const insertObjectiveSchema = createInsertSchema(objectivesTable).omit({ createdAt: true, updatedAt: true });
export const insertKeyResultSchema = createInsertSchema(keyResultsTable).omit({ createdAt: true, updatedAt: true });
export const insertCheckInSchema = createInsertSchema(checkInsTable).omit({ createdAt: true });
export const insertCommentSchema = createInsertSchema(commentsTable).omit({ createdAt: true });
