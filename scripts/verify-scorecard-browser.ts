/** Development-only real browser exercise; all uniquely named fixtures are removed in finally. */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";
import {db,pool,scorecardMetricsTable as metrics,scorecardMeasurementsTable as measurements,scorecardMilestonesTable as milestones,auditLogTable} from "@workspace/db";
import {eq,inArray} from "drizzle-orm";

if(process.env.REPLIT_DEPLOYMENT||!process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev"))throw new Error("Development only.");
const origin=`https://${process.env.REPLIT_DEV_DOMAIN}`;
const title=`UI verification — ${crypto.randomUUID()}`;
const out=new URL("../generated-artifacts/ui-verification/",import.meta.url).pathname;
await mkdir(out,{recursive:true});
const executablePath=process.argv.find(x=>x.startsWith("--chromium="))?.slice(11)??execFileSync("which",["chromium"],{encoding:"utf8"}).trim();
const browser=await chromium.launch({executablePath,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
let context=await browser.newContext({viewport:{width:1366,height:1000}});
let id="";
const errors:string[]=[];
async function login(role:string){
  const r=await context.request.post(`${origin}/api/dev-auth`,{headers:{Origin:origin},data:{role}});
  assert.equal(r.status(),200);
}
async function api(path:string){
  const r=await context.request.get(`${origin}/api/svp${path}`);
  assert.equal(r.status(),200,`GET ${path}`);return r.json();
}
async function newPage(){
  const p=await context.newPage();p.on("pageerror",e=>errors.push(e.message));await p.goto(`${origin}/scorecard`);return p;
}
try{
  await login("staff");const staff=await api("/session");
  await context.close();context=await browser.newContext({viewport:{width:1366,height:1000}});
  await login("admin");
  const calendar=await api("/calendar");
  const event=calendar.events.find((e:any)=>e.startDate&&!e.deletedAt);
  assert.ok(event,"Use an existing event as a read-only fixture reference.");
  const tracker=await api("/scorecard/tracker");
  assert.ok(tracker.metrics.every((m:any)=>typeof m.updatedAt==="string"),"Version tokens must survive response validation.");
  const future=new Date(`${tracker.today}T12:00:00Z`);future.setUTCDate(future.getUTCDate()+30);
  let page=await newPage();
  await page.getByTestId("button-new-metric").click();
  await page.getByTestId("select-metric-event").click();
  await page.getByRole("listbox").getByRole("option").filter({hasText:event.title}).first().click();
  await page.getByRole("button",{name:"Registration count",exact:true}).click();
  await page.getByTestId("input-metric-title").fill(title);
  await page.getByTestId("select-metric-owner").click();
  await page.getByRole("listbox").getByRole("option",{name:staff.name,exact:true}).click();
  if(!await page.getByTestId("input-milestone-date-0").count())await page.getByTestId("button-add-milestone").click();
  await page.getByTestId("input-milestone-date-0").fill(tracker.today);
  await page.getByTestId("input-milestone-target-0").fill("10");
  await page.getByTestId("button-add-milestone").click();
  await page.getByTestId("input-milestone-date-1").fill(future.toISOString().slice(0,10));
  await page.getByTestId("input-milestone-target-1").fill("100");
  const created=page.waitForResponse(r=>r.url().endsWith("/api/svp/scorecard/metrics")&&r.request().method()==="POST");
  await page.getByTestId("button-save-metric").click();
  const creation=await created;assert.equal(creation.status(),201);id=(await creation.json()).id;
  await page.getByTestId(`row-metric-${id}`).waitFor();
  async function record(value:number){
    await page.getByTestId(`input-latest-${id}`).fill(String(value));
    const saved=page.waitForResponse(r=>r.url().endsWith(`/metrics/${id}/measurements`)&&r.request().method()==="POST");
    await page.getByTestId(`button-record-${id}`).click();
    assert.equal((await saved).status(),201);
    await page.waitForFunction(id=>(document.querySelector(`[data-testid="input-latest-${id}"]`) as HTMLInputElement)?.value==="",id);
    await page.getByTestId(`text-current-${id}`).filter({hasText:String(value)}).waitFor();
  }
  await record(0);
  let live=await api("/scorecard/tracker");
  const newMetric=live.metrics.find((m:any)=>m.id===id);
  assert.equal(newMetric.calendarEventId,event.id);
  assert.equal(live.milestones.filter((m:any)=>m.metricId===id).length,2);
  // Real configure/reopen/save proves the updatedAt optimistic token is wired through the whole API.
  await page.getByTestId(`row-metric-${id}`).getByRole("button",{name:"Configure",exact:true}).click();
  await page.getByTestId("input-metric-description").fill("Unsaved business fixture, removed after verification.");
  assert.equal(await page.getByTestId("input-metric-unit").getAttribute("readonly"),"");
  const updated=page.waitForResponse(r=>r.url().endsWith(`/metrics/${id}`)&&r.request().method()==="PATCH");
  await page.getByTestId("button-save-metric").click();
  const editResponse=await updated;
  assert.equal(editResponse.status(),200,JSON.stringify(await editResponse.json()));
  await page.getByTestId(`row-metric-${id}`).waitFor();
  await context.close();context=await browser.newContext({viewport:{width:1366,height:1000}});
  await login("staff");page=await newPage();
  await record(5);await record(17);
  assert.match((await page.getByTestId(`status-${id}`).textContent())!,/On track/,"Future target 100 must not override the latest due target 10.");
  await page.getByTestId(`button-open-metric-${id}`).click();
  await page.getByTestId("chart-metric-trend").waitFor();
  await page.getByTestId("chart-metric-trend").locator("svg.recharts-surface").waitFor();
  const trend=await api(`/scorecard/trend?metricId=${id}`);
  assert.equal(trend.entries.length,3);
  assert.equal(trend.entries.filter((e:any)=>e.canDelete).length,2);
  const adminEntry=trend.entries.find((e:any)=>e.authorId!==staff.id);
  assert.equal(await page.getByTestId(`row-entry-${adminEntry.id}`).getByRole("button",{name:"Delete entry",exact:true}).count(),0);
  const ownLatest=trend.entries.at(-1);
  await page.getByTestId(`row-entry-${ownLatest.id}`).getByRole("button",{name:"Delete entry",exact:true}).click();
  await page.getByTestId(`button-confirm-delete-${ownLatest.id}`).click();
  await page.getByTestId(`row-entry-${ownLatest.id}`).waitFor({state:"detached"});
  assert.equal((await api("/scorecard/tracker")).latest.find((e:any)=>e.metricId===id).value,5);
  await page.screenshot({path:`${out}/scorecard-trend.jpg`,fullPage:true});
  await context.close();context=await browser.newContext({viewport:{width:402,height:874}});
  await login("admin");page=await newPage();
  await page.getByTestId(`button-open-metric-${id}`).click();
  const remaining=await api(`/scorecard/trend?metricId=${id}`);
  const staffEntry=remaining.entries.find((e:any)=>e.authorId===staff.id);
  await page.getByTestId(`row-entry-${staffEntry.id}`).getByRole("button",{name:"Delete entry",exact:true}).click();
  await page.getByTestId(`button-confirm-delete-${staffEntry.id}`).click();
  await page.getByTestId(`row-entry-${staffEntry.id}`).waitFor({state:"detached"});
  assert.equal((await api("/scorecard/tracker")).latest.find((e:any)=>e.metricId===id).value,0);
  await page.screenshot({path:`${out}/scorecard-mobile.jpg`,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log("PASS: event-linked metric created and edited; two dated targets; repeated append including zero; full trend renders; latest due target controls status; staff deletes own only; admin deletes another author; latest value falls back; mobile detail works.");
}finally{
  // Exact unique marker, never a broad business-data cleanup.
  const fixtures=await db.select().from(metrics).where(eq(metrics.title,title));
  for(const fixture of fixtures){
    await db.transaction(async tx=>{
      const children=await tx.select({id:measurements.id}).from(measurements).where(eq(measurements.metricId,fixture.id));
      await tx.delete(auditLogTable).where(inArray(auditLogTable.entityId,[fixture.id,...children.map(c=>c.id)]));
      await tx.delete(measurements).where(eq(measurements.metricId,fixture.id));
      await tx.delete(milestones).where(eq(milestones.metricId,fixture.id));
      await tx.delete(metrics).where(eq(metrics.id,fixture.id));
    });
  }
  await context.close();await browser.close();await pool.end();
}
