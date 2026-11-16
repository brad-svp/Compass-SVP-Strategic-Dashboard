import { randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { db, brainEntries as entries, brainJobs as jobs, brainFiles as files, brainChunks as chunks } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { ObjectStorageService } from "../objectStorage";
import { logger } from "../logger";
import { chunkText, extractDocument } from "./extraction";
export const MODEL="Xenova/all-MiniLM-L6-v2";
export const MODEL_REVISION="751bff37182d3f1213fa05d7196b954e230abad9";
let modelPromise:Promise<any>|null=null;
export let modelState="not_loaded";
export let modelMessage="Local semantic model has not loaded yet.";
export async function embed(text:string):Promise<number[]> {
  if(!modelPromise) {
    modelState="loading"; modelMessage="Loading local semantic model.";
    modelPromise=(async()=>{
      const {env,pipeline}=await import("@huggingface/transformers");
      let root=process.cwd();
      while(!existsSync(path.join(root,"pnpm-workspace.yaml"))&&path.dirname(root)!==root)root=path.dirname(root);
      env.cacheDir=path.resolve(root,"generated-artifacts/models");
      const p=await pipeline("feature-extraction",MODEL,{revision:MODEL_REVISION,dtype:"q8",device:"cpu"});
      modelState="ready";modelMessage="Local semantic search ready (384 dimensions).";return p;
    })().catch(e=>{modelState="failed";modelMessage="Semantic model failed to load. Keyword search remains available; retry indexing to recover.";modelPromise=null;throw e;});
  }
  const p=await modelPromise;
  const r=await p(text.slice(0,6000),{pooling:"mean",normalize:true});
  return Array.from(r.data as Float32Array);
}
let running=false;
export async function processBrainJobs() {
  if(running)return;running=true;
  try {
    await db.update(jobs).set({status:"pending",lockedAt:null}).where(and(eq(jobs.status,"processing"),sql`${jobs.lockedAt}<now()-interval '10 minutes'`));
    const claimed=await db.execute(sql`update brain_jobs set status='processing', locked_at=now(), attempts=attempts+1
      where id=(select id from brain_jobs where status='pending' and available_at<=now() order by created_at for update skip locked limit 1) returning *`);
    const job=claimed.rows[0] as {id:string;entry_id:string;version:number;attempts:number}|undefined;
    if(!job)return;
    try {
      const [e]=await db.select().from(entries).where(eq(entries.id,job.entry_id));
      if(!e||e.version!==job.version) {await db.update(jobs).set({status:"superseded"}).where(eq(jobs.id,job.id));return;}
      const sources:{text:string;label:string;page:number|null;fileId:string|null}[]=[{text:`${e.title}\n${e.summary}\n${e.content}`,label:"Entry text",page:null,fileId:null}];
      if(!e.retired) {
        const fs=await db.select().from(files).where(and(eq(files.entryId,e.id),sql`${files.deletedAt} is null`,sql`${files.objectPath} is not null`));
        for(const f of fs) {
          let pages=f.pages;
          if(f.status!=="searchable"&&f.status!=="text_empty"&&f.status!=="unsupported"){
            try {
              const obj=await new ObjectStorageService().getObjectEntityFile(f.objectPath!);
              const [meta]=await obj.getMetadata();
              if(Number(meta.size)>20*1024*1024)throw new Error("Stored file exceeds extraction limit.");
              const [bytes]=await obj.download();
              pages=await extractDocument(bytes,f.name);
              const supported=/\.(pdf|docx|txt|md|csv)$/i.test(f.name);
              await db.update(files).set({pages,status:!supported?"unsupported":pages.some(p=>p.text.trim())?"searchable":"text_empty",error:null}).where(eq(files.id,f.id));
            }catch(err){await db.update(files).set({status:"failed",error:err instanceof Error?err.message:"Extraction failed"}).where(eq(files.id,f.id));throw err;}
          }
          sources.push(...pages.map(p=>({...p,fileId:f.id})));
        }
      }
      const rows:typeof chunks.$inferInsert[]=[];
      if(!e.retired) for(const s of sources)for(const text of chunkText(s.text)) {
        if(rows.length>=600)throw new Error("Entry exceeds 600 searchable chunks. Split large references into separate entries.");
        rows.push({id:randomUUID(),entryId:e.id,version:e.version,fileId:s.fileId,label:s.label,page:s.page,text,embedding:await embed(text),model:MODEL});
      }
      await db.transaction(async tx=>{
        const [current]=await tx.select().from(entries).where(eq(entries.id,e.id)).for("update");
        if(current?.version!==e.version) {await tx.update(jobs).set({status:"superseded"}).where(eq(jobs.id,job.id));return;}
        await tx.delete(chunks).where(eq(chunks.entryId,e.id));
        for(let i=0;i<rows.length;i+=40)await tx.insert(chunks).values(rows.slice(i,i+40));
        await tx.update(entries).set({indexStatus:"ready",indexedVersion:e.version}).where(eq(entries.id,e.id));
        await tx.update(jobs).set({status:"done",error:null}).where(eq(jobs.id,job.id));
      });
    }catch(err){
      logger.error({err,jobId:job.id},"Brain indexing failed");
      await db.update(jobs).set({status:job.attempts<3?"pending":"failed",error:err instanceof Error?err.message:"Indexing failed",availableAt:new Date(Date.now()+60000)}).where(eq(jobs.id,job.id));
      await db.update(entries).set({indexStatus:"failed"}).where(and(eq(entries.id,job.entry_id),eq(entries.version,job.version)));
    }
  }finally {running=false;}
}
export function startBrainWorker(){const timer=setInterval(()=>void processBrainJobs().catch(err=>logger.error({err},"Brain worker failed")),3000);timer.unref();}
