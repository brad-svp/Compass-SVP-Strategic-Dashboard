import { randomUUID } from "node:crypto";
import { db, systemsTable, usersTable, auditLogTable } from "@workspace/db";
import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "./permissions";

export const systemInput = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(2000).refine(value => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !/[\r\n]/.test(value);
    } catch { return false; }
  }, "Use an HTTP or HTTPS link without embedded credentials."),
  purpose: z.string().max(4000), howUsed: z.string().max(8000), audience: z.string().max(2000),
  usedByIds: z.array(z.string().min(1)).max(100).transform(ids => [...new Set(ids)]),
  ownerId: z.string().min(1).nullable(), category: z.string().trim().max(100), cadence: z.string().trim().max(200),
  accessInstructions: z.string().max(4000), status: z.enum(["active", "retired"]),
  expectedVersion: z.number().int().min(0),
}).strict();
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function adminNow(tx: Tx, actor: StaffActor) {
  await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
  const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
  if (!current) throw new AppError(403, "Your staff access is no longer available.");
  requireAdmin(current);
  return current;
}
function requireVersion(expected: number, actual: number) {
  if (expected !== actual) throw new AppError(409, "This system changed while you were editing. Your draft was not saved. Reopen the latest version before saving again.");
}
export async function getSystemsOverview(actor: StaffActor) {
  const systems = await db.select().from(systemsTable).where(isNull(systemsTable.deletedAt)).orderBy(asc(systemsTable.name), asc(systemsTable.id));
  return { systems: systems.map(s => ({ ...s, expectedVersion: s.version, canEdit: actor.active && actor.role === "admin", createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })) };
}
export async function saveSvpSystem(actor: StaffActor, raw: unknown, id?: string) {
  const { expectedVersion, ...data } = systemInput.parse(raw);
  return db.transaction(async tx => {
    actor = await adminNow(tx, actor);
    const [before] = id ? await tx.select().from(systemsTable).where(eq(systemsTable.id, id)) : [];
    if (id && (!before || before.deletedAt)) throw new AppError(404, "System not found.");
    requireVersion(expectedVersion, before?.version ?? 0);
    const ids = [...new Set([...data.usedByIds, ...(data.ownerId ? [data.ownerId] : [])])];
    const people = ids.length ? await tx.select().from(usersTable).where(inArray(usersTable.id, ids)) : [];
    for (const personId of data.usedByIds) {
      const person = people.find(p => p.id === personId);
      if (!person || (!person.active && !before?.usedByIds.includes(personId))) throw new AppError(400, "Choose active teammates as system users.");
    }
    if (data.ownerId) {
      const person = people.find(p => p.id === data.ownerId);
      if (!person || (!person.active && before?.ownerId !== person.id)) throw new AppError(400, "Choose an active system owner.");
    }
    const entityId = id ?? randomUUID();
    const [after] = id
      ? await tx.update(systemsTable).set({ ...data, version: before!.version + 1, updatedAt: new Date() }).where(eq(systemsTable.id, id)).returning()
      : await tx.insert(systemsTable).values({ ...data, id: entityId }).returning();
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action: id ? "update" : "create", entityType: "system", entityId, before: before ?? null, after, via: "web" });
    return { id: entityId };
  });
}
export async function deleteSvpSystem(actor: StaffActor, id: string, raw: unknown) {
  const { expectedVersion } = z.object({ expectedVersion: z.number().int().min(1) }).strict().parse(raw);
  return db.transaction(async tx => {
    actor = await adminNow(tx, actor);
    const [before] = await tx.select().from(systemsTable).where(eq(systemsTable.id, id));
    if (!before || before.deletedAt) throw new AppError(404, "System not found.");
    requireVersion(expectedVersion, before.version);
    const [after] = await tx.update(systemsTable).set({ deletedAt: new Date(), updatedAt: new Date(), version: before.version + 1 }).where(eq(systemsTable.id, id)).returning();
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action: "remove", entityType: "system", entityId: id, before, after, via: "web" });
    return { id };
  });
}
