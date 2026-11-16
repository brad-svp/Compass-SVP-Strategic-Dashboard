import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, type StaffActor } from "../permissions";
import { freshActor } from "./core";
// Identifiers and columns are fixed by code, never supplied as SQL by a client.
export const DOMAINS={
  people:{table:"users",columns:"id,name,area_id,role,role_description,active",deleted:false},
  areas:{table:"areas",columns:"id,name,color,sort_order",deleted:false},
  cycles:{table:"cycles",columns:"id,name,start_date,end_date,status",deleted:false},
  qbos:{table:"objectives",columns:"id,cycle_id,level,owner_id,area_id,parent_objective_id,title,description,time_scope,status,sort_order,created_at,updated_at",deleted:true},
  key_results:{table:"key_results",columns:"id,objective_id,owner_id,title,measurement_type,unit,start_value,target_value,current_value,confidence,calendar_event_id,created_at,updated_at",deleted:true},
  check_ins:{table:"check_ins",columns:"id,key_result_id,author_id,value,confidence,note,created_at",deleted:false},
  comments:{table:"comments",columns:"id,entity_type,entity_id,author_id,body,created_at",deleted:false},
  scorecard_metrics:{table:"scorecard_metrics",columns:"*",deleted:false},
  scorecard_entries:{table:"scorecard_entries",columns:"*",deleted:false},
  scorecard_history:{table:"scorecard_revisions",columns:"*",deleted:false},
  six_periods:{table:"periods",columns:"id,name,start_date,end_date,meeting_date,meeting_notes,status,version",deleted:false},
  six_items:{table:"six_items",columns:"*",deleted:true},
  six_slots:{table:"major_moments",columns:"id,period_id,position",deleted:false},
  accountability:{table:"accountability_seats",columns:"*",deleted:false},
  calendar:{table:"calendar_events",columns:"*",deleted:true},
  programs:{table:"calendar_programs",columns:"id,name,active,logo_id,version",deleted:false},
  systems:{table:"systems",columns:"*",deleted:true},
  purpose:{table:"organization_purpose",columns:"*",deleted:false},
  quarter_narratives:{table:"quarter_narratives",columns:"*",deleted:false},
  audit:{table:"audit_log",columns:"id,actor_id,action,entity_type,entity_id,via,created_at",deleted:false},
} as const;
export const operatingInput=z.object({domain:z.enum(Object.keys(DOMAINS) as [keyof typeof DOMAINS,...(keyof typeof DOMAINS)[]]),id:z.string().max(200).optional(),offset:z.number().int().min(0).max(100000).default(0),limit:z.number().int().min(1).max(100).default(30),parentId:z.string().max(200).optional(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict();
const parentCols:Partial<Record<keyof typeof DOMAINS,string>>={qbos:"cycle_id",key_results:"objective_id",check_ins:"key_result_id",six_items:"moment_id",six_slots:"period_id",scorecard_entries:"metric_id",scorecard_history:"metric_id"};
export async function readOperations(actor:StaffActor,raw:unknown) {
  const a=await freshActor(actor),p=operatingInput.parse(raw);
  if(p.domain==="audit"&&a.role!=="admin")throw new AppError(403,"Audit data is administrator-only.");
  const d=DOMAINS[p.domain],conditions=[sql`true`];
  if(d.deleted)conditions.push(sql.raw("deleted_at is null"));
  if(p.id) {
    if(p.domain==="quarter_narratives")throw new AppError(400,"Filter quarterly narratives with pagination.");
    conditions.push(sql`id=${p.id}`);
  }
  if(p.parentId){const col=parentCols[p.domain];if(!col)throw new AppError(400,"Parent filtering is not supported for this domain.");conditions.push(sql`${sql.raw(col)}=${p.parentId}`);}
  if(p.domain==="calendar"){if(p.from)conditions.push(sql`coalesce(end_date,start_date)>=${p.from}`);if(p.to)conditions.push(sql`start_date<=${p.to}`);}
  const result=await db.transaction(async tx=>{
    await tx.execute(sql`set local statement_timeout='4000ms'`);
    return tx.execute(sql`select ${sql.raw(d.columns)} from ${sql.raw(d.table)} where ${sql.join(conditions,sql` and `)} order by ${sql.raw(p.domain==="quarter_narratives"?"cycle_id,quarter":"id")} limit ${p.limit+1} offset ${p.offset}`);
  },{accessMode:"read only"});
  return {domain:p.domain,asOf:new Date().toISOString(),records:result.rows.slice(0,p.limit),nextOffset:result.rows.length>p.limit?p.offset+p.limit:null,
    note:p.domain==="six_slots"?"Legacy shared moment labels are not personal priorities. These are internal numbered slots only. Personal commitments are in six_items; join owner_id and moment_id.":undefined};
}
