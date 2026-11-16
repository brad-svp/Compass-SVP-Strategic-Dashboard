import { randomUUID } from "node:crypto";
import { db, auditLogTable, scorecardMetricsTable as metrics, scorecardMilestonesTable as milestones, scorecardMeasurementsTable as values } from "@workspace/db";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, type StaffActor } from "./permissions";
import { currentScorecardActor } from "./scorecardService";
import { calendarDate } from "./calendarDates";

type Measurement=typeof values.$inferSelect;
function serialize(v:Measurement,actor:StaffActor){
  return {id:v.id,metricId:v.metricId,value:v.value,note:v.note,authorId:v.authorId,unit:v.unit,recordedAt:v.recordedAt.toISOString(),sourceWeekStart:v.sourceWeekStart,legacyReason:v.legacyReason,canDelete:actor.role==="admin"||actor.id===v.authorId};
}

/** Idempotent: preserve every old correction/clear, its actual timestamp and author.
 * Deleted migrated rows retain their identity so a restart never restores them. */
export async function backfillScorecardHistory(){
  await db.execute(sql`
    insert into scorecard_measurements(id,metric_id,value,note,author_id,unit,recorded_at,source_week_start,legacy_revision_id,legacy_reason)
    select 'legacy-revision-'||r.id,e.metric_id,r.value,r.note,r.author_id,r.unit,r.created_at,e.week_start,r.id,r.reason
    from scorecard_revisions r join scorecard_entries e on e.id=r.entry_id
    where not exists(select 1 from scorecard_measurements m where m.legacy_revision_id=r.id)
    order by r.created_at,r.version,r.id
    on conflict do nothing
  `);
  await db.execute(sql`
    insert into scorecard_measurements(id,metric_id,value,note,author_id,unit,recorded_at,source_week_start)
    select 'legacy-entry-'||e.id,e.metric_id,e.value,e.note,e.author_id,e.unit,e.updated_at,e.week_start
    from scorecard_entries e where not exists(select 1 from scorecard_revisions r where r.entry_id=e.id)
    order by e.updated_at,e.id on conflict do nothing
  `);
}

export async function getScorecardTracker(actor:StaffActor,now=new Date()){
  return db.transaction(async tx=>{
    actor=await currentScorecardActor(tx,actor);
    const all=await tx.select().from(metrics).orderBy(asc(metrics.sortOrder),asc(metrics.title));
    const dates=await tx.select().from(milestones).orderBy(asc(milestones.dueDate));
    const latest=await tx.selectDistinctOn([values.metricId]).from(values).where(isNull(values.deletedAt)).orderBy(values.metricId,desc(values.recordedAt),desc(values.sequence));
    return {asOf:now.toISOString(),today:calendarDate(now),metrics:all.map(m=>({...m,createdAt:m.createdAt.toISOString(),updatedAt:m.updatedAt.toISOString(),canEdit:actor.role==="admin",canRecord:m.active&&(actor.role==="admin"||actor.id===m.ownerId)})),milestones:dates,latest:latest.map(v=>serialize(v,actor))};
  });
}

const page=z.object({after:z.string().min(1).max(200).optional(),limit:z.coerce.number().int().min(1).max(250).default(250)}).strict();
export async function getScorecardTrend(actor:StaffActor,metricId:string,raw:unknown={}){
  const p=page.parse(raw);
  return db.transaction(async tx=>{
    actor=await currentScorecardActor(tx,actor);
    const [metric]=await tx.select().from(metrics).where(eq(metrics.id,metricId));
    if(!metric)throw new AppError(404,"Metric not found.");
    if(p.after){
      const [anchor]=await tx.select().from(values).where(eq(values.id,p.after));
      if(!anchor||anchor.metricId!==metricId)throw new AppError(400,"Invalid history cursor.");
    }
    const conditions=[eq(values.metricId,metricId),isNull(values.deletedAt)];
    if(p.after)conditions.push(sql`(${values.recordedAt},${values.sequence}) > (select recorded_at,sequence from scorecard_measurements where id=${p.after})`);
    const rows=await tx.select().from(values).where(and(...conditions)).orderBy(asc(values.recordedAt),asc(values.sequence)).limit(p.limit+1);
    return {entries:rows.slice(0,p.limit).map(v=>serialize(v,actor)),nextCursor:rows.length>p.limit?rows[p.limit-1]!.id:null};
  });
}

const measurement=z.object({value:z.number().finite(),note:z.string().trim().max(4000)}).strict();
export async function appendScorecardMeasurement(actor:StaffActor,metricId:string,raw:unknown){
  const input=measurement.parse(raw);
  return db.transaction(async tx=>{
    actor=await currentScorecardActor(tx,actor);
    const [metric]=await tx.select().from(metrics).where(eq(metrics.id,metricId)).for("update");
    if(!metric)throw new AppError(404,"Metric not found.");
    if(!metric.active)throw new AppError(409,"Restore this archived metric before recording values.");
    if(actor.role!=="admin"&&actor.id!==metric.ownerId)throw new AppError(403,"Only the metric owner or an admin can record values.");
    const [after]=await tx.insert(values).values({...input,id:randomUUID(),metricId,authorId:actor.id,unit:metric.unit,recordedAt:new Date()}).returning();
    await tx.insert(auditLogTable).values({id:randomUUID(),actorId:actor.id,action:"create",entityType:"scorecard_measurement",entityId:after!.id,before:null,after,via:"web"});
    return {id:after!.id};
  });
}

export async function deleteScorecardMeasurement(actor:StaffActor,id:string){
  return db.transaction(async tx=>{
    actor=await currentScorecardActor(tx,actor);
    const [before]=await tx.select().from(values).where(eq(values.id,id)).for("update");
    if(!before)throw new AppError(404,"Measurement not found.");
    if(actor.role!=="admin"&&before.authorId!==actor.id)throw new AppError(403,"You may delete only your own entries.");
    if(!before.deletedAt){
      const [after]=await tx.update(values).set({deletedAt:new Date(),deletedBy:actor.id}).where(eq(values.id,id)).returning();
      await tx.insert(auditLogTable).values({id:randomUUID(),actorId:actor.id,action:"remove",entityType:"scorecard_measurement",entityId:id,before,after,via:"web"});
    }
    return {id};
  });
}
