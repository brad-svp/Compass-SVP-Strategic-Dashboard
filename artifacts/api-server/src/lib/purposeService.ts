import { randomUUID } from "node:crypto";
import { db, organizationPurposeTable as purpose, usersTable, auditLogTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "./permissions";

export const initialPurpose = {
  id: "svp",
  mission: "We UNITE the collective power of nonprofits and philanthropic changemakers to ACCELERATE community IMPACT in the Greater Sacramento region.",
  // Approved by the user from the published Approach page's desired outcome.
  vision: "A thriving Sacramento region where everyone can reach their potential.",
  values: [
    { id: "philanthropic-education", title: "Philanthropic Education", description: "Partners educate themselves to become informed, effective, lifetime philanthropists — catalyzed through hands-on experience." },
    { id: "respect-for-expertise", title: "Respect for Expertise", description: "Partners respect the expertise of community nonprofits, forming close relationships where both are mutually vested in success." },
    { id: "innovative-leveraged-results", title: "Innovative, Leveraged Results", description: "Partners use innovative approaches and delegate decisions, resources, and authority to those closest to the work." },
    { id: "mutual-accountability", title: "Mutual Accountability", description: "Partners are accountable to each other, their nonprofit investees, and the community — documenting measurable results." },
    { id: "collective-effort", title: "Collective Effort", description: "Partners believe in the power of collective, multi-stakeholder effort and an open exchange of knowledge and lessons learned." },
    { id: "time-expertise-money", title: "Time, Expertise & Money", description: "SVP Partners invest time, expertise, and money in nonprofits, seeking collaborative relationships that last." },
  ],
  sourceUrls: ["https://www.svpsacramento.org/about/", "https://www.svpsacramento.org/approach"],
};
const valueInput = z.object({ id: z.string().min(1).max(80), title: z.string().trim().min(1).max(200), description: z.string().max(4000) }).strict();
const purposeInput = z.object({
  mission: z.string().max(6000), vision: z.string().max(6000),
  values: z.array(valueInput).max(30).refine(values => new Set(values.map(v => v.id)).size === values.length, "Each value needs a unique ID."),
  expectedVersion: z.number().int().min(1),
}).strict();
export async function seedPurpose() {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const [added] = await tx.insert(purpose).values(initialPurpose).onConflictDoNothing().returning();
    if (added) await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: null, action: "import", entityType: "organization_purpose", entityId: "svp", before: null, after: added, via: "web" });
    return !!added;
  });
}
export async function getSvpPurpose(actor: StaffActor) {
  const [record] = await db.select().from(purpose).where(eq(purpose.id, "svp"));
  if (!record) throw new AppError(503, "SVP purpose has not been initialized.");
  return { ...record, updatedAt: record.updatedAt.toISOString(), canEdit: actor.active && actor.role === "admin" };
}
export async function updateSvpPurpose(actor: StaffActor, raw: unknown) {
  const { expectedVersion, ...data } = purposeInput.parse(raw);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
    if (!current) throw new AppError(403, "Your staff access is no longer available.");
    requireAdmin(current);
    const [before] = await tx.select().from(purpose).where(eq(purpose.id, "svp"));
    if (!before) throw new AppError(503, "SVP purpose has not been initialized.");
    if (before.version !== expectedVersion) throw new AppError(409, "These statements changed while you were editing. Reopen the latest version before saving again.");
    const [after] = await tx.update(purpose).set({ ...data, version: before.version + 1, updatedAt: new Date() }).where(eq(purpose.id, "svp")).returning();
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: current.id, action: "update", entityType: "organization_purpose", entityId: "svp", before, after, via: "web" });
    return { id: "svp" };
  });
}
