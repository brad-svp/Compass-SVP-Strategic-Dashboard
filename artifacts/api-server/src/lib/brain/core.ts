import { randomUUID } from "node:crypto";
import { db, usersTable, brainEntries as entries, brainVersions as versions, brainJobs as jobs, brainSettings as settings, brainFiles as files, auditLogTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "../permissions";

export type Entry = typeof entries.$inferSelect;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const entryInput = z.object({
  title: z.string().trim().min(1).max(240), summary: z.string().max(2000), content: z.string().max(80000),
  kind: z.enum(["playbook","procedure","strategy","decision","lesson","reference"]),
  programId: z.string().nullable(), areaId: z.string().nullable(), ownerId: z.string().min(1),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  sourceUrls: z.array(z.string().url().max(2000).refine(s => /^https?:\/\//.test(s))).max(20),
  links: z.array(z.object({domain:z.string().max(60),id:z.string().max(100),label:z.string().max(200)}).strict()).max(30),
  visibility: z.enum(["staff","admin"]), reviewIntervalDays:z.number().int().min(7).max(730),
  expectedVersion:z.number().int().min(0), requestKey:z.string().min(1).max(100).optional(),
}).strict();
export async function freshActor(actor: StaffActor, tx: Pick<typeof db,"select"> = db) {
  const [a] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
  if (!a?.active) throw new AppError(403,"Your staff access is no longer available.");
  return a;
}
export const canRead = (a: StaffActor,e: Entry) => a.active && (e.visibility === "staff" || a.role === "admin");
export const canEdit = (a: StaffActor,e: Entry) => canRead(a,e) && (a.role === "admin" || (!e.retired && e.authorId === a.id && e.reviewStatus === "unreviewed"));
export function presentEntry(a: StaffActor,e: Entry) {
  return {...e, requestKey:e.requestKey??undefined, expectedVersion:e.version, overdue:!!e.reviewDueAt && e.reviewDueAt < new Date(), canEdit:canEdit(a,e),
    createdAt:e.createdAt.toISOString(),updatedAt:e.updatedAt.toISOString(),reviewedAt:e.reviewedAt?.toISOString()??null,reviewDueAt:e.reviewDueAt?.toISOString()??null};
}
export async function getEntry(a: StaffActor,id:string,tx: Pick<typeof db,"select"> = db) {
  const [e] = await tx.select().from(entries).where(eq(entries.id,id));
  if (!e || !canRead(a,e)) throw new AppError(404,"Knowledge not found.");
  return e;
}
export async function recordVersion(tx:Tx,a:StaffActor,e:Entry,action:string,note="",via:"web"|"mcp"="web") {
  const fs=await tx.select({id:files.id}).from(files).where(and(eq(files.entryId,e.id),sql`${files.deletedAt} is null`,sql`${files.objectPath} is not null`));
  await tx.insert(versions).values({id:randomUUID(),entryId:e.id,version:e.version,snapshot:JSON.parse(JSON.stringify(e)),fileIds:fs.map(f=>f.id),actorId:a.id,action,note});
  await tx.insert(jobs).values({id:randomUUID(),entryId:e.id,version:e.version}).onConflictDoNothing();
  await tx.insert(auditLogTable).values({id:randomUUID(),actorId:a.id,action,entityType:"brain",entityId:e.id,after:{version:e.version},via});
}
export async function saveEntry(actor:StaffActor,raw:unknown,id?:string,via:"web"|"mcp"="web") {
  const input=entryInput.parse(raw);
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const a=await freshActor(actor,tx);
    if(a.role!=="admin"&&(input.visibility!=="staff"||input.ownerId!==a.id)) throw new AppError(403,"Staff contributions must be staff-visible and owned by you.");
    if(input.requestKey&&!id) {
      const [old]=await tx.select().from(entries).where(and(eq(entries.authorId,a.id),eq(entries.requestKey,input.requestKey)));
      if(old) return {id:old.id};
    }
    const before=id?await getEntry(a,id,tx):null;
    if(before&&!canEdit(a,before)) throw new AppError(403,"Only an administrator or the author of an unreviewed contribution can edit it.");
    if(before&&before.version!==input.expectedVersion) throw new AppError(409,"This entry changed. Reload before saving.");
    if(!before&&input.expectedVersion!==0) throw new AppError(409,"New entries must start at version zero.");
    const {expectedVersion:_v,requestKey,...data}=input;
    const value={...data,reviewStatus:"unreviewed",reviewedAt:null,reviewerId:null,reviewDueAt:null,indexStatus:"pending",updatedAt:new Date(),version:(before?.version??0)+1};
    const [e]=before?await tx.update(entries).set(value).where(eq(entries.id,before.id)).returning():await tx.insert(entries).values({...value,id:randomUUID(),authorId:a.id,via,requestKey}).returning();
    await recordVersion(tx,a,e!,before?"amend":"contribute","",via);
    return {id:e!.id};
  });
}
export async function entryDetail(actor:StaffActor,id:string) {
  const a=await freshActor(actor), e=await getEntry(a,id);
  const fs=await db.select().from(files).where(and(eq(files.entryId,id),sql`${files.deletedAt} is null`));
  const vs=await db.select().from(versions).where(eq(versions.entryId,id)).orderBy(sql`${versions.version} desc`).limit(100);
  return {entry:presentEntry(a,e),files:fs.map(f=>({id:f.id,name:f.name,contentType:f.contentType,size:f.size,status:f.status,error:f.error,downloadUrl:`/api/svp/brain/files/${f.id}`,createdAt:f.createdAt.toISOString()})),
    versions:vs.filter(v=>a.role==="admin"||v.snapshot.visibility==="staff").map(v=>({id:v.id,version:v.version,actorId:v.actorId,action:v.action,note:v.note,fileIds:v.fileIds,title:String(v.snapshot.title??""),summary:String(v.snapshot.summary??""),content:String(v.snapshot.content??""),createdAt:v.createdAt.toISOString()}))};
}
export const actionInput=z.object({action:z.enum(["approve","retire","restore","restore_version","flag_conflict","clear_conflict","merge","propose_amendment"]),expectedVersion:z.number().int().min(1),note:z.string().max(8000).optional(),versionId:z.string().optional(),targetId:z.string().optional()}).strict();
export async function actEntry(actor:StaffActor,id:string,raw:unknown,via:"web"|"mcp"="web") {
  const input=actionInput.parse(raw);
  if(input.action==="propose_amendment") {
    const a=await freshActor(actor),e=await getEntry(a,id);
    if(e.version!==input.expectedVersion)throw new AppError(409,"Entry changed. Reload first.");
    if(!input.note?.trim())throw new AppError(400,"Describe the proposed amendment.");
    return saveEntry(a,{title:`Amendment: ${e.title}`.slice(0,240),summary:`Proposed amendment to ${e.id}`,content:input.note,kind:"decision",programId:e.programId,areaId:e.areaId,ownerId:a.id,tags:["proposed-amendment"],sourceUrls:[],links:[{domain:"brain",id:e.id,label:e.title}],visibility:e.visibility,reviewIntervalDays:e.reviewIntervalDays,expectedVersion:0},undefined,via);
  }
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const a=await freshActor(actor,tx);
    const e=await getEntry(a,id,tx);
    if(e.version!==input.expectedVersion) throw new AppError(409,"This entry changed. Reload before continuing.");
    requireAdmin(a);
    let patch:Partial<Entry>={};
    if(input.action==="approve") patch={reviewStatus:"reviewed",reviewedAt:new Date(),reviewerId:a.id,reviewDueAt:new Date(Date.now()+e.reviewIntervalDays*86400000),conflict:""};
    if(input.action==="flag_conflict") patch={conflict:input.note||"Needs administrator resolution",reviewStatus:"unreviewed"};
    if(input.action==="clear_conflict") patch={conflict:""};
    if(input.action==="retire"||input.action==="restore") patch={retired:input.action==="retire"};
    if(input.action==="merge") {
      if(!input.targetId||input.targetId===id) throw new AppError(400,"Choose another destination entry.");
      const dest=await getEntry(a,input.targetId,tx);
      if(dest.retired||dest.visibility!==e.visibility) throw new AppError(400,"Merge destination must be active with the same visibility. Amend its content before retiring this duplicate.");
      patch={retired:true,mergedIntoId:dest.id};
    }
    if(input.action==="restore_version") {
      const [v]=await tx.select().from(versions).where(and(eq(versions.entryId,id),eq(versions.id,input.versionId??"")));
      if(!v) throw new AppError(404,"Version not found.");
      const restored=entryInput.parse(Object.fromEntries(Object.keys(entryInput.shape).map(k=>[k,k==="expectedVersion"?e.version:k==="requestKey"?(v.snapshot[k]??undefined):v.snapshot[k]])));
      const {expectedVersion:_v,requestKey:_r,...fields}=restored;
      patch={...fields,reviewStatus:"unreviewed",reviewedAt:null,reviewerId:null,reviewDueAt:null,retired:false,mergedIntoId:null};
      await tx.update(files).set({deletedAt:new Date()}).where(eq(files.entryId,id));
      for(const fileId of v.fileIds)await tx.update(files).set({deletedAt:null}).where(and(eq(files.id,fileId),eq(files.entryId,id),sql`${files.objectPath} is not null`));
    }
    const [updated]=await tx.update(entries).set({...patch,version:e.version+1,indexStatus:"pending",updatedAt:new Date()}).where(eq(entries.id,id)).returning();
    await recordVersion(tx,a,updated!,input.action,input.note??"",via);
    return {id};
  });
}
export async function getSettings() {
  return (await db.select().from(settings).where(eq(settings.id,"default")))[0]??{id:"default",reviewIntervalDays:90,version:1};
}
