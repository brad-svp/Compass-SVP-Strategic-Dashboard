import { randomUUID } from "node:crypto";
import { db, accountabilitySeatsTable as seats, usersTable, auditLogTable } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "./permissions";

const seatInput = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(["board", "leadership", "function"]),
  ownerId: z.string().min(1).nullable(),
  personName: z.string().trim().max(160),
  roleLabel: z.string().trim().max(200),
  capacity: z.string().trim().max(100),
  responsibilities: z.array(z.string().trim().min(1).max(1000)).max(30),
  parentId: z.string().min(1).nullable(),
  sharedSeat: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
}).strict();

export const getAccountability = () => db.select().from(seats).orderBy(asc(seats.sortOrder), asc(seats.title));

export function validateReportingLine(id: string, parentId: string | null, rows: { id: string; parentId: string | null }[]) {
  const seen = new Set([id]);
  let current = parentId;
  while (current) {
    if (seen.has(current)) throw new AppError(400, "A seat cannot report to itself or one of its descendants.");
    seen.add(current);
    const parent = rows.find(s => s.id === current);
    if (!parent) throw new AppError(400, "Choose an existing reporting seat.");
    current = parent.parentId;
  }
}

export async function saveAccountability(actor: StaffActor, input: unknown, id?: string) {
  requireAdmin(actor);
  const parsed = seatInput.safeParse(input);
  if (!parsed.success) throw new AppError(400, parsed.error.issues.map(i => i.message).join("; "));
  const data = parsed.data;
  const entityId = id ?? randomUUID();
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
    if (!current) throw new AppError(403, "Your staff access is no longer available.");
    requireAdmin(current);
    const rows = await tx.select().from(seats);
    const before = rows.find(s => s.id === entityId);
    if (id && !before) throw new AppError(404, "This seat no longer exists.");
    validateReportingLine(entityId, data.parentId, rows);
    if (data.ownerId) {
      const [owner] = await tx.select().from(usersTable).where(eq(usersTable.id, data.ownerId));
      if (!owner || (!owner.active && before?.ownerId !== owner.id)) throw new AppError(400, "Choose an active staff member.");
    }
    const [after] = id
      ? await tx.update(seats).set({ ...data, updatedAt: new Date() }).where(eq(seats.id, id)).returning()
      : await tx.insert(seats).values({ ...data, id: entityId }).returning();
    await tx.insert(auditLogTable).values({
      id: randomUUID(), actorId: current.id, action: id ? "update" : "create",
      entityType: "accountability_seat", entityId, before: before ?? null, after, via: "web",
    });
    return { id: entityId };
  });
}

export async function deleteAccountability(actor: StaffActor, id: string) {
  requireAdmin(actor);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
    if (!current) throw new AppError(403, "Your staff access is no longer available.");
    requireAdmin(current);
    const [before] = await tx.select().from(seats).where(eq(seats.id, id));
    if (!before) throw new AppError(404, "This seat no longer exists.");
    if ((await tx.select().from(seats).where(eq(seats.parentId, id))).length) {
      throw new AppError(409, "Reassign the seats reporting here before deleting this seat.");
    }
    await tx.delete(seats).where(eq(seats.id, id));
    await tx.insert(auditLogTable).values({
      id: randomUUID(), actorId: current.id, action: "delete", entityType: "accountability_seat",
      entityId: id, before, after: null, via: "web",
    });
    return { id };
  });
}
