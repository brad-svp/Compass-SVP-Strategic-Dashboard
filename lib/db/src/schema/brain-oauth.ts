import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./foundation";
export const brainOAuthClients = pgTable("brain_oauth_clients", {
  id: text("id").primaryKey(), metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
});
export const brainOAuthRequests = pgTable("brain_oauth_requests", {
  id: text("id").primaryKey(), clientId: text("client_id").notNull(), redirectUri: text("redirect_uri").notNull(),
  challenge: text("challenge").notNull(), state: text("state"), scopes: text("scopes").array().notNull(), resource: text("resource").notNull(),
  actorId: text("actor_id").references(() => usersTable.id), codeHash: text("code_hash"), consumedAt: timestamp("consumed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const brainOAuthGrants = pgTable("brain_oauth_grants", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull().references(() => usersTable.id), clientId: text("client_id").notNull(),
  scopes: text("scopes").array().notNull(), resource: text("resource").notNull(), revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
export const brainOAuthTokens = pgTable("brain_oauth_tokens", {
  hash: text("hash").primaryKey(), grantId: text("grant_id").notNull().references(() => brainOAuthGrants.id),
  kind: text("kind").notNull(), consumedAt: timestamp("consumed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
