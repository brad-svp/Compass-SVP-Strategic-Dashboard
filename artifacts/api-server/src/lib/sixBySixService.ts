import { randomUUID } from "node:crypto";
import { db, usersTable, periodsTable as periods, majorMomentsTable as moments, sixItemsTable as items, auditLogTable } from "@workspace/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, requireOwner, type StaffActor } from "./permissions";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v && !v.startsWith("0000");
}, "Enter a valid calendar date.");
const version = z.number().int().min(0);
const periodInput = z.object({
  name: z.string().trim().min(1).max(160), startDate: date, endDate: date,
  meetingDate: date.nullable(), meetingNotes: z.string().max(12000),
  status: z.enum(["draft", "active", "closed"]), expectedVersion: version,
}).strict();
const momentInput = z.object({
  title: z.string().trim().max(300), eventDate: date.nullable(), expectedVersion: version.min(1),
}).strict();
const itemFields = {
  ownerId: z.string().min(1), title: z.string().trim().min(1).max(300),
  description: z.string().max(8000), status: z.enum(["planned", "in_progress", "blocked", "done"]),
};
const itemInput = z.object({ ...itemFields, momentId: z.string().min(1) }).strict();
const itemUpdate = z.object({ ...itemFields, expectedVersion: version.min(1) }).strict();
const versionInput = z.object({ expectedVersion: version.min(1) }).strict();
async function actorNow(tx: Tx, actor: StaffActor) {
  await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
  const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
  if (!current?.active) throw new AppError(403, "Your staff access is no longer available.");
  return current;
}
function matchVersion(expected: number, actual: number) {
  if (expected !== actual) throw new AppError(409, "This record changed while you were editing. Your draft was not saved. Reopen it to review the latest version.");
}
async function audit(tx: Tx, actor: StaffActor, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
  await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action, entityType, entityId, before, after, via: "web" });
}
async function getMoment(tx: Tx, id: string) {
  const [moment] = await tx.select().from(moments).where(eq(moments.id, id));
  if (!moment) throw new AppError(404, "Major moment not found.");
  return moment;
}
async function getItem(tx: Tx, id: string) {
  const [item] = await tx.select().from(items).where(eq(items.id, id));
  if (!item || item.deletedAt) throw new AppError(404, "Item not found.");
  return item;
}
async function assignOwner(tx: Tx, actor: StaffActor, ownerId: string, previousId?: string) {
  if (actor.role !== "admin" && ownerId !== actor.id) throw new AppError(403, "You can add or assign items only to yourself.");
  const [owner] = await tx.select().from(usersTable).where(eq(usersTable.id, ownerId));
  if (!owner || (!owner.active && previousId !== ownerId)) throw new AppError(400, "Choose an active teammate.");
}

export async function saveSixPeriod(actor: StaffActor, raw: unknown, id?: string) {
  const { expectedVersion, ...data } = periodInput.parse(raw);
  return db.transaction(async tx => {
    actor = await actorNow(tx, actor); requireAdmin(actor);
    const [before] = id ? await tx.select().from(periods).where(eq(periods.id, id)) : [];
    if (id && !before) throw new AppError(404, "Period not found.");
    matchVersion(expectedVersion, before?.version ?? 0);
    if (data.endDate < data.startDate) throw new AppError(400, "End date must be on or after start date.");
    const overlaps = (await tx.select().from(periods)).some(p => p.id !== id && p.startDate <= data.endDate && p.endDate >= data.startDate);
    if (overlaps) throw new AppError(400, "These dates overlap another 6x6 period.");
    if (before) {
      const existing = await tx.select().from(moments).where(eq(moments.periodId, before.id));
      if (existing.some(m => m.eventDate && (m.eventDate < data.startDate || m.eventDate > data.endDate))) {
        throw new AppError(400, "A major moment falls outside these dates. Adjust its date before changing the period.");
      }
    }
    const entityId = id ?? randomUUID();
    const [after] = id
      ? await tx.update(periods).set({ ...data, version: before!.version + 1, updatedAt: new Date() }).where(eq(periods.id, id)).returning()
      : await tx.insert(periods).values({ ...data, id: entityId }).returning();
    if (!id) {
      for (let position = 1; position <= 6; position++) {
        const [moment] = await tx.insert(moments).values({ id: randomUUID(), periodId: entityId, position, title: "" }).returning();
        await audit(tx, actor, "create", "six_moment", moment.id, null, moment);
      }
    }
    await audit(tx, actor, id ? "update" : "create", "six_period", entityId, before ?? null, after);
    return { id: entityId };
  });
}

export async function saveSixMoment(actor: StaffActor, id: string, raw: unknown) {
  const { expectedVersion, ...data } = momentInput.parse(raw);
  return db.transaction(async tx => {
    actor = await actorNow(tx, actor); requireAdmin(actor);
    const before = await getMoment(tx, id);
    matchVersion(expectedVersion, before.version);
    const [period] = await tx.select().from(periods).where(eq(periods.id, before.periodId));
    if (!period) throw new AppError(404, "Period not found.");
    if (data.eventDate && (data.eventDate < period.startDate || data.eventDate > period.endDate)) {
      throw new AppError(400, "The moment's date must be within this period.");
    }
    const [after] = await tx.update(moments).set({ ...data, version: before.version + 1, updatedAt: new Date() }).where(eq(moments.id, id)).returning();
    await audit(tx, actor, "update", "six_moment", id, before, after);
    return { id };
  });
}

export async function saveSixItem(actor: StaffActor, raw: unknown, id?: string) {
  const parsed = id ? itemUpdate.parse(raw) : itemInput.parse(raw);
  return db.transaction(async tx => {
    actor = await actorNow(tx, actor);
    const before = id ? await getItem(tx, id) : null;
    if (before) {
      requireOwner(actor, { id: before.ownerId, name: "the assigned teammate" });
      matchVersion((parsed as z.infer<typeof itemUpdate>).expectedVersion, before.version);
    }
    const { ownerId, title, description, status } = parsed;
    await assignOwner(tx, actor, ownerId, before?.ownerId);
    const momentId = before?.momentId ?? (parsed as z.infer<typeof itemInput>).momentId;
    await getMoment(tx, momentId);
    if (!before || before.ownerId !== ownerId) {
      // actorNow holds a transaction-scoped lock, including concurrent creates.
      const occupied = await tx.select({ id: items.id }).from(items).where(and(
        eq(items.momentId, momentId), eq(items.ownerId, ownerId), isNull(items.deletedAt),
      ));
      if (occupied.length) throw new AppError(409, "This priority box already has an item. Edit the existing priority instead.");
    }
    const entityId = id ?? randomUUID();
    const data = { ownerId, title, description, status };
    const [after] = id
      ? await tx.update(items).set({ ...data, version: before!.version + 1, updatedAt: new Date() }).where(eq(items.id, id)).returning()
      : await tx.insert(items).values({ ...data, momentId, id: entityId }).returning();
    await audit(tx, actor, id ? "update" : "create", "six_item", entityId, before, after);
    return { id: entityId };
  });
}

export async function deleteSixItem(actor: StaffActor, id: string, raw: unknown) {
  const { expectedVersion } = versionInput.parse(raw);
  return db.transaction(async tx => {
    actor = await actorNow(tx, actor);
    const before = await getItem(tx, id);
    requireOwner(actor, { id: before.ownerId, name: "the assigned teammate" });
    matchVersion(expectedVersion, before.version);
    const [after] = await tx.update(items).set({ deletedAt: new Date(), updatedAt: new Date(), version: before.version + 1 }).where(eq(items.id, id)).returning();
    await audit(tx, actor, "remove", "six_item", id, before, after);
    return { id };
  });
}

export async function getSixBySix(actor: StaffActor) {
  return db.transaction(async tx => {
    const allPeriods = await tx.select().from(periods).orderBy(asc(periods.startDate), asc(periods.id));
    const allMoments = await tx.select().from(moments).orderBy(asc(moments.position));
    const allItems = await tx.select().from(items).where(isNull(items.deletedAt)).orderBy(asc(items.createdAt), asc(items.id));
    const periodByMoment = new Map(allMoments.map(m => [m.id, m.periodId]));
    return {
      periods: allPeriods.map(p => ({ ...p, moments: allMoments.filter(m => m.periodId === p.id) })),
      items: allItems.map(item => ({
        ...item, periodId: periodByMoment.get(item.momentId)!,
        canEdit: actor.role === "admin" || actor.id === item.ownerId, updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
