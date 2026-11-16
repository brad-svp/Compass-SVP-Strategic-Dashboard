import { randomUUID } from "node:crypto";
import { db, usersTable, cyclesTable, quarterNarrativesTable as narratives, auditLogTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "./permissions";
const params=z.object({cycleId:z.string().min(1),quarter:z.enum(["Q1","Q2","Q3","Q4"])});
const input=z.object({narrative:z.string().max(12000),expectedVersion:z.number().int().nonnegative()}).strict();
export async function getQuarterNarrative(actor:StaffActor,cycleId:string,quarter:string) {
  params.parse({cycleId,quarter});
  const [cycle]=await db.select({id:cyclesTable.id}).from(cyclesTable).where(eq(cyclesTable.id,cycleId));
  if(!cycle)throw new AppError(404,"Planning cycle not found.");
  const [n]=await db.select().from(narratives).where(and(eq(narratives.cycleId,cycleId),eq(narratives.quarter,quarter)));
  return {cycleId,quarter,narrative:n?.narrative??"",version:n?.version??0,canEdit:actor.role==="admin",updatedAt:n?.updatedAt.toISOString()??null};
}
export async function saveQuarterNarrative(actor:StaffActor,cycleId:string,quarter:string,raw:unknown) {
  params.parse({cycleId,quarter});const d=input.parse(raw);
  await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const [currentActor]=await tx.select().from(usersTable).where(eq(usersTable.id,actor.id));
    if(!currentActor)throw new AppError(403,"Staff access is unavailable."); requireAdmin(currentActor);
    const [cycle]=await tx.select().from(cyclesTable).where(eq(cyclesTable.id,cycleId));
    if(!cycle)throw new AppError(404,"Planning cycle not found.");
    const [before]=await tx.select().from(narratives).where(and(eq(narratives.cycleId,cycleId),eq(narratives.quarter,quarter)));
    if((before?.version??0)!==d.expectedVersion)throw new AppError(409,"The quarterly narrative changed. Reload before saving.");
    const values={cycleId,quarter,narrative:d.narrative.trim(),version:(before?.version??0)+1,updatedBy:actor.id,updatedAt:new Date()};
    if(before)await tx.update(narratives).set(values).where(and(eq(narratives.cycleId,cycleId),eq(narratives.quarter,quarter)));
    else await tx.insert(narratives).values(values);
    await tx.insert(auditLogTable).values({id:randomUUID(),actorId:actor.id,action:"set_quarter_narrative",entityType:"quarter_narrative",entityId:`${cycleId}:${quarter}`,before:before??null,after:values,via:"web"});
  });
  return getQuarterNarrative(actor,cycleId,quarter);
}
