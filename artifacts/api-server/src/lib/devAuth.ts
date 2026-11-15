import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { db, usersTable, areasTable, auditLogTable } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { AppError } from "./permissions";

// Ephemeral, process-local signing key. Restarts invalidate every shortcut session.
const signingKey = randomBytes(32);
export const devCookie = "__Host-svp-dev";
export const devCookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 8 * 60 * 60 * 1000 };
const identities = { admin: "svp-dev-admin", staff: "svp-dev-staff" } as const;

export function devAuthEnabled(req: Pick<Request, "headers">, env = process.env) {
  return env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT &&
    !!env.REPLIT_DEV_DOMAIN && env.REPLIT_DEV_DOMAIN.endsWith(".replit.dev") &&
    getClerkProxyHost(req) === env.REPLIT_DEV_DOMAIN;
}

export function createDevCookie(id: string) {
  const payload = Buffer.from(JSON.stringify({ id, expires: Date.now() + devCookieOptions.maxAge })).toString("base64url");
  return `${payload}.${createHmac("sha256", signingKey).update(payload).digest("base64url")}`;
}

export function readDevCookie(cookie: string | undefined) {
  try {
    const value = cookie?.split(";").map(c => c.trim()).find(c => c.startsWith(`${devCookie}=`))?.slice(devCookie.length + 1);
    if (!value) return null;
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const expected = createHmac("sha256", signingKey).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!Number.isFinite(data.expires) || data.expires <= Date.now() || !Object.values(identities).includes(data.id)) return null;
    return data.id as string;
  } catch { return null; }
}

export async function getDevActor(req: Pick<Request, "headers">) {
  if (!devAuthEnabled(req)) return null;
  const id = readDevCookie(req.headers.cookie);
  if (!id) return null;
  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  const role = id === identities.admin ? "admin" : "staff";
  // Never use a real person's account or accept an edited/elevated test identity.
  return actor?.active && actor.role === role && !actor.email && !actor.clerkId ? actor : null;
}

export async function ensureDevActor(role: "admin" | "staff") {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const id = identities[role];
    let [actor] = await tx.select().from(usersTable).where(eq(usersTable.id, id));
    if (!actor) {
      const [area] = await tx.select().from(areasTable).orderBy(asc(areasTable.sortOrder)).limit(1);
      if (!area) throw new AppError(503, "The workspace is not ready for development login.");
      [actor] = await tx.insert(usersTable).values({
        id, name: role === "admin" ? "Development Admin" : "Development Staff",
        role, areaId: area.id, roleDescription: "Development-only quick-login test identity.",
      }).returning();
      await tx.insert(auditLogTable).values({
        id: randomUUID(), actorId: id, action: "create", entityType: "staff", entityId: id,
        after: actor, via: "web",
      });
    }
    if (!actor.active || actor.role !== role || actor.email || actor.clerkId) {
      throw new AppError(403, "This development identity was changed or disabled. Ask an admin to review it.");
    }
    await tx.insert(auditLogTable).values({
      id: randomUUID(), actorId: id, action: "dev_login", entityType: "staff", entityId: id,
      after: { role, developmentOnly: true }, via: "web",
    });
    return actor;
  });
}
