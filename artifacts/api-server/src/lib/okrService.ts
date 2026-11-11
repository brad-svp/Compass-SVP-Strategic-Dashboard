import { db, objectivesTable as objectives, keyResultsTable as keyResults, checkInsTable as checkIns, commentsTable as comments, usersTable, areasTable, cyclesTable, auditLogTable } from "@workspace/db";
import { eq, sql, asc, isNull } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, requireOwner, type StaffActor } from "./permissions";
import { expectedProgress, metricProgress, progressHealth } from "./okrProgress";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Objective = typeof objectives.$inferSelect;
const title = z.string().trim().min(1).max(300);
const id = z.string().min(1);
const sortOrder = z.number().int().min(0).max(1000000);
const objectiveInput = z.object({
  cycleId: id, level: z.enum(["company", "individual"]), ownerId: id, areaId: id,
  parentObjectiveId: id.nullable().optional(), title, description: z.string().max(12000).default(""),
  timeScope: z.enum(["annual", "Q1", "Q2", "Q3", "Q4"]),
  status: z.enum(["draft", "active", "closed"]).default("draft"), sortOrder: sortOrder.default(0),
}).strict();
const objectiveUpdate = objectiveInput.omit({ cycleId: true, level: true }).partial();
const krInput = z.object({
  objectiveId: id, ownerId: id, title, measurementType: z.enum(["metric", "confidence"]),
  unit: z.string().max(80).default(""), startValue: z.number().finite().default(0),
  targetValue: z.number().finite().default(100), sortOrder: sortOrder.default(0),
}).strict();
const krUpdate = krInput.omit({ objectiveId: true }).partial();
const checkInInput = z.object({
  measurementType: z.enum(["metric", "confidence"]),
  value: z.number().finite().optional(), confidence: z.number().min(0).max(100).optional(),
  note: z.string().trim().min(1).max(4000),
}).strict();
const commentInput = z.object({
  entityType: z.enum(["objective", "key_result"]), entityId: id,
  body: z.string().trim().min(1).max(8000),
}).strict();

async function activeActor(tx: Tx, actor: StaffActor) {
  // Shared with admin writes, preventing permissions changing mid-mutation.
  await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
  const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
  if (!current?.active) throw new AppError(403, "Your staff access is no longer available.");
  return current;
}
async function owner(tx: Tx, ownerId: string) {
  const [person] = await tx.select().from(usersTable).where(eq(usersTable.id, ownerId));
  if (!person?.active) throw new AppError(400, "Choose an active staff member.");
  return person;
}
async function objective(tx: Tx, objectiveId: string) {
  const [item] = await tx.select().from(objectives).where(eq(objectives.id, objectiveId));
  if (!item || item.deletedAt) throw new AppError(404, "Objective not found.");
  return item;
}
async function kr(tx: Tx, krId: string) {
  const [item] = await tx.select().from(keyResults).where(eq(keyResults.id, krId));
  if (!item || item.deletedAt) throw new AppError(404, "Key result not found.");
  await objective(tx, item.objectiveId);
  return item;
}
async function owned(tx: Tx, actor: StaffActor, ownerId: string) {
  const [person] = await tx.select().from(usersTable).where(eq(usersTable.id, ownerId));
  if (!person) throw new AppError(404, "Owner not found.");
  requireOwner(actor, person);
}
async function canEditObjective(tx: Tx, actor: StaffActor, item: Objective) {
  if (item.level === "company") requireAdmin(actor);
  else await owned(tx, actor, item.ownerId);
}
async function audit(tx: Tx, actor: StaffActor, action: string, entityType: string, entityId: string, before: unknown, after: unknown, via: "web" | "mcp") {
  await tx.insert(auditLogTable).values({ id: crypto.randomUUID(), actorId: actor.id, action, entityType, entityId, before, after, via });
}
function changes(data: object) {
  if (!Object.keys(data).length) throw new AppError(400, "No changes were provided.");
}
export async function saveObjective(actor: StaffActor, raw: unknown, itemId?: string, via: "web" | "mcp" = "web") {
  const parsed = itemId ? objectiveUpdate.parse(raw) : objectiveInput.parse(raw);
  changes(parsed);
  return db.transaction(async tx => {
    actor = await activeActor(tx, actor);
    const before = itemId ? await objective(tx, itemId) : null;
    if (before) await canEditObjective(tx, actor, before);
    const data = { ...before, ...parsed } as z.infer<typeof objectiveInput>;
    if (data.level === "company") requireAdmin(actor);
    else if (actor.role !== "admin" && data.ownerId !== actor.id) throw new AppError(403, "Staff can create or assign objectives only to themselves.");
    if (!before || before.ownerId !== data.ownerId) await owner(tx, data.ownerId);
    const [cycle] = await tx.select().from(cyclesTable).where(eq(cyclesTable.id, data.cycleId));
    if (!cycle) throw new AppError(400, "Choose an existing cycle.");
    if (!(await tx.select().from(areasTable).where(eq(areasTable.id, data.areaId))).length) throw new AppError(400, "Choose an existing area.");
    if (data.level === "company") {
      if (data.timeScope !== "annual" || data.parentObjectiveId) throw new AppError(400, "Company objectives must be annual and cannot have a parent.");
    } else {
      if (!data.parentObjectiveId) throw new AppError(400, "Link this objective to a company objective.");
      const parent = await objective(tx, data.parentObjectiveId);
      if (parent.level !== "company" || parent.cycleId !== data.cycleId) throw new AppError(400, "Choose a company objective in the same cycle.");
      if (data.timeScope !== "annual") {
        const year = Number(cycle.startDate.slice(0, 4));
        const q = Number(data.timeScope.slice(1));
        const start = new Date(Date.UTC(year, (q - 1) * 3, 1)).toISOString().slice(0, 10);
        const end = new Date(Date.UTC(year, q * 3, 0)).toISOString().slice(0, 10);
        if (end < cycle.startDate || start > cycle.endDate) throw new AppError(400, "This quarter falls outside the selected cycle.");
      }
    }
    const entityId = itemId ?? crypto.randomUUID();
    const [after] = itemId
      ? await tx.update(objectives).set({ ...parsed, updatedAt: new Date() }).where(eq(objectives.id, itemId)).returning()
      : await tx.insert(objectives).values({ ...data, id: entityId, parentObjectiveId: data.parentObjectiveId ?? null }).returning();
    await audit(tx, actor, itemId ? "update" : "create", "objective", entityId, before, after, via);
    return { id: entityId };
  });
}
export async function saveKeyResult(actor: StaffActor, raw: unknown, itemId?: string, via: "web" | "mcp" = "web") {
  const parsed = itemId ? krUpdate.parse(raw) : krInput.parse(raw);
  changes(parsed);
  return db.transaction(async tx => {
    actor = await activeActor(tx, actor);
    const before = itemId ? await kr(tx, itemId) : null;
    const data = { ...before, ...parsed } as z.infer<typeof krInput>;
    const parent = await objective(tx, data.objectiveId);
    if (before) await owned(tx, actor, before.ownerId);
    else await canEditObjective(tx, actor, parent);
    if (actor.role !== "admin" && data.ownerId !== actor.id) throw new AppError(403, "Staff can assign key results only to themselves.");
    if (!before || before.ownerId !== data.ownerId) await owner(tx, data.ownerId);
    if (data.startValue === data.targetValue) throw new AppError(400, "The target must differ from the start value.");
    const entityId = itemId ?? crypto.randomUUID();
    const [after] = itemId
      ? await tx.update(keyResults).set({ ...parsed, updatedAt: new Date() }).where(eq(keyResults.id, itemId)).returning()
      : await tx.insert(keyResults).values({ ...data, id: entityId }).returning();
    await audit(tx, actor, itemId ? "update" : "create", "key_result", entityId, before, after, via);
    return { id: entityId };
  });
}
export async function addCheckIn(actor: StaffActor, keyResultId: string, raw: unknown, via: "web" | "mcp" = "web") {
  const data = checkInInput.parse(raw);
  return db.transaction(async tx => {
    actor = await activeActor(tx, actor);
    const before = await kr(tx, keyResultId);
    await owned(tx, actor, before.ownerId);
    if (data.measurementType !== before.measurementType) throw new AppError(409, "The measurement type changed. Reload and try again.");
    if (data.measurementType === "metric" && (data.value === undefined || data.confidence !== undefined)) throw new AppError(400, "Enter a metric value.");
    if (data.measurementType === "confidence" && (data.confidence === undefined || data.value !== undefined)) throw new AppError(400, "Enter confidence from 0 to 100.");
    const progress = data.measurementType === "metric" ? metricProgress(before.startValue, before.targetValue, data.value!) : data.confidence!;
    const entityId = crypto.randomUUID();
    const [entry] = await tx.insert(checkIns).values({
      id: entityId, keyResultId, authorId: actor.id, measurementType: data.measurementType,
      value: data.value ?? null, confidence: data.confidence ?? null, note: data.note, progress,
    }).returning();
    const [after] = await tx.update(keyResults).set({
      ...(data.measurementType === "metric" ? { currentValue: data.value } : { confidence: data.confidence }),
      updatedAt: new Date(),
    }).where(eq(keyResults.id, keyResultId)).returning();
    await audit(tx, actor, "create", "check_in", entityId, null, entry, via);
    await audit(tx, actor, "check_in", "key_result", keyResultId, before, after, via);
    return { id: entityId };
  });
}
export async function removeOkr(actor: StaffActor, entityType: "objective" | "key_result", entityId: string, via: "web" | "mcp" = "web") {
  return db.transaction(async tx => {
    actor = await activeActor(tx, actor);
    const now = new Date();
    if (entityType === "objective") {
      const before = await objective(tx, entityId);
      await canEditObjective(tx, actor, before);
      const children = await tx.select().from(objectives).where(eq(objectives.parentObjectiveId, entityId));
      if (children.some(c => !c.deletedAt)) throw new AppError(409, "Move or remove the supporting individual objectives before removing this company objective.");
      const results = await tx.select().from(keyResults).where(eq(keyResults.objectiveId, entityId));
      // Do not allow an objective owner to erase another person's KR from their workspace.
      for (const result of results.filter(r => !r.deletedAt)) {
        await owned(tx, actor, result.ownerId);
        const [after] = await tx.update(keyResults).set({ deletedAt: now, updatedAt: now }).where(eq(keyResults.id, result.id)).returning();
        await audit(tx, actor, "delete", "key_result", result.id, result, after, via);
      }
      const [after] = await tx.update(objectives).set({ deletedAt: now, updatedAt: now }).where(eq(objectives.id, entityId)).returning();
      await audit(tx, actor, "delete", entityType, entityId, before, after, via);
    } else {
      const before = await kr(tx, entityId);
      await owned(tx, actor, before.ownerId);
      const [after] = await tx.update(keyResults).set({ deletedAt: now, updatedAt: now }).where(eq(keyResults.id, entityId)).returning();
      await audit(tx, actor, "delete", entityType, entityId, before, after, via);
    }
    return { id: entityId };
  });
}
export async function saveComment(actor: StaffActor, raw: unknown, itemId?: string, remove = false, via: "web" | "mcp" = "web") {
  return db.transaction(async tx => {
    actor = await activeActor(tx, actor);
    const [before] = itemId ? await tx.select().from(comments).where(eq(comments.id, itemId)) : [];
    if (itemId && !before) throw new AppError(404, "Comment not found.");
    if (before && before.authorId !== actor.id) throw new AppError(403, "Only the author can edit or delete this comment.");
    const data = before ? { ...before, ...(remove ? {} : commentInput.pick({ body: true }).parse(raw)) } : commentInput.parse(raw);
    if (data.entityType === "objective") await objective(tx, data.entityId);
    else await kr(tx, data.entityId);
    const entityId = itemId ?? crypto.randomUUID();
    let after: unknown = null;
    if (remove) await tx.delete(comments).where(eq(comments.id, entityId));
    else if (itemId) [after] = await tx.update(comments).set({ body: data.body, editedAt: new Date() }).where(eq(comments.id, itemId)).returning();
    else [after] = await tx.insert(comments).values({ id: entityId, entityType: data.entityType, entityId: data.entityId, body: data.body, authorId: actor.id }).returning();
    await audit(tx, actor, remove ? "delete" : itemId ? "update" : "create", "comment", entityId, before ?? null, after, via);
    return { id: entityId };
  });
}
export async function getOkrWorkspace(actor: StaffActor, now = new Date()) {
  // Consistent snapshot: a newly appended check-in and its official value travel together.
  return db.transaction(async tx => {
    // A transaction uses one pg connection; do not issue concurrent queries on it.
    const allObjectives = await tx.select().from(objectives).where(isNull(objectives.deletedAt)).orderBy(asc(objectives.sortOrder), asc(objectives.createdAt));
    const allResults = await tx.select().from(keyResults).where(isNull(keyResults.deletedAt)).orderBy(asc(keyResults.sortOrder), asc(keyResults.createdAt));
    const history = await tx.select().from(checkIns).orderBy(asc(checkIns.createdAt), asc(checkIns.id));
    const threads = await tx.select().from(comments).orderBy(asc(comments.createdAt));
    const cycles = await tx.select().from(cyclesTable);
    const objectiveIds = new Set(allObjectives.map(o => o.id));
    const results = allResults.filter(k => objectiveIds.has(k.objectiveId));
    const resultIds = new Set(results.map(k => k.id));
    const visibleHistory = history.filter(h => resultIds.has(h.keyResultId));
    const pace = new Map(allObjectives.map(o => {
      const c = cycles.find(c => c.id === o.cycleId)!;
      return [o.id, expectedProgress(c.startDate, c.endDate, o.timeScope, now)];
    }));
    const mappedResults = results.map(k => {
      const progress = k.measurementType === "metric" ? metricProgress(k.startValue, k.targetValue, k.currentValue) : k.confidence ?? 0;
      const latest = visibleHistory.filter(h => h.keyResultId === k.id).at(-1);
      return { ...k, progress, health: progressHealth(k.measurementType, progress, pace.get(k.objectiveId)!, k.measurementType === "metric" ? k.currentValue !== null : k.confidence !== null),
        lastCheckInAt: latest?.createdAt.toISOString() ?? null, canEdit: actor.active && (actor.role === "admin" || actor.id === k.ownerId) };
    });
    return {
      objectives: allObjectives.map(o => {
        const krs = mappedResults.filter(k => k.objectiveId === o.id);
        const progress = krs.length ? krs.reduce((s, k) => s + k.progress, 0) / krs.length : 0;
        const health = !krs.length || krs.every(k => k.health === "none") ? "none"
          : krs.some(k => k.health === "red") ? "red" : krs.some(k => k.health === "yellow") ? "yellow" : "green";
        return { ...o, progress, expectedProgress: pace.get(o.id)!, health,
          canEdit: actor.active && (actor.role === "admin" || (o.level === "individual" && o.ownerId === actor.id)) };
      }),
      keyResults: mappedResults,
      checkIns: visibleHistory.map(h => ({ ...h, createdAt: h.createdAt.toISOString() })),
      comments: threads.filter(c => c.entityType === "objective" ? objectiveIds.has(c.entityId) : resultIds.has(c.entityId))
        .map(c => ({ ...c, createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null, canEdit: c.authorId === actor.id })),
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
