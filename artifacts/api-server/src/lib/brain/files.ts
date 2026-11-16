import { randomUUID } from "node:crypto";
import { db, brainFiles as files, brainEntries as entries } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ObjectStorageService, objectStorageClient } from "../objectStorage";
import { AppError, type StaffActor } from "../permissions";
import { canEdit, freshActor, getEntry, recordVersion } from "./core";
const storage=new ObjectStorageService();
export const uploadInput=z.object({entryId:z.string(),name:z.string().min(1).max(240).refine(s=>!/[\/\\\x00-\x1f]/.test(s),"Invalid file name"),size:z.number().int().min(1).max(20971520),contentType:z.string().min(1).max(150),expectedVersion:z.number().int().positive(),replacesId:z.string().optional()}).strict();
export async function requestUpload(actor:StaffActor,raw:unknown) {
  const d=uploadInput.parse(raw),a=await freshActor(actor),e=await getEntry(a,d.entryId);
  if(!canEdit(a,e))throw new AppError(403,"You cannot amend this entry.");
  if(e.version!==d.expectedVersion)throw new AppError(409,"Reload this entry before uploading.");
  const uploadURL=await storage.getObjectEntityUploadURL(),id=randomUUID();
  await db.insert(files).values({...d,id,actorId:a.id,pendingPath:storage.normalizeObjectEntityPath(uploadURL),expiresAt:new Date(Date.now()+15*60000)});
  return {id,uploadURL};
}
export async function completeUpload(actor:StaffActor,id:string) {
  const a=await freshActor(actor),[f]=await db.select().from(files).where(eq(files.id,id));
  if(!f||f.actorId!==a.id)throw new AppError(404,"Upload not found.");
  const e=await getEntry(a,f.entryId);
  if(!canEdit(a,e))throw new AppError(403,"You cannot amend this entry.");
  if(f.objectPath)return {id:e.id};
  if(f.expiresAt<new Date())throw new AppError(400,"Upload expired.");
  const source=await storage.getObjectEntityFile(f.pendingPath),[meta]=await source.getMetadata();
  if(Number(meta.size)!==f.size||meta.contentType!==f.contentType)throw new AppError(400,"Uploaded metadata does not match.");
  const objectPath=`/objects/brain/${randomUUID()}`;
  const parts=storage.getPrivateObjectDir().replace(/^\/+|\/+$/g,"").split("/"),bucket=parts.shift()!;
  await source.bucket.file(source.name,{generation:meta.generation}).copy(objectStorageClient.bucket(bucket).file(`${parts.join("/")}/${objectPath.slice(9)}`));
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const actorNow=await freshActor(a,tx),current=await getEntry(actorNow,e.id,tx);
    if(!canEdit(actorNow,current))throw new AppError(403,"Entry is no longer editable.");
    const [latest]=await tx.select().from(files).where(eq(files.id,id));
    if(latest?.objectPath)return {id:e.id};
    if(current.version!==f.expectedVersion)throw new AppError(409,"Entry changed before upload completed. Start the upload again.");
    if(f.replacesId) {
      const [old]=await tx.select().from(files).where(eq(files.id,f.replacesId));
      if(!old||old.entryId!==e.id||old.deletedAt)throw new AppError(400,"Replacement file not found on this entry.");
      await tx.update(files).set({deletedAt:new Date()}).where(eq(files.id,old.id));
    }
    await tx.update(files).set({objectPath,status:"processing"}).where(eq(files.id,id));
    const [updated]=await tx.update(entries).set({version:current.version+1,reviewStatus:"unreviewed",reviewedAt:null,reviewDueAt:null,indexStatus:"pending",updatedAt:new Date()}).where(eq(entries.id,e.id)).returning();
    await recordVersion(tx,actorNow,updated!,"attach_file");return {id:e.id};
  });
}
export async function fileFor(actor:StaffActor,id:string) {
  const a=await freshActor(actor),[f]=await db.select().from(files).where(eq(files.id,id));
  if(!f||f.deletedAt||!f.objectPath)throw new AppError(404,"File not found.");
  await getEntry(a,f.entryId);
  return {file:await storage.getObjectEntityFile(f.objectPath),name:f.name};
}
export async function removeFile(actor:StaffActor,id:string,expectedVersion:number) {
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const a=await freshActor(actor,tx),[f]=await tx.select().from(files).where(eq(files.id,id));
    if(!f||f.deletedAt)throw new AppError(404,"File not found.");
    const e=await getEntry(a,f.entryId,tx);
    if(!canEdit(a,e))throw new AppError(403,"You cannot amend this entry.");
    if(e.version!==expectedVersion)throw new AppError(409,"Entry changed. Reload before removing.");
    await tx.update(files).set({deletedAt:new Date()}).where(eq(files.id,id));
    const [updated]=await tx.update(entries).set({version:e.version+1,reviewStatus:"unreviewed",reviewDueAt:null,indexStatus:"pending",updatedAt:new Date()}).where(eq(entries.id,e.id)).returning();
    await recordVersion(tx,a,updated!,"remove_file");return {id:e.id};
  });
}
