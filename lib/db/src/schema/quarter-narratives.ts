import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { cyclesTable, usersTable } from "./foundation";
export const quarterNarrativesTable=pgTable("quarter_narratives",{
  cycleId:text("cycle_id").notNull().references(()=>cyclesTable.id),
  quarter:text("quarter").notNull(),
  narrative:text("narrative").notNull().default(""),
  version:integer("version").notNull().default(1),
  updatedBy:text("updated_by").notNull().references(()=>usersTable.id),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[primaryKey({columns:[t.cycleId,t.quarter]})]);
