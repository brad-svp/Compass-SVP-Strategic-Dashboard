/**
 * Explicit, repeatable development import requested by SVP.
 * Reads only the official public logo URLs below; writes through the existing
 * admin program/upload API so validation, storage and audit stay consistent.
 * Never run against production or from application startup.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const source="https://www.svpsacramento.org";
const entries=[
  {name:"Fast Pitch",aliases:["svp fast pitch","fast pitch"],slug:"fast-pitch"},
  {name:"Think Tank",aliases:["svp think tank","think tank","think tanks"],slug:"think-tank"},
  {name:"100x",aliases:["100x","100x by svp"],slug:"hundredx"},
  {name:"AI for Good",aliases:["ai for good"],slug:"ai-for-good"},
];
const domain=process.env.REPLIT_DEV_DOMAIN;
if(process.env.REPLIT_DEPLOYMENT||!domain?.endsWith(".replit.dev"))throw new Error("This import is development-only.");
const origin=`https://${domain}`;
const signIn=await fetch(`${origin}/api/dev-auth`,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({role:"admin"})});
assert.equal(signIn.status,200,"Development admin login is required.");
const cookie=signIn.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");
async function api(path:string,method="GET",data?:unknown,status=200) {
  const r=await fetch(`${origin}/api/svp${path}`,{method,headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:data===undefined?undefined:JSON.stringify(data)});
  if(r.status!==status)throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  return r;
}
type Program={id:string;name:string;logoId:string|null;active:boolean;version:number;logoUrl:string|null};
const before=await (await api("/calendar")).json() as {programs:Program[];events:{id:string;programId:string|null}[]};
const imported:Record<string,unknown>[]=[];
for(const e of entries) {
  let matches=before.programs.filter(p=>e.aliases.includes(p.name.trim().toLowerCase()));
  if(!matches.length){
    const result=await (await api("/calendar/programs","POST",{name:e.name,logoId:null,active:true,expectedVersion:0},201)).json() as {id:string};
    matches=[{id:result.id,name:e.name,logoId:null,active:true,version:1,logoUrl:null}];
  }
  const logoSource=`${source}/programs/${e.slug}-logo.png`;
  const response=await fetch(logoSource);
  assert.equal(response.ok,true,`Official ${e.name} logo must be available.`);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length>0&&bytes.length<=2*1024*1024,"Logo must fit the existing upload limit.");
  let uploaded:{logoId:string;logoUrl:string}|undefined;
  for(const program of matches) {
    if(program.logoId){imported.push({program:program.name,result:"Kept existing administrator-configured logo"});continue;}
    if(!uploaded){
      const requested=await (await api("/calendar/program-logo-uploads","POST",{name:`${e.slug}-official-logo.png`,size:bytes.length,contentType:"image/png"},201)).json() as {id:string;uploadURL:string};
      const put=await fetch(requested.uploadURL,{method:"PUT",headers:{"Content-Type":"image/png"},body:bytes});
      assert.equal(put.ok,true,"Persistent storage upload must succeed.");
      uploaded=await (await api(`/calendar/program-logo-uploads/${requested.id}/complete`,"POST")).json() as {logoId:string;logoUrl:string};
    }
    await api(`/calendar/programs/${program.id}`,"PATCH",{name:program.name,logoId:uploaded.logoId,active:program.active,expectedVersion:program.version});
    const served=await api(uploaded.logoUrl.replace("/api/svp",""));
    assert.equal(served.headers.get("content-type"),"image/webp");
    assert.ok((await served.arrayBuffer()).byteLength>0);
    imported.push({program:program.name,result:"Official logo imported",source:logoSource,sha256:createHash("sha256").update(bytes).digest("hex")});
  }
}
const after=await (await api("/calendar")).json() as typeof before;
assert.deepEqual(after.events.map(e=>[e.id,e.programId]).sort(),before.events.map(e=>[e.id,e.programId]).sort(),"Existing event assignments must be unchanged.");
process.stdout.write(JSON.stringify({imported,eventCountPreserved:after.events.length,sourcePage:`${source}/initiatives`},null,2)+"\n");
