import { db, brainEntries as entries, brainJobs as jobs, brainSettings as settings } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "../permissions";
import { freshActor, getSettings } from "./core";
import { MODEL, modelState, modelMessage } from "./indexer";
export async function adminBrain(actor:StaffActor) {
  requireAdmin(await freshActor(actor));
  const [stats]=await db.select({
    unreviewed:sql<number>`count(*) filter(where review_status='unreviewed' and not retired)::int`,
    overdue:sql<number>`count(*) filter(where review_due_at<now() and not retired)::int`,
    conflicts:sql<number>`count(*) filter(where conflict<>'' and not retired)::int`,
    failed:sql<number>`count(*) filter(where index_status='failed')::int`,
  }).from(entries);
  const queued=await db.select({id:jobs.id,entryId:jobs.entryId,title:entries.title,version:jobs.version,status:jobs.status,attempts:jobs.attempts,error:jobs.error}).from(jobs).innerJoin(entries,eq(jobs.entryId,entries.id)).orderBy(sql`${jobs.createdAt} desc`).limit(100);
  const duplicates=await db.execute(sql`select lower(trim(title)) as title,array_agg(id) as ids from brain_entries where not retired group by lower(trim(title)) having count(*)>1 limit 30`);
  const s=await getSettings();
  return {...stats,settingsVersion:s.version,reviewIntervalDays:s.reviewIntervalDays,jobs:queued,duplicates:duplicates.rows,model:MODEL,modelState,modelMessage};
}
export async function updateSettings(actor:StaffActor,raw:unknown) {
  const p=z.object({reviewIntervalDays:z.number().int().min(7).max(730),expectedVersion:z.number().int().positive()}).strict().parse(raw);
  await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    requireAdmin(await freshActor(actor,tx));
    const [s]=await tx.select().from(settings).where(eq(settings.id,"default"));
    if((s?.version??1)!==p.expectedVersion)throw new AppError(409,"Settings changed. Reload.");
    await tx.insert(settings).values({id:"default",reviewIntervalDays:p.reviewIntervalDays,version:p.expectedVersion+1}).onConflictDoUpdate({target:settings.id,set:{reviewIntervalDays:p.reviewIntervalDays,version:p.expectedVersion+1}});
  });return {id:"default"};
}
export async function queueIndex(actor:StaffActor,jobId?:string) {
  requireAdmin(await freshActor(actor));
  let entryId:string|undefined;
  if(jobId){const [j]=await db.select().from(jobs).where(eq(jobs.id,jobId));if(!j)throw new AppError(404,"Job not found.");entryId=j.entryId;}
  const list=await db.select().from(entries).where(entryId?eq(entries.id,entryId):undefined);
  for(const e of list) {
    await db.insert(jobs).values({id:randomUUID(),entryId:e.id,version:e.version}).onConflictDoUpdate({target:[jobs.entryId,jobs.version],set:{status:"pending",attempts:0,error:null,availableAt:new Date(),lockedAt:null}});
    await db.update(entries).set({indexStatus:"pending"}).where(eq(entries.id,e.id));
  }return {id:entryId??"all"};
}
