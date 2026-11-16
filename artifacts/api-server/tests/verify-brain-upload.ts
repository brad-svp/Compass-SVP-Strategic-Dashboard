/** Explicit development-only storage integration check; cleans ONLY its own UUID fixture. */
import assert from "node:assert/strict";
import { db,pool,brainEntries,brainFiles,brainVersions,brainJobs,brainChunks,auditLogTable } from "@workspace/db";
import { eq,inArray } from "drizzle-orm";
import { ObjectStorageService,ObjectNotFoundError } from "../src/lib/objectStorage";
const domain=process.env.REPLIT_DEV_DOMAIN;
if(process.env.REPLIT_DEPLOYMENT||!domain?.endsWith(".replit.dev"))throw new Error("Development only.");
const origin=`https://${domain}`,storage=new ObjectStorageService();
let entryId:string|undefined;
async function login(role:string) {
  const r=await fetch(`${origin}/api/dev-auth`,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({role})});
  assert.equal(r.status,200);return r.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");
}
async function api(cookie:string,path:string,method="GET",body?:unknown,status=200) {
  const r=await fetch(`${origin}/api/svp${path}`,{method,headers:{Cookie:cookie,Origin:origin,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal(r.status,status,`${method} ${path}: ${r.status}`);return r;
}
try{
  const admin=await login("admin"),staff=await login("staff");
  const session=await (await api(admin,"/session")).json() as {id:string;areaId:string};
  const fixture=`Storage verification ${crypto.randomUUID()}`;
  entryId=(await (await api(admin,"/brain/entries","POST",{title:fixture,summary:"Temporary private integration fixture",content:"Storage verification only.",kind:"reference",programId:null,areaId:session.areaId,ownerId:session.id,tags:["integration-fixture"],sourceUrls:[],links:[],visibility:"admin",reviewIntervalDays:90,expectedVersion:0},201)).json() as {id:string}).id;
  const bytes=Buffer.from(`SVP private file verification ${crypto.randomUUID()}. A program playbook can be extracted and searched.`);
  const upload=await (await api(admin,"/brain/uploads","POST",{entryId,name:"integration-check.txt",contentType:"text/plain",size:bytes.length,expectedVersion:1},201)).json() as {id:string;uploadURL:string};
  const put=await fetch(upload.uploadURL,{method:"PUT",headers:{"Content-Type":"text/plain"},body:bytes});
  assert.equal(put.ok,true);
  await api(admin,`/brain/files/${upload.id}/complete`,"POST");
  const download=await api(admin,`/brain/files/${upload.id}`);
  assert.equal(download.headers.get("content-type"),"application/octet-stream");
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
  await api(staff,`/brain/files/${upload.id}`,"GET",undefined,404);
  await api(staff,`/brain/entries/${entryId}`,"GET",undefined,404);
  let ready=false;
  for(let i=0;i<40;i++){
    const d=await (await api(admin,`/brain/entries/${entryId}`)).json() as {files:{status:string;error:string|null}[];entry:{indexStatus:string}};
    if(d.files[0]?.status==="failed")throw new Error(d.files[0].error??"Extraction failed.");
    if(d.files[0]?.status==="searchable"&&d.entry.indexStatus==="ready"){ready=true;break;}
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  assert.equal(ready,true,"Real storage file must be extracted and indexed.");
  const search=await (await api(admin,`/brain?q=${encodeURIComponent("program playbook extracted")}`)).json() as {hits:{entryId:string;fileId:string|null}[]};
  assert.ok(search.hits.some(h=>h.entryId===entryId&&h.fileId===upload.id));
  process.stdout.write("PASS: real direct upload, immutable storage copy, authenticated original download, staff denial, worker extraction and cited file retrieval.\n");
}finally{
  if(entryId){
    const fs=await db.select().from(brainFiles).where(eq(brainFiles.entryId,entryId));
    await db.delete(brainChunks).where(eq(brainChunks.entryId,entryId));
    await db.delete(brainJobs).where(eq(brainJobs.entryId,entryId));
    await db.delete(brainVersions).where(eq(brainVersions.entryId,entryId));
    await db.delete(brainFiles).where(eq(brainFiles.entryId,entryId));
    await db.delete(brainEntries).where(eq(brainEntries.id,entryId));
    await db.delete(auditLogTable).where(inArray(auditLogTable.entityId,[entryId]));
    for(const f of fs)for(const p of [f.pendingPath,f.objectPath].filter((p):p is string=>!!p)){
      try{await (await storage.getObjectEntityFile(p)).delete();}catch(e){if(!(e instanceof ObjectNotFoundError))throw e;}
    }
  }
  await pool.end();
}
