import { randomUUID } from "node:crypto";
import { db, calendarProgramsTable as programs, calendarEventsTable as events, programLogoUploadsTable as uploads, usersTable, auditLogTable } from "@workspace/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "./permissions";
export type ProgramTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function programAdmin(tx: ProgramTx, actor: StaffActor) {
  await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
  const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
  if (!current) throw new AppError(403, "Your staff access is no longer available.");
  requireAdmin(current);
  return current;
}
export const logoUrl = (id: string) => `/api/svp/program-logos/${encodeURIComponent(id)}`;
export async function seedCalendarPrograms() {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const names = await tx.selectDistinct({ name: events.program }).from(events);
    let addedCount = 0;
    for (const { name } of names) {
      if (!name.trim()) continue;
      const [exists] = await tx.select({ id: programs.id }).from(programs).where(sql`lower(${programs.name}) = lower(${name.trim()})`);
      if (!exists) {
        const [added] = await tx.insert(programs).values({ id: randomUUID(), name: name.trim() }).onConflictDoNothing().returning();
        if (added) {
          addedCount++;
          await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: null, action: "import", entityType: "calendar_program", entityId: added.id, before: null, after: added, via: "web" });
        }
      }
    }
    // Existing labels are preserved as a compatibility field; the stable ID
    // now keeps assignments and logos intact when an administrator renames one.
    await tx.execute(sql`update calendar_events e set program_id = p.id, program = p.name from calendar_programs p where e.program_id is null and lower(btrim(e.program)) = lower(p.name)`);
    return addedCount;
  });
}
export async function getCalendarPrograms(actor: StaffActor) {
  const all = await db.select({ program: programs, eventCount: sql<number>`count(${events.id})::int` }).from(programs)
    .leftJoin(events, and(eq(events.programId, programs.id), isNull(events.deletedAt)))
    .groupBy(programs.id).orderBy(asc(programs.name), asc(programs.id));
  return all.map(({ program: p, eventCount }) => ({
    ...p, logoUrl: p.logoId ? logoUrl(p.logoId) : null, canEdit: actor.active && actor.role === "admin", eventCount, updatedAt: p.updatedAt.toISOString(),
  }));
}
export async function resolveCalendarProgram(tx: ProgramTx, name: string, previousId?: string | null) {
  if (!name.trim()) return null;
  const [program] = await tx.select().from(programs).where(sql`lower(${programs.name}) = lower(${name.trim()})`);
  if (!program) throw new AppError(400, "Choose a program from the managed list, or add it in Manage programs.");
  if (!program.active && program.id !== previousId) throw new AppError(400, "This program is inactive. Choose an active program.");
  return program;
}
export async function saveCalendarProgram(actor: StaffActor, raw: unknown, id?: string) {
  const { expectedVersion, ...data } = z.object({
    name: z.string().trim().min(1).max(120), logoId: z.string().uuid().nullable(), active: z.boolean(), expectedVersion: z.number().int().min(0),
  }).strict().parse(raw);
  return db.transaction(async tx => {
    actor = await programAdmin(tx, actor);
    const [before] = id ? await tx.select().from(programs).where(eq(programs.id, id)) : [];
    if (id && !before) throw new AppError(404, "Program not found.");
    if (expectedVersion !== (before?.version ?? 0)) throw new AppError(409, "This program changed while you were editing. Reopen the latest version before saving.");
    const [duplicate] = await tx.select({ id: programs.id }).from(programs).where(sql`lower(${programs.name}) = lower(${data.name})`);
    if (duplicate && duplicate.id !== id) throw new AppError(409, "A program with this name already exists.");
    if (data.logoId && data.logoId !== before?.logoId) {
      const [upload] = await tx.select().from(uploads).where(eq(uploads.id, data.logoId));
      if (!upload?.ready || !upload.objectPath || upload.actorId !== actor.id) throw new AppError(400, "Upload and verify a logo before assigning it.");
    }
    const entityId = id ?? randomUUID();
    const [after] = id
      ? await tx.update(programs).set({ ...data, version: before!.version + 1, updatedAt: new Date() }).where(eq(programs.id, id)).returning()
      : await tx.insert(programs).values({ ...data, id: entityId }).returning();
    const renamedEvents = before && before.name !== data.name
      ? await tx.update(events).set({ program: data.name, version: sql`${events.version} + 1`, updatedAt: new Date() }).where(and(eq(events.programId, before.id), isNull(events.deletedAt))).returning({ id: events.id, version: events.version })
      : [];
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action: id ? "update" : "create", entityType: "calendar_program", entityId, before: before ?? null, after: { ...after, renamedEvents }, via: "web" });
    return { id: entityId };
  });
}
