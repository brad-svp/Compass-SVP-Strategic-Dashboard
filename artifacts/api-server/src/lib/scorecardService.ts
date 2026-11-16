import { randomUUID } from "node:crypto";
import { db, usersTable, areasTable, objectivesTable, keyResultsTable, auditLogTable, calendarEventsTable, scorecardMilestonesTable as milestones, scorecardMeasurementsTable as measurements, scorecardMetricsTable as metrics, scorecardEntriesTable as entries, scorecardRevisionsTable as revisions } from "@workspace/db";
import { and, asc, eq, gte, lte, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, requireOwner, type StaffActor } from "./permissions";
import { scorecardStatus, scorecardWeeks, validateWeek, weekStart } from "./scorecardMath";
import { isCalendarDate } from "./calendarDates";

const id = z.string().min(1);
const metricInput = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().trim().max(4000),
  ownerId: id, areaId: id, unit: z.string().trim().max(40), decimals: z.number().int().min(0).max(4),
  direction: z.enum(["at_least", "at_most", "range"]),
  target: z.number().finite(), upperTarget: z.number().finite().nullable(),
  linkedKeyResultId: id.nullable(), sortOrder: z.number().int().min(0).max(1000000), active: z.boolean(),
  calendarEventId:id.nullable().optional(),
  // Generated OpenAPI body validation coerces date-time strings into Dates.
  expectedUpdatedAt:z.preprocess(v=>v instanceof Date?v.toISOString():v,z.string().datetime()).optional(),
  milestones:z.array(z.object({dueDate:z.string().refine(isCalendarDate,"Enter a valid target date."),target:z.number().finite(),upperTarget:z.number().finite().nullable()}).strict()).max(100).optional(),
}).strict();
const entryInput = z.object({
  value: z.number().finite().nullable(), note: z.string().trim().max(4000),
  reason: z.string().trim().max(1000), expectedVersion: z.number().int().min(0),
}).strict();
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function currentScorecardActor(tx: Tx, actor: StaffActor) {
  await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
  const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
  if (!current?.active) throw new AppError(403, "Your staff access is no longer available.");
  return current;
}

export async function saveScorecardMetric(actor: StaffActor, raw: unknown, metricId?: string) {
  const {milestones:targetDates,expectedUpdatedAt,...data} = metricInput.parse(raw);
  return db.transaction(async tx => {
    actor = await currentScorecardActor(tx, actor);
    requireAdmin(actor);
    const [before] = metricId ? await tx.select().from(metrics).where(eq(metrics.id, metricId)).for("update") : [];
    if (metricId && !before) throw new AppError(404, "Metric not found.");
    if(before && ((expectedUpdatedAt && before.updatedAt.toISOString()!==expectedUpdatedAt)|| (targetDates!==undefined && !expectedUpdatedAt)))throw new AppError(409,"This metric changed, or its version is missing. Reopen it before saving dated targets.");
    const oldDates=before?await tx.select().from(milestones).where(eq(milestones.metricId,before.id)):[];
    const datesToCheck=targetDates??oldDates;
    if(new Set(datesToCheck.map(t=>t.dueDate)).size!==datesToCheck.length)throw new AppError(400,"Use one target per date.");
    if(datesToCheck.some(t=>data.direction==="range"?(t.upperTarget===null||t.upperTarget<t.target):t.upperTarget!==null))throw new AppError(400,"Dated targets must match the metric's comparison and range.");
    if(before && before.unit!==data.unit && (await tx.select({id:measurements.id}).from(measurements).where(eq(measurements.metricId,before.id)).limit(1)).length)throw new AppError(409,"Units cannot change after values are recorded. Create another metric for a different unit.");
    if(data.calendarEventId){
      const [event]=await tx.select().from(calendarEventsTable).where(eq(calendarEventsTable.id,data.calendarEventId));
      if(!event || event.kind === "planning_note" || (event.deletedAt && before?.calendarEventId!==event.id))throw new AppError(400,"Choose an available calendar event, not a planning note.");
    }
    if (data.direction === "range" ? data.upperTarget === null || data.upperTarget < data.target : data.upperTarget !== null) {
      throw new AppError(400, "A range needs an upper target at least as large as the lower target. Other goals must not have an upper target.");
    }
    const [owner] = await tx.select().from(usersTable).where(eq(usersTable.id, data.ownerId));
    if (!owner || (!owner.active && before?.ownerId !== owner.id)) throw new AppError(400, "Choose an active metric owner.");
    if (!(await tx.select().from(areasTable).where(eq(areasTable.id, data.areaId))).length) throw new AppError(400, "Choose an existing area.");
    if (data.linkedKeyResultId && data.linkedKeyResultId !== before?.linkedKeyResultId) {
      const [kr] = await tx.select().from(keyResultsTable).where(eq(keyResultsTable.id, data.linkedKeyResultId));
      const [objective] = kr ? await tx.select().from(objectivesTable).where(eq(objectivesTable.id, kr.objectiveId)) : [];
      if (!kr || kr.deletedAt || kr.measurementType !== "metric" || !objective || objective.deletedAt ||
        objective.level !== "company" || objective.timeScope === "annual") {
        throw new AppError(400, "Link an active measurable key result on an organization-wide quarterly QBO.");
      }
    }
    const entityId = metricId ?? randomUUID();
    const [after] = metricId
      ? await tx.update(metrics).set({ ...data, updatedAt: new Date(Math.max(Date.now(),before!.updatedAt.getTime()+1)) }).where(eq(metrics.id, metricId)).returning()
      : await tx.insert(metrics).values({ ...data, id: entityId }).returning();
    if(targetDates!==undefined){
      await tx.delete(milestones).where(eq(milestones.metricId,entityId));
      if(targetDates.length)await tx.insert(milestones).values(targetDates.map(t=>({...t,id:randomUUID(),metricId:entityId})));
    }
    await tx.insert(auditLogTable).values({
      id: randomUUID(), actorId: actor.id, action: metricId ? "update" : "create", entityType: "scorecard_metric",
      entityId, before: before?{...before,milestones:oldDates}:null, after:{...after,milestones:targetDates??oldDates}, via: "web",
    });
    return { id: entityId };
  });
}

export async function saveScorecardEntry(actor: StaffActor, metricId: string, week: string, raw: unknown, now = new Date()) {
  const data = entryInput.parse(raw);
  validateWeek(week, now);
  return db.transaction(async tx => {
    actor = await currentScorecardActor(tx, actor);
    const [metric] = await tx.select().from(metrics).where(eq(metrics.id, metricId));
    if (!metric) throw new AppError(404, "Metric not found.");
    if (!metric.active) throw new AppError(409, "Restore this archived metric before recording results.");
    const [owner] = await tx.select().from(usersTable).where(eq(usersTable.id, metric.ownerId));
    if (!owner) throw new AppError(404, "Metric owner not found.");
    requireOwner(actor, owner);
    const [before] = await tx.select().from(entries).where(and(eq(entries.metricId, metricId), eq(entries.weekStart, week)));
    if ((before?.version ?? 0) !== data.expectedVersion) throw new AppError(409, "Someone changed this week's result. Your draft was not saved. Reopen the week to review the latest value.");
    if (before && before.value !== data.value && !data.reason) throw new AppError(400, "Explain the correction or why you are clearing this result.");
    if (!before && data.value === null) throw new AppError(400, "Enter a numeric result first; blank weeks are already missing.");
    const goal = before
      ? { direction: before.direction, target: before.target, upperTarget: before.upperTarget, unit: before.unit }
      : { direction: metric.direction, target: metric.target, upperTarget: metric.upperTarget, unit: metric.unit };
    const entityId = before?.id ?? randomUUID();
    const updated = { value: data.value, note: data.note, authorId: actor.id, version: (before?.version ?? 0) + 1, updatedAt: new Date(), ...goal };
    const [after] = before
      ? await tx.update(entries).set(updated).where(eq(entries.id, entityId)).returning()
      : await tx.insert(entries).values({ ...updated, id: entityId, metricId, weekStart: week }).returning();
    await tx.insert(revisions).values({
      id: randomUUID(), entryId: entityId, version: after.version, value: after.value, note: after.note,
      reason: data.reason, authorId: actor.id, ...goal,
    });
    await tx.insert(auditLogTable).values({
      id: randomUUID(), actorId: actor.id, action: before ? (data.value === null ? "clear" : "correct") : "create",
      entityType: "scorecard_entry", entityId, before: before ?? null, after, via: "web",
    });
    // A linked quarterly key result is contextual only. Its official value
    // remains changeable exclusively through its existing check-in service.
    return { id: entityId };
  });
}

export async function getScorecard(actor: StaffActor, end?: string, now = new Date()) {
  const endWeek = end ? validateWeek(end, now) : weekStart(now);
  const weeks = scorecardWeeks(endWeek);
  return db.transaction(async tx => {
    const allMetrics = await tx.select().from(metrics).orderBy(asc(metrics.sortOrder), asc(metrics.title));
    const allEntries = await tx.select().from(entries).where(and(gte(entries.weekStart, weeks[0]), lte(entries.weekStart, endWeek))).orderBy(asc(entries.weekStart));
    const history = allEntries.length
      ? await tx.select().from(revisions).where(inArray(revisions.entryId, allEntries.map(e => e.id))).orderBy(asc(revisions.createdAt), asc(revisions.version))
      : [];
    return {
      weeks, endWeek,
      metrics: allMetrics.map(m => ({ ...m, canEdit: actor.role === "admin", canRecord: m.active && (actor.role === "admin" || actor.id === m.ownerId) })),
      entries: allEntries.map(e => ({ ...e, updatedAt: e.updatedAt.toISOString(), status: scorecardStatus(e.value, e.direction, e.target, e.upperTarget) })),
      revisions: history.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
