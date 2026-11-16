import { db, brainEntries as entries, brainChunks as chunks } from "@workspace/db";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { freshActor, getSettings, presentEntry } from "./core";
import { embed, modelState, modelMessage } from "./indexer";
import type { StaffActor } from "../permissions";
const filters=z.object({q:z.string().max(500).default(""),kind:z.string().optional(),programId:z.string().optional(),areaId:z.string().optional(),status:z.enum(["all","unreviewed","reviewed","overdue","conflicts","retired"]).default("all"),offset:z.coerce.number().int().min(0).max(100000).default(0)});
export async function searchBrain(actor:StaffActor,raw:unknown) {
  const f=filters.parse(raw),a=await freshActor(actor);
  const where=and(a.role==="admin"?undefined:eq(entries.visibility,"staff"),eq(entries.retired,f.status==="retired"),
    f.kind?eq(entries.kind,f.kind):undefined,f.programId?eq(entries.programId,f.programId):undefined,f.areaId?eq(entries.areaId,f.areaId):undefined,
    ["reviewed","unreviewed"].includes(f.status)?eq(entries.reviewStatus,f.status):undefined,
    f.status==="overdue"?sql`${entries.reviewDueAt}<now()`:undefined,f.status==="conflicts"?sql`${entries.conflict}<>''`:undefined);
  const defaults=await getSettings();
  if(!f.q.trim()) {
    const list=await db.select().from(entries).where(where).orderBy(sql`${entries.updatedAt} desc`).limit(50).offset(f.offset);
    const [count]=await db.select({n:sql<number>`count(*)::int`}).from(entries).where(where);
    return {entries:list.map(e=>presentEntry(a,e)),hits:[],total:count!.n,semanticReady:modelState==="ready",semanticMessage:modelMessage,defaultReviewDays:defaults.reviewIntervalDays};
  }
  let vector:number[]|null=null;
  try{ vector=await embed(f.q); }catch{/* Explicit semantic availability returned below. */}
  const keyword=sql`ts_rank_cd(to_tsvector('english', ${entries.title}||' '||${entries.summary}||' '||${entries.content}),websearch_to_tsquery('english',${f.q}))`;
  const body=await db.select({entry:entries,score:keyword}).from(entries).where(and(where,sql`to_tsvector('english', ${entries.title}||' '||${entries.summary}||' '||${entries.content}) @@ websearch_to_tsquery('english',${f.q})`)).orderBy(sql`${keyword} desc`).limit(100);
  const semantic=vector?sql<number>`1-(${chunks.embedding}<=>${JSON.stringify(vector)}::vector)`:sql<number>`0`;
  const chunkRank=sql<number>`ts_rank_cd(to_tsvector('english',${chunks.text}),websearch_to_tsquery('english',${f.q}))`;
  const chunkMatch=sql`to_tsvector('english',${chunks.text}) @@ websearch_to_tsquery('english',${f.q})`;
  const candidates=(predicate:SQL,order:SQL)=>db.select({entry:entries,text:chunks.text,label:chunks.label,page:chunks.page,fileId:chunks.fileId,similarity:semantic,keyword:chunkRank})
    .from(chunks).innerJoin(entries,and(eq(chunks.entryId,entries.id),eq(chunks.version,entries.version)))
    .where(and(where,predicate)).orderBy(order).limit(100);
  // Independent pools protect rare document terminology from semantic filtering
  // and from being crowded out before the lexical/semantic candidates are fused.
  const [lexical,semanticHits]=await Promise.all([
    candidates(chunkMatch,sql`${chunkRank} desc`),
    vector?candidates(sql`(${chunks.embedding}<=>${JSON.stringify(vector)}::vector)<0.8`,sql`${semantic} desc`):Promise.resolve([]),
  ]);
  const matched=[...lexical,...semanticHits];
  const hitMap=new Map<string,{entry:typeof entries.$inferSelect;excerpt:string;sourceLabel:string;page:number|null;fileId:string|null;score:number}>();
  const boost=(e:typeof entries.$inferSelect)=>e.reviewStatus==="reviewed"&&!e.conflict?0.1:0;
  for(const b of body)hitMap.set(b.entry.id,{entry:b.entry,excerpt:b.entry.content.slice(0,1000)||b.entry.summary,sourceLabel:"Entry text",page:null,fileId:null,score:2+Number(b.score)+boost(b.entry)});
  for(const m of matched){const keywordScore=Number(m.keyword);const score=(keywordScore>0?2:0)+Math.max(0,Number(m.similarity))*0.6+keywordScore+boost(m.entry);if(score>(hitMap.get(m.entry.id)?.score??-1))hitMap.set(m.entry.id,{entry:m.entry,excerpt:m.text.slice(0,1000),sourceLabel:m.label,page:m.page,fileId:m.fileId,score});}
  const ranked=[...hitMap.values()].sort((a,b)=>b.score-a.score),page=ranked.slice(f.offset,f.offset+50);
  return {entries:page.map(h=>presentEntry(a,h.entry)),hits:page.map(h=>({entryId:h.entry.id,title:h.entry.title,reviewStatus:h.entry.reviewStatus,overdue:!!h.entry.reviewDueAt&&h.entry.reviewDueAt<new Date(),conflict:h.entry.conflict,excerpt:h.excerpt,sourceLabel:h.sourceLabel,fileId:h.fileId,page:h.page,score:h.score,href:`/brain/${h.entry.id}`})),total:ranked.length,semanticReady:!!vector,semanticMessage:modelMessage,defaultReviewDays:defaults.reviewIntervalDays};
}
