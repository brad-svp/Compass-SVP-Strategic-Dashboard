import { db, areasTable, usersTable, cyclesTable, auditLogTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "./permissions";

const name = z.string().trim().min(1).max(160);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, "Enter a valid calendar date.");
const staffInput = z.object({
  name, email: z.string().trim().toLowerCase().email().refine((v) => v.endsWith("@svpsacramento.org"), "Use an SVP email address.").nullable().optional(),
  role: z.enum(["admin", "staff"]).default("staff"), areaId: z.string().min(1),
  roleDescription: z.string().max(12000).default(""), active: z.boolean().default(true),
}).strict();
const areaInput = z.object({ name, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), sortOrder: z.number().int().min(0).max(10000).default(0) }).strict();
const cycleInput = z.object({
  name, startDate: isoDate, endDate: isoDate, status: z.enum(["planning", "active", "closed"]).default("planning"),
}).strict();
export type Collection = "staff" | "areas" | "cycles";

export async function saveFoundation(actor: StaffActor, collection: Collection, input: unknown, id?: string) {
  requireAdmin(actor);
  const schema = collection === "staff" ? (id ? staffInput.partial() : staffInput)
    : collection === "areas" ? (id ? areaInput.partial() : areaInput) : (id ? cycleInput.partial() : cycleInput);
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError(400, parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "));
  if (!Object.keys(parsed.data).length) throw new AppError(400, "No changes were provided.");
  const entityId = id ?? crypto.randomUUID();
  await db.transaction(async (tx) => {
    // Serializes admin mutations, including the last-administrator invariant.
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const [currentActor] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
    if (!currentActor) throw new AppError(403, "Your staff access is no longer available.");
    requireAdmin(currentActor);
    let before: unknown = null;
    let after: unknown;
    if (collection === "staff") {
      const data = parsed.data as z.infer<typeof staffInput>;
      const [existing] = id ? await tx.select().from(usersTable).where(eq(usersTable.id, id)) : [];
      if (id && !existing) throw new AppError(404, "Staff member not found.");
      if (data.areaId && !(await tx.select().from(areasTable).where(eq(areasTable.id, data.areaId))).length) throw new AppError(400, "Choose an existing area.");
      if (existing?.id === actor.id && (data.active === false || data.role === "staff" || (data.email !== undefined && data.email !== existing.email))) {
        throw new AppError(400, "Ask another administrator to change your own access, email, or role.");
      }
      if (existing?.role === "admin" && existing.active && (data.role === "staff" || data.active === false || data.email === null)) {
        const admins = await tx.select().from(usersTable).where(sql`${usersTable.role} = 'admin' and ${usersTable.active} = true and ${usersTable.email} is not null`);
        if (admins.filter((a) => a.id !== existing.id).length === 0) throw new AppError(400, "Keep at least one active administrator with an email.");
      }
      before = existing ?? null;
      const update = { ...data, ...(existing && data.email !== undefined && data.email !== existing.email ? { clerkId: null } : {}), updatedAt: new Date() };
      [after] = id
        ? await tx.update(usersTable).set(update).where(eq(usersTable.id, id)).returning()
        : await tx.insert(usersTable).values({ id: entityId, ...data }).returning();
    } else if (collection === "areas") {
      const data = parsed.data as z.infer<typeof areaInput>;
      const [existing] = id ? await tx.select().from(areasTable).where(eq(areasTable.id, id)) : [];
      if (id && !existing) throw new AppError(404, "Area not found.");
      before = existing ?? null;
      [after] = id
        ? await tx.update(areasTable).set({ ...data, updatedAt: new Date() }).where(eq(areasTable.id, id)).returning()
        : await tx.insert(areasTable).values({ id: entityId, ...data }).returning();
    } else {
      const data = parsed.data as z.infer<typeof cycleInput>;
      const [existing] = id ? await tx.select().from(cyclesTable).where(eq(cyclesTable.id, id)) : [];
      if (id && !existing) throw new AppError(404, "Planning cycle not found.");
      const start = data.startDate ?? existing?.startDate;
      const end = data.endDate ?? existing?.endDate;
      if (start && end && start > end) throw new AppError(400, "The end date must be on or after the start date.");
      if (data.status === "active") {
        const active = await tx.select().from(cyclesTable).where(eq(cyclesTable.status, "active"));
        if (active.some((c) => c.id !== id)) throw new AppError(400, "Close the active cycle before activating another.");
      }
      before = existing ?? null;
      [after] = id
        ? await tx.update(cyclesTable).set({ ...data, updatedAt: new Date() }).where(eq(cyclesTable.id, id)).returning()
        : await tx.insert(cyclesTable).values({ id: entityId, ...data }).returning();
    }
    await tx.insert(auditLogTable).values({
      id: crypto.randomUUID(), actorId: actor.id, action: id ? "update" : "create",
      entityType: collection, entityId, before, after, via: "web",
    });
  });
  return { id: entityId };
}
