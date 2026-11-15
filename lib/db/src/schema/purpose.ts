import { pgTable, text, integer, timestamp, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export type SvpValueRecord = { id: string; title: string; description: string };
export const organizationPurposeTable = pgTable("organization_purpose", {
  id: text("id").primaryKey(),
  mission: text("mission").notNull().default(""),
  vision: text("vision").notNull().default(""),
  values: jsonb("values").$type<SvpValueRecord[]>().notNull().default(sql`'[]'::jsonb`),
  sourceUrls: text("source_urls").array().notNull().default(sql`'{}'::text[]`),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("organization_purpose_singleton_check", sql`${t.id} = 'svp'`)]);
