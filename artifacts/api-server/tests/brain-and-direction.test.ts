import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { zipSync, strToU8 } from "fflate";
import { db, pool, areasTable, usersTable, cyclesTable, calendarEventsTable, brainEntries, brainFiles, brainJobs, brainChunks, brainOAuthGrants, brainOAuthTokens, brainOAuthRequests } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { saveEntry, entryDetail, actEntry, type Entry } from "../src/lib/brain/core";
import { searchBrain } from "../src/lib/brain/search";
import { embed, processBrainJobs } from "../src/lib/brain/indexer";
import { extractDocument, chunkText } from "../src/lib/brain/extraction";
import { BrainOAuth, decideConsent, hash } from "../src/lib/brain/oauth";
import { DOMAINS, readOperations } from "../src/lib/brain/operations";
import { getQuarterNarrative, saveQuarterNarrative } from "../src/lib/quarterNarrativeService";
import { getSixViewPreferences,saveSixViewPreferences } from "../src/lib/staffViewPreferencesService";
import { saveCalendarEvent,getMasterCalendar } from "../src/lib/calendarService";
import { renderCalendarIcs } from "../src/lib/calendarIcs";
import { saveSixPeriod, saveSixItem, getSixBySix } from "../src/lib/sixBySixService";
import { GetBrainEntryResponse, GetBrainResponse, GetQuarterNarrativeResponse, GetBrainAdminResponse } from "@workspace/api-zod";
import { adminBrain } from "../src/lib/brain/admin";
import type { StaffActor } from "../src/lib/permissions";
import { TOOLS, toolScope } from "../src/routes/brain-mcp";
import { createServer } from "node:http";
import { once } from "node:events";
import express from "express";
import brainMcpRouter from "../src/routes/brain-mcp";
const schema=`brain_test_${randomUUID().replaceAll("-","")}`;
let admin:StaffActor,staff:StaffActor,other:StaffActor;
const failure=(code:number)=>(e:any)=>e.status===code;
const draft=(patch:Record<string,unknown>={})=>({title:"Fast Pitch rehearsal procedure",summary:"Speaker rehearsal operations",content:"Rehearse presentations with nonprofit speakers and volunteer coaches. Review presentation timing.",kind:"procedure",programId:null,areaId:"area",ownerId:"staff",tags:["fast-pitch"],sourceUrls:[],links:[],visibility:"staff",reviewIntervalDays:90,expectedVersion:0,...patch});
before(async()=>{
  pool.options.options=`-c search_path=${schema},public`;
  const client=await pool.connect();
  try {
    await client.query(`create schema "${schema}"; set search_path to "${schema}",public`);
    const root=new URL("../../../lib/db/drizzle/",import.meta.url);
    for(const file of (await readdir(root)).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
      const migration=await readFile(new URL(file,root),"utf8");
      await client.query(migration.replaceAll('"public".',`"${schema}".`));
    }
  }finally{client.release();}
  await db.insert(areasTable).values({id:"area",name:"Test area",color:"#1D8BC4"});
  [admin,staff,other]=await db.insert(usersTable).values([
    {id:"admin",name:"Admin",role:"admin",areaId:"area",clerkId:"user_admin",email:"admin-test@svpsacramento.org"},
    {id:"staff",name:"Staff",role:"staff",areaId:"area",clerkId:"user_staff",email:"staff-test@svpsacramento.org"},
    {id:"other",name:"Other",role:"staff",areaId:"area"},
  ]).returning();
  await db.insert(cyclesTable).values([{id:"cycle-a",name:"Test year A",startDate:"1980-01-01",endDate:"1980-12-31"},{id:"cycle-b",name:"Test year B",startDate:"1981-01-01",endDate:"1981-12-31"}]);
});
after(async()=>{await pool.query(`drop schema if exists "${schema}" cascade`);await pool.end();});

test("quarter narrative is optional, admin-only, year-and-quarter scoped, versioned and clearable",async()=>{
  assert.equal((await getQuarterNarrative(staff,"cycle-a","Q1")).narrative,"");
  await assert.rejects(saveQuarterNarrative(staff,"cycle-a","Q1",{narrative:"No",expectedVersion:0}),failure(403));
  GetQuarterNarrativeResponse.parse(await saveQuarterNarrative(admin,"cycle-a","Q1",{narrative:"Focus on program delivery.",expectedVersion:0}));
  assert.equal((await getQuarterNarrative(staff,"cycle-a","Q1")).canEdit,false);
  assert.equal((await getQuarterNarrative(staff,"cycle-a","Q2")).narrative,"");
  assert.equal((await getQuarterNarrative(staff,"cycle-b","Q1")).narrative,"");
  await assert.rejects(saveQuarterNarrative(admin,"cycle-a","Q1",{narrative:"Overwrite",expectedVersion:0}),failure(409));
  assert.equal((await saveQuarterNarrative(admin,"cycle-a","Q1",{narrative:"",expectedVersion:1})).version,2);
  assert.equal((await getQuarterNarrative(staff,"cycle-a","Q1")).narrative,"");
});
test("personal six-week priorities are independent and staff cannot change another person's plan",async()=>{
  const p=await saveSixPeriod(admin,{name:"Test period",startDate:"1980-01-01",endDate:"1980-02-11",meetingDate:null,meetingNotes:"",status:"closed",expectedVersion:0});
  const period=(await getSixBySix(staff)).periods.find(p1=>p1.id===p.id)!;
  const first=period.moments[0]!.id;
  const a=await saveSixItem(staff,{momentId:first,ownerId:staff.id,title:"My independent priority",description:"",status:"planned"});
  await saveSixItem(other,{momentId:first,ownerId:other.id,title:"A different personal priority",description:"",status:"planned"});
  await assert.rejects(saveSixItem(other,{ownerId:other.id,title:"Hijack",description:"",status:"done",expectedVersion:1},a.id),failure(403));
  const items=(await getSixBySix(staff)).items;
  assert.equal(items.length,2);assert.equal(items.find(i=>i.id===a.id)!.canEdit,true);
  assert.equal(items.find(i=>i.ownerId===other.id)!.canEdit,false);
});
let entryId="";
test("knowledge is immediately searchable Unreviewed, idempotent, owned and versioned",async()=>{
  const result=await saveEntry(staff,draft({requestKey:"decision-1"}));entryId=result.id;
  assert.equal((await saveEntry(staff,draft({requestKey:"decision-1"}))).id,entryId);
  const d=GetBrainEntryResponse.parse(await entryDetail(staff,entryId));assert.equal(d.entry.reviewStatus,"unreviewed");
  const found=GetBrainResponse.parse(await searchBrain(staff,{q:"rehearsal"}));
  assert.equal(found.hits[0]?.entryId,entryId);
  await assert.rejects(saveEntry(other,draft({ownerId:other.id,expectedVersion:1}),entryId),failure(403));
  await saveEntry(staff,draft({expectedVersion:1,content:"Rehearse nonprofit presentations twice."}),entryId);
  await assert.rejects(saveEntry(staff,draft({expectedVersion:1}),entryId),failure(409));
  assert.equal((await entryDetail(staff,entryId)).versions.length,2);
});
test("review, proposals, conflict, restore and retirement preserve trust and permissions",async()=>{
  await assert.rejects(actEntry(staff,entryId,{action:"approve",expectedVersion:2}),failure(403));
  await actEntry(admin,entryId,{action:"approve",expectedVersion:2});
  await assert.rejects(saveEntry(staff,draft({expectedVersion:3}),entryId),failure(403));
  const proposal=await actEntry(staff,entryId,{action:"propose_amendment",expectedVersion:3,note:"Add a checklist."},"mcp");
  assert.equal((await entryDetail(staff,proposal.id)).entry.reviewStatus,"unreviewed");
  assert.equal((await entryDetail(staff,proposal.id)).entry.via,"mcp");
  await actEntry(admin,entryId,{action:"flag_conflict",expectedVersion:3,note:"Verify rehearsal count."});
  assert.equal((await searchBrain(staff,{status:"conflicts"})).entries.some(e=>e.id===entryId),true);
  const version=(await entryDetail(admin,entryId)).versions.find(v=>v.version===1)!;
  await actEntry(admin,entryId,{action:"restore_version",expectedVersion:4,versionId:version.id});
  assert.equal((await entryDetail(staff,entryId)).entry.content,draft().content);
  await actEntry(admin,entryId,{action:"retire",expectedVersion:5});
  assert.equal((await searchBrain(staff,{q:"rehearsal"})).hits.some(e=>e.entryId===entryId),false);
  await actEntry(admin,entryId,{action:"restore",expectedVersion:6});
});
test("private knowledge never leaks through search, detail or prior-version history",async()=>{
  const p=await saveEntry(admin,draft({ownerId:admin.id,visibility:"admin",title:"Restricted strategy",content:"Confidential zephyr funding strategy."}));
  GetBrainEntryResponse.parse(await entryDetail(admin,p.id));
  assert.equal((await searchBrain(staff,{q:"zephyr"})).total,0);
  await assert.rejects(entryDetail(staff,p.id),failure(404));
  await saveEntry(admin,draft({title:"Declassified summary",content:"Public staff summary.",ownerId:admin.id,expectedVersion:1}),p.id);
  const detail=await entryDetail(staff,p.id);
  assert.equal(detail.versions.length,1);
  assert.equal(JSON.stringify(detail).includes("zephyr"),false);
});
test("6x6 viewing preferences persist per account without changing editing permissions",async()=>{
  assert.deepEqual(await getSixViewPreferences(staff),{mode:"mine",staffIds:[]});
  assert.deepEqual(await saveSixViewPreferences(staff,{mode:"custom",staffIds:[staff.id,other.id,other.id]}),{mode:"custom",staffIds:[staff.id,other.id]});
  assert.deepEqual(await getSixViewPreferences({...staff}),{mode:"custom",staffIds:[staff.id,other.id]});
  assert.deepEqual(await getSixViewPreferences(admin),{mode:"mine",staffIds:[]});
  await saveSixViewPreferences(admin,{mode:"all",staffIds:[]});
  assert.deepEqual(await getSixViewPreferences(admin),{mode:"all",staffIds:[]});
  assert.deepEqual(await getSixViewPreferences(staff),{mode:"custom",staffIds:[staff.id,other.id]});
  await assert.rejects(saveSixViewPreferences(staff,{mode:"custom",staffIds:["missing-user"]}),failure(400));
  await assert.rejects(saveSixViewPreferences(staff,{mode:"all",staffIds:[],userId:admin.id}));
  await saveSixViewPreferences(staff,{mode:"custom",staffIds:[]});
  assert.deepEqual(await getSixViewPreferences(staff),{mode:"custom",staffIds:[]});
  const workspace=await getSixBySix(staff);
  assert.ok(workspace.items.some(i=>i.ownerId===other.id&&!i.canEdit));
  await db.update(usersTable).set({active:false}).where(eq(usersTable.id,staff.id));
  try{await assert.rejects(getSixViewPreferences(staff),failure(403));await assert.rejects(saveSixViewPreferences(staff,{mode:"all",staffIds:[]}),failure(403));}
  finally{await db.update(usersTable).set({active:true}).where(eq(usersTable.id,staff.id));}
});
test("TBD events persist an optional planning month without inventing dates or ICS entries",async()=>{
  const payload={title:"Test-only month planning",program:"",planningYear:2027,planningMonth:2,startDate:null,endDate:null,allDay:true,startsAt:null,endsAt:null,location:"",dateStatus:"tbd",locationStatus:"tbd",audience:[],wixUrl:"",notes:"",ownerId:null,expectedVersion:0};
  await assert.rejects(saveCalendarEvent(staff,payload),failure(403));
  await assert.rejects(saveCalendarEvent(admin,{...payload,planningMonth:13}));
  const saved=await saveCalendarEvent(admin,payload);
  const row=(await getMasterCalendar(staff)).events.find(e=>e.id===saved.id)!;
  assert.equal(row.planningMonth,2);assert.equal(row.startDate,null);assert.equal(row.endsAt,null);
  const [original]=await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id,saved.id));
  assert.equal(renderCalendarIcs([original!]).includes("BEGIN:VEVENT"),false,"No placeholder day may leak into a subscribed calendar.");
  const {planningMonth:_m,...oldClient}=payload;
  await saveCalendarEvent(admin,{...oldClient,title:"Edited by an older client",expectedVersion:1},saved.id);
  assert.equal((await getMasterCalendar(staff)).events.find(e=>e.id===saved.id)!.planningMonth,2);
  await saveCalendarEvent(admin,{...payload,planningMonth:null,expectedVersion:2},saved.id);
  assert.equal((await getMasterCalendar(staff)).events.find(e=>e.id===saved.id)!.planningMonth,null);
  await saveCalendarEvent(admin,{...payload,startDate:"2027-03-04",endDate:"2027-03-04",expectedVersion:3},saved.id);
  const dated=(await getMasterCalendar(staff)).events.find(e=>e.id===saved.id)!;
  assert.equal(dated.planningMonth,null);assert.equal(dated.startDate,"2027-03-04");
});
test("real local embeddings and incremental index replace stale versions; semantic search returns evidence",async()=>{
  const started=performance.now();const embedding=await embed("nonprofit presentation rehearsal");
  process.stdout.write(`MODEL_DIMENSIONS=${embedding.length} MODEL_FIRST_QUERY_MS=${Math.round(performance.now()-started)}\n`);
  assert.equal(embedding.length,384);
  for(let i=0;i<15;i++)await processBrainJobs();
  const indexed=await db.select().from(brainChunks).where(eq(brainChunks.entryId,entryId));
  assert.ok(indexed.length>0);assert.ok(indexed.every(c=>c.version===7));
  const result=await searchBrain(staff,{q:"practice speeches with coaches"});
  assert.equal(result.semanticReady,true);
  assert.ok(result.hits.some(h=>h.entryId===entryId&&h.sourceLabel));
  GetBrainAdminResponse.parse(await adminBrain(admin));
});
test("attachment-only exact terms survive low semantic similarity with the real model loaded",async()=>{
  const query="SVPZXQ4792",queryVector=await embed(query);
  const opposite=queryVector.map(v=>-v);
  const e=await saveEntry(staff,draft({title:"Annual reference attachment",summary:"",content:"See the original file for details."}));
  const fileId=randomUUID(),chunkId=randomUUID();
  await db.insert(brainFiles).values({id:fileId,entryId:e.id,actorId:staff.id,name:"strategy.pdf",contentType:"application/pdf",size:100,pendingPath:"/objects/test-only",expectedVersion:1,status:"searchable",expiresAt:new Date(Date.now()+60000)});
  await db.insert(brainChunks).values({id:chunkId,entryId:e.id,version:1,fileId,label:"strategy.pdf · page 7",page:7,text:`Rare agreement identifier ${query} belongs to this attachment only.`,embedding:opposite,model:"Xenova/all-MiniLM-L6-v2"});
  const [distance]=await db.select({d:sql<number>`${brainChunks.embedding}<=>${JSON.stringify(queryVector)}::vector`}).from(brainChunks).where(eq(brainChunks.id,chunkId));
  assert.ok(Number(distance!.d)>0.8,"Fixture must fail the semantic-only candidate threshold.");
  const result=await searchBrain(staff,{q:query});
  assert.equal(result.semanticReady,true);
  const hit=result.hits.find(h=>h.entryId===e.id);
  assert.ok(hit,"Full-text attachment match must remain retrievable even with an opposite embedding.");
  assert.equal(hit.fileId,fileId);assert.equal(hit.page,7);
  assert.match(hit.excerpt,/SVPZXQ4792/);assert.match(hit.sourceLabel,/strategy.pdf/);
  assert.equal(result.entries.some(x=>x.title.includes(query)||x.content.includes(query)),false);
  await actEntry(admin,e.id,{action:"retire",expectedVersion:1});
  assert.equal((await searchBrain(staff,{q:query})).hits.some(h=>h.entryId===e.id),false);
});
test("text, CSV, DOCX and PDF extraction are real and bounded; unsupported formats stay explicit",async()=>{
  assert.match((await extractDocument(Buffer.from("name,count\nSVP,12"),"report.csv"))[0]!.text,/SVP/);
  const doc=zipSync({"word/document.xml":strToU8('<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Nonprofit coaching checklist</w:t></w:r></w:p></w:body></w:document>')});
  assert.match((await extractDocument(Buffer.from(doc),"playbook.docx"))[0]!.text,/Nonprofit coaching/);
  const parts=["%PDF-1.4\n"],offsets=[0];
  const stream="BT /F1 12 Tf 50 750 Td (SVP program playbook) Tj ET";
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  objects.forEach((s,i)=>{offsets.push(Buffer.byteLength(parts.join("")));parts.push(`${i+1} 0 obj\n${s}\nendobj\n`);});
  const xref=Buffer.byteLength(parts.join(""));parts.push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const pages=await extractDocument(Buffer.from(parts.join("")),"playbook.pdf");
  assert.match(pages[0]!.text,/SVP program playbook/);assert.equal(pages[0]!.page,1);
  assert.deepEqual(await extractDocument(Buffer.from("binary"),"movie.mp4"),[]);
  assert.ok(chunkText("abc ".repeat(2000)).every(t=>t.length<=1500));
  await assert.rejects(extractDocument(Buffer.alloc(21*1024*1024),"huge.txt"));
});
test("every business domain can be read boundedly and auth/SQL/private keys are excluded",async()=>{
  for(const domain of Object.keys(DOMAINS)) {
    const data=await readOperations(admin,{domain,limit:1});
    assert.ok(data.records.length<=1,domain);
    const serialized=JSON.stringify(data);
    assert.doesNotMatch(serialized,/token_hash|clerk_id|pending_path|uploadURL/);
  }
  await assert.rejects(readOperations(staff,{domain:"audit"}),failure(403));
  await assert.rejects(readOperations(staff,{domain:"brain_oauth_tokens"}));
  assert.deepEqual(TOOLS.filter(t=>!t.annotations.readOnlyHint).map(t=>t.name).sort(),["contribute_knowledge","propose_amendment"]);
  assert.equal(toolScope("read_operations"),"operations:read");
});
test("OAuth consent uses real staff, exact redirects/resource, single-use codes, refresh rotation and revocation",async()=>{
  const p=new BrainOAuth("https://test.example"),resource=new URL(p.resource);
  const client=await p.clientsStore.registerClient({redirect_uris:["https://claude.ai/callback"],token_endpoint_auth_method:"none",client_name:"Test Claude"});
  await assert.rejects(p.clientsStore.registerClient({redirect_uris:["javascript:alert(1)"]}));
  let target="";
  const verifier="x".repeat(43),challenge=createHash("sha256").update(verifier).digest("base64url");
  await p.authorize(client,{redirectUri:"https://claude.ai/callback",codeChallenge:challenge,resource,scopes:["brain:read","operations:read","brain:write"],state:"my-state"},{redirect:(url:string)=>{target=url;}} as any);
  const requestId=new URL(target).searchParams.get("request")!;
  await assert.rejects(decideConsent(other,requestId,true),failure(403));
  const decided=await decideConsent(staff,requestId,true),callback=new URL(decided.redirectUrl),code=callback.searchParams.get("code")!;
  assert.equal(callback.searchParams.get("state"),"my-state");
  assert.equal(await p.challengeForAuthorizationCode(client,code),challenge);
  await assert.rejects(p.exchangeAuthorizationCode(client,code,verifier,"https://claude.ai/callback",new URL("https://evil.test/api/mcp")));
  await assert.rejects(p.exchangeAuthorizationCode(client,code,"invalid","https://claude.ai/callback",resource));
  const issued=await p.exchangeAuthorizationCode(client,code,verifier,"https://claude.ai/callback",resource);
  await assert.rejects(p.exchangeAuthorizationCode(client,code,verifier,"https://claude.ai/callback",resource));
  assert.equal((await p.verifyAccessToken(issued.access_token)).extra.actorId,staff.id);
  const refreshed=await p.exchangeRefreshToken(client,issued.refresh_token!,undefined,resource);
  await assert.rejects(p.exchangeRefreshToken(client,issued.refresh_token!,undefined,resource));
  await assert.rejects(p.verifyAccessToken(refreshed.access_token));
  const gs=await db.select().from(brainOAuthGrants);
  assert.ok(gs.some(g=>g.revokedAt));
  await assert.rejects(decideConsent(staff,requestId,true),failure(410));
});
test("MCP protocol discovery, PKCE exchange, initialization and scoped live read work through HTTP",async()=>{
  const previousDomain=process.env.REPLIT_DEV_DOMAIN;
  process.env.REPLIT_DEV_DOMAIN="mcp-test.replit.dev";
  const origin="https://mcp-test.replit.dev",p=new BrainOAuth(origin),resource=new URL(p.resource);
  const app=express();app.use(express.json());app.use(brainMcpRouter);
  const server=createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");
  const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}`;
  const headers={"X-Forwarded-Host":"mcp-test.replit.dev"};
  try{
    const metadata=await fetch(`${base}/.well-known/oauth-protected-resource/api/mcp`,{headers}).then(r=>r.json()) as any;
    assert.equal(metadata.resource,p.resource);
    const denied=await fetch(`${base}/api/mcp`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:"{}"});
    assert.equal(denied.status,401);assert.match(denied.headers.get("www-authenticate")!,/resource_metadata/);
    const client=await p.clientsStore.registerClient({redirect_uris:["https://claude.ai/callback"],token_endpoint_auth_method:"none"});
    const verifier="z".repeat(43),challenge=createHash("sha256").update(verifier).digest("base64url");let location="";
    await p.authorize(client,{redirectUri:"https://claude.ai/callback",codeChallenge:challenge,resource,scopes:["operations:read"]},{redirect:(u:string)=>{location=u;}} as any);
    const approval=await decideConsent(staff,new URL(location).searchParams.get("request")!,true),code=new URL(approval.redirectUrl).searchParams.get("code")!;
    const issue=async(v:string)=>fetch(`${base}/api/brain-oauth/token`,{method:"POST",headers:{...headers,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:client.client_id,code,code_verifier:v,redirect_uri:"https://claude.ai/callback",resource:p.resource})});
    assert.equal((await issue("incorrect".repeat(7))).status,400);
    const tokenResponse=await issue(verifier);assert.equal(tokenResponse.status,200);
    const token=await tokenResponse.json() as any;
    const call=async(method:string,params:Record<string,unknown>={})=>{
      const r=await fetch(`${base}/api/mcp`,{method:"POST",headers:{...headers,"Content-Type":"application/json","Accept":"application/json, text/event-stream",Authorization:`Bearer ${token.access_token}`},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
      assert.equal(r.status,200);return r.json() as Promise<any>;
    };
    const initialized=await call("initialize",{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"Test",version:"1"}});
    assert.equal(initialized.result.serverInfo.name,"svp-compass");
    const tools=await call("tools/list");assert.ok(tools.result.tools.some((t:any)=>t.name==="read_operations"));
    assert.ok(!tools.result.tools.some((t:any)=>t.name==="contribute_knowledge"));
    const read=await call("tools/call",{name:"read_operations",arguments:{domain:"six_items",limit:1}});
    assert.equal(read.result.isError,undefined);
    assert.equal(JSON.parse(read.result.content[0].text).records.length,1);
    const write=await call("tools/call",{name:"contribute_knowledge",arguments:{}});
    assert.equal(write.result.isError,true);
    await p.revokeToken(client,{token:token.access_token});
    const revoked=await fetch(`${base}/api/mcp`,{method:"POST",headers:{...headers,Authorization:`Bearer ${token.access_token}`,"Content-Type":"application/json"},body:"{}"});
    assert.equal(revoked.status,401);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(previousDomain===undefined)delete process.env.REPLIT_DEV_DOMAIN;else process.env.REPLIT_DEV_DOMAIN=previousDomain;}
});
test("warm hybrid retrieval stays under two seconds p95 across 10,000 synthetic chunks",async()=>{
  const embedding=await embed("nonprofit program event registration partner outreach");
  const ids=Array.from({length:100},()=>randomUUID());
  for(let i=0;i<ids.length;i++){
    await db.insert(brainEntries).values({id:ids[i]!,title:`Synthetic test playbook ${i}`,content:"Program registration outreach",kind:"reference",ownerId:staff.id,authorId:staff.id,indexStatus:"ready",indexedVersion:1});
    await db.insert(brainChunks).values(Array.from({length:100},(_,j)=>({id:randomUUID(),entryId:ids[i]!,version:1,label:`Synthetic section ${j}`,text:`Test-only nonprofit program event registration and partner outreach ${i} ${j}`,embedding,model:"Xenova/all-MiniLM-L6-v2"})));
  }
  await db.execute(sql`analyze brain_entries; analyze brain_chunks`);
  await searchBrain(staff,{q:"program registration outreach"});
  const durations:number[]=[];
  for(let i=0;i<20;i++){const start=performance.now();await searchBrain(staff,{q:"program registration outreach"});durations.push(performance.now()-start);}
  durations.sort((a,b)=>a-b);const p95=durations[18]!;
  process.stdout.write(`WARM_SEARCH_10000_CHUNKS_P95_MS=${Math.round(p95)}\n`);
  assert.ok(p95<2000,`p95 ${p95}ms exceeded 2 seconds`);
});
