import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { db, pool, usersTable, areasTable, cyclesTable, objectivesTable, keyResultsTable, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetScorecardResponse } from "@workspace/api-zod";
import {UpdateScorecardMetricBody} from "@workspace/api-zod";
import { saveScorecardMetric, saveScorecardEntry, getScorecard } from "../src/lib/scorecardService";
import { scorecardStatus, weekStart, validateWeek } from "../src/lib/scorecardMath";
import { saveObjective, saveKeyResult, addCheckIn, getOkrWorkspace } from "../src/lib/okrService";
import type { StaffActor } from "../src/lib/permissions";
import {appendScorecardMeasurement,deleteScorecardMeasurement,getScorecardTracker,getScorecardTrend,backfillScorecardHistory} from "../src/lib/scorecardTrackerService";
import {saveCalendarEvent} from "../src/lib/calendarService";
import {readOperations} from "../src/lib/brain/operations";

const schema = `svp_test_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: StaffActor, owner: StaffActor, other: StaffActor, metricId: string, qboId: string, krId: string;
const now = new Date("2026-11-15T19:00:00Z"), week = "2026-11-09";
const metric = {
  title: "Weekly partner conversations", description: "A leading weekly measurable", ownerId: "owner", areaId: "area",
  unit: "conversations", decimals: 0, direction: "at_least" as const, target: 5, upperTarget: null,
  linkedKeyResultId: null as string | null, sortOrder: 0, active: true,
};
const entry = (value: number | null, expectedVersion = 0, reason = "") => ({ value, note: "Weekly notes", reason, expectedVersion });
const status = (code: number) => (e: unknown) => !!e && typeof e === "object" && "status" in e && e.status === code;
before(async () => {
  pool.options.options = `-c search_path=${schema},public`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}",public`);
    for (const file of readdirSync(new URL("../../../lib/db/drizzle/",import.meta.url)).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
      const sql = await readFile(new URL(`../../../lib/db/drizzle/${file}`, import.meta.url), "utf8");
      await client.query(sql.replaceAll('"public".', `"${schema}".`));
    }
  } finally { client.release(); }
  await db.insert(areasTable).values({ id: "area", name: "Test area", color: "#1D8BC4" });
  [admin, owner, other] = await db.insert(usersTable).values([
    { id: "admin", name: "Admin", role: "admin", areaId: "area" },
    { id: "owner", name: "Owner", role: "staff", areaId: "area" },
    { id: "other", name: "Other", role: "staff", areaId: "area" },
  ]).returning();
  await db.insert(cyclesTable).values([
    { id: "cycle", name: "Test cycle", startDate: "2026-01-01", endDate: "2026-12-31" },
    { id: "short", name: "Q2 only", startDate: "2026-04-01", endDate: "2026-06-30" },
  ]);
});
after(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});
test("week boundaries, inclusive goal directions, zero, negatives and missing are distinct", () => {
  assert.equal(weekStart(now), week);
  assert.equal(weekStart(new Date("2027-01-01T23:59:00Z")), "2026-12-28");
  assert.equal(validateWeek(week, now), week);
  assert.throws(() => validateWeek("2026-11-16", now), status(400));
  assert.throws(() => validateWeek("2026-11-10", now), status(400));
  assert.throws(() => validateWeek("2026-02-30", now), status(400));
  assert.equal(scorecardStatus(null, "at_least", 0, null), "missing");
  assert.equal(scorecardStatus(0, "at_least", 0, null), "on_track");
  assert.equal(scorecardStatus(-2, "at_most", -2, null), "on_track");
  assert.equal(scorecardStatus(5, "range", 5, 10), "on_track");
  assert.equal(scorecardStatus(10, "range", 5, 10), "on_track");
  assert.equal(scorecardStatus(11, "range", 5, 10), "off_track");
});
test("quarterly QBOs, check-ins and legacy annual history coexist without conversion", async () => {
  const qbo = { cycleId: "cycle", level: "company", ownerId: "owner", areaId: "area", title: "Quarterly partner growth", timeScope: "Q4" };
  ({ id: qboId } = await saveObjective(admin, qbo));
  await assert.rejects(saveObjective(owner, qbo), status(403));
  await assert.rejects(saveObjective(admin, { ...qbo, timeScope: "annual" }), status(400));
  await assert.rejects(saveObjective(admin, { timeScope: "annual" }, qboId), status(400));
  await assert.rejects(saveObjective(admin, { ...qbo, cycleId: "short" }), status(400));
  await assert.rejects(saveObjective(owner, { title: "Cannot edit org-wide QBO" }, qboId), status(403));
  await db.insert(objectivesTable).values({
    id: "legacy", cycleId: "cycle", level: "company", ownerId: "admin", areaId: "area", title: "Preserved annual objective", timeScope: "annual",
  });
  await saveObjective(admin, { description: "Still available" }, "legacy");
  ({ id: krId } = await saveKeyResult(admin, { objectiveId: qboId, ownerId: "owner", title: "Quarterly total conversations", measurementType: "metric", startValue: 0, targetValue: 65, unit: "conversations" }));
  await addCheckIn(owner, krId, { measurementType: "metric", value: 10, note: "Official quarterly progress" });
  const ws = await getOkrWorkspace(owner, now);
  assert.equal(ws.objectives.find(o => o.id === qboId)?.timeScope, "Q4");
  assert.equal(ws.objectives.find(o => o.id === "legacy")?.timeScope, "annual");
  assert.equal(ws.keyResults.find(k => k.id === krId)?.currentValue, 10);
});
test("only admins configure custom metrics with validated goal, owner and QBO links", async () => {
  await assert.rejects(saveScorecardMetric(owner, metric), status(403));
  await assert.rejects(saveScorecardMetric(admin, { ...metric, direction: "range" }), status(400));
  await assert.rejects(saveScorecardMetric(admin, { ...metric, direction: "range", upperTarget: 4 }), status(400));
  await assert.rejects(saveScorecardMetric(admin, { ...metric, target: Infinity }));
  await assert.rejects(saveScorecardMetric(admin, { ...metric, ownerId: "missing" }), status(400));
  await assert.rejects(saveScorecardMetric(admin, { ...metric, linkedKeyResultId: "missing" }), status(400));
  ({ id: metricId } = await saveScorecardMetric(admin, { ...metric, linkedKeyResultId: krId }));
  const ws = GetScorecardResponse.parse(await getScorecard(owner, undefined, now));
  assert.equal(ws.weeks.length, 13);
  assert.equal(ws.weeks.at(-1), week);
  assert.equal(ws.metrics[0].canEdit, false);
  assert.equal(ws.metrics[0].canRecord, true);
  assert.equal((await getScorecard(other, undefined, now)).metrics[0].canRecord, false);
});
test("weekly result saves persist zero, notes, snapshots and an immutable revision without changing quarterly KR", async () => {
  await assert.rejects(saveScorecardEntry(other, metricId, week, entry(5), now), status(403));
  await assert.rejects(saveScorecardEntry(owner, metricId, "2026-11-16", entry(5), now), status(400));
  await assert.rejects(saveScorecardEntry(owner, metricId, week, entry(null), now), status(400));
  await saveScorecardEntry(owner, metricId, week, entry(0), now);
  const ws = GetScorecardResponse.parse(await getScorecard(owner, undefined, now));
  assert.equal(ws.entries[0].value, 0);
  assert.equal(ws.entries[0].status, "off_track");
  assert.equal(ws.entries[0].note, "Weekly notes");
  assert.equal(ws.entries[0].target, 5);
  assert.equal(ws.revisions.length, 1);
  assert.equal(ws.revisions[0].version, 1);
  assert.equal((await getOkrWorkspace(owner)).keyResults.find(k => k.id === krId)?.currentValue, 10);
});
test("corrections require reasons; changed metric goals do not reinterpret historical results", async () => {
  await saveScorecardMetric(admin, { ...metric, target: 100, unit: "new unit", linkedKeyResultId: krId }, metricId);
  await assert.rejects(saveScorecardEntry(owner, metricId, week, entry(6, 1), now), status(400));
  await saveScorecardEntry(owner, metricId, week, entry(6, 1, "Reconciled the source count"), now);
  const ws = GetScorecardResponse.parse(await getScorecard(owner, undefined, now));
  assert.equal(ws.entries[0].target, 5);
  assert.equal(ws.entries[0].unit, "conversations");
  assert.equal(ws.entries[0].status, "on_track");
  assert.equal(ws.metrics[0].target, 100);
  assert.equal(ws.revisions.length, 2);
  assert.deepEqual(ws.revisions.map(r => r.value), [0, 6]);
  assert.equal(ws.revisions[1].reason, "Reconciled the source count");
  await assert.rejects(saveScorecardEntry(owner, metricId, week, entry(99, 1, "Stale form"), now), status(409));
});
test("simultaneous edits conflict instead of silently losing results; clears preserve all history", async () => {
  const writes = await Promise.allSettled([
    saveScorecardEntry(owner, metricId, week, entry(7, 2, "First correction"), now),
    saveScorecardEntry(admin, metricId, week, entry(8, 2, "Other correction"), now),
  ]);
  assert.equal(writes.filter(r => r.status === "fulfilled").length, 1);
  const rejected = writes.find(r => r.status === "rejected") as PromiseRejectedResult;
  assert.ok(status(409)(rejected.reason));
  await assert.rejects(saveScorecardEntry(owner, metricId, week, entry(null, 3), now), status(400));
  await saveScorecardEntry(owner, metricId, week, entry(null, 3, "Source data withdrawn"), now);
  const ws = GetScorecardResponse.parse(await getScorecard(owner, undefined, now));
  assert.equal(ws.entries[0].value, null);
  assert.equal(ws.entries[0].status, "missing");
  assert.equal(ws.entries[0].version, 4);
  assert.equal(ws.revisions.length, 4);
  assert.equal(ws.revisions[0].value, 0);
});
test("archive retains data and disables entry; restore and historical window navigation work", async () => {
  await saveScorecardMetric(admin, { ...metric, active: false, linkedKeyResultId: krId }, metricId);
  await assert.rejects(saveScorecardEntry(owner, metricId, week, entry(8, 4, "Archived"), now), status(409));
  let ws = await getScorecard(owner, undefined, now);
  assert.equal(ws.metrics[0].active, false);
  assert.equal(ws.metrics[0].canRecord, false);
  assert.equal(ws.revisions.length, 4);
  await saveScorecardMetric(admin, { ...metric, active: true, linkedKeyResultId: krId }, metricId);
  await saveScorecardEntry(owner, metricId, "2026-08-03", entry(8), now);
  ws = await getScorecard(owner, "2026-08-03", now);
  assert.equal(ws.entries.length, 1);
  assert.equal(ws.entries[0].weekStart, "2026-08-03");
  assert.equal(ws.entries[0].status, "on_track");
});
test("append-only tracker preserves old revisions, links events, paginates and enforces author deletion",async()=>{
  await backfillScorecardHistory();
  const historical=await getScorecardTrend(owner,metricId);
  assert.ok(historical.entries.length>=5);
  assert.ok(historical.entries.some(e=>e.value===null),"A historical clearing is not replaced by a fabricated numeric value.");
  assert.ok(historical.entries.every(e=>e.sourceWeekStart&&e.authorId&&e.recordedAt));
  await backfillScorecardHistory();
  assert.equal((await getScorecardTrend(owner,metricId)).entries.length,historical.entries.length);
  const legacy=historical.entries.find(e=>e.authorId===owner.id)!;
  await deleteScorecardMeasurement(owner,legacy.id);
  await backfillScorecardHistory();
  assert.ok(!(await getScorecardTrend(owner,metricId)).entries.some(e=>e.id===legacy.id),"Restart must not resurrect a deleted migrated entry.");

  const event=await saveCalendarEvent(admin,{title:"Isolated registration event",program:"",planningYear:2027,startDate:"2027-05-05",endDate:"2027-05-05",allDay:true,startsAt:null,endsAt:null,location:"",dateStatus:"confirmed",locationStatus:"tbd",audience:[],wixUrl:"",notes:"",ownerId:null,expectedVersion:0});
  let cfg={...metric,title:"Event registrations",unit:"registrations",calendarEventId:event.id,milestones:[{dueDate:"2027-03-01",target:20,upperTarget:null},{dueDate:"2027-05-05",target:100,upperTarget:null}]};
  const fresh=await saveScorecardMetric(admin,cfg);
  const current=async()=> (await getScorecardTracker(owner)).metrics.find(m=>m.id===fresh.id)!;
  const update=async(patch:Partial<typeof cfg>)=>{const before=await current();cfg={...cfg,...patch};return saveScorecardMetric(admin,{...cfg,expectedUpdatedAt:before.updatedAt},fresh.id);};
  assert.equal((await current()).calendarEventId,event.id);
  assert.equal((await getScorecardTracker(owner,new Date("2027-03-01T07:59:00Z"))).today,"2027-02-28","Due-day boundaries use Sacramento, not UTC.");
  const dates=(await getScorecardTracker(owner)).milestones.filter(m=>m.metricId===fresh.id);
  assert.equal(dates.length,2);
  await saveScorecardMetric(admin,UpdateScorecardMetricBody.strict().parse({...cfg,expectedUpdatedAt:(await current()).updatedAt}),fresh.id);
  await assert.rejects(saveScorecardMetric(admin,{...cfg,expectedUpdatedAt:"2000-01-01T00:00:00.000Z"},fresh.id),status(409));
  await assert.rejects(saveScorecardMetric(admin,{...cfg,expectedUpdatedAt:(await current()).updatedAt,milestones:[dates[0],dates[0]].map(({dueDate,target,upperTarget})=>({dueDate,target,upperTarget}))},fresh.id),status(400));
  await assert.rejects(saveScorecardMetric(admin,{...cfg,calendarEventId:"missing-event",expectedUpdatedAt:(await current()).updatedAt},fresh.id),status(400));
  await assert.rejects(appendScorecardMeasurement(other,fresh.id,{value:1,note:""}),status(403));
  await assert.rejects(appendScorecardMeasurement(owner,fresh.id,{value:1,note:"",authorId:admin.id}));
  await assert.rejects(appendScorecardMeasurement(owner,fresh.id,{value:NaN,note:""}));
  const first=await appendScorecardMeasurement(owner,fresh.id,{value:0,note:"First zero"});
  const second=await appendScorecardMeasurement(owner,fresh.id,{value:0,note:"Another save, not an overwrite"});
  const third=await appendScorecardMeasurement(admin,fresh.id,{value:5,note:"Admin update"});
  assert.notEqual(first.id,second.id);
  assert.equal((await getScorecardTracker(owner)).latest.find(e=>e.metricId===fresh.id)!.id,third.id);
  const one=await getScorecardTrend(owner,fresh.id,{limit:1});
  assert.equal(one.entries[0]!.id,first.id);assert.equal(one.entries[0]!.value,0);
  await deleteScorecardMeasurement(owner,first.id);
  const rest=await getScorecardTrend(owner,fresh.id,{after:one.nextCursor,limit:2});
  assert.deepEqual(rest.entries.map(e=>e.id),[second.id,third.id]);assert.equal(rest.nextCursor,null);
  assert.equal(rest.entries[0]!.canDelete,true);assert.equal(rest.entries[1]!.canDelete,false);
  await assert.rejects(deleteScorecardMeasurement(owner,third.id),status(403));
  await deleteScorecardMeasurement(admin,third.id);
  assert.equal((await getScorecardTracker(owner)).latest.find(e=>e.metricId===fresh.id)!.id,second.id);
  const operations=await readOperations(owner,{domain:"scorecard_measurements",parentId:fresh.id});
  assert.equal(operations.records.length,1);
  assert.equal((await readOperations(owner,{domain:"scorecard_milestones",parentId:fresh.id})).records.length,2);
  await assert.rejects(update({unit:"dollars"}),status(409));cfg={...cfg,unit:"registrations"};
  await update({ownerId:other.id,calendarEventId:null});
  assert.equal((await current()).calendarEventId,null);
  await assert.rejects(appendScorecardMeasurement(owner,fresh.id,{value:8,note:"Transferred"}),status(403));
  await deleteScorecardMeasurement(owner,second.id);
  assert.equal((await getScorecardTracker(owner)).latest.some(e=>e.metricId===fresh.id),false);
  await appendScorecardMeasurement(other,fresh.id,{value:8,note:"New owner"});
  await update({active:false});
  await assert.rejects(appendScorecardMeasurement(other,fresh.id,{value:9,note:"Archived"}),status(409));
  await update({active:true,milestones:[]});
  assert.equal((await getScorecardTracker(owner)).milestones.filter(m=>m.metricId===fresh.id).length,0);
  await db.update(usersTable).set({active:false}).where(eq(usersTable.id,other.id));
  await assert.rejects(appendScorecardMeasurement(other,fresh.id,{value:9,note:"Disabled"}),status(403));
  await db.update(usersTable).set({active:true}).where(eq(usersTable.id,other.id));
});
test("revoked admins and inactive owners cannot bypass fresh write checks; every revision is audited", async () => {
  await db.update(usersTable).set({ role: "staff" }).where(eq(usersTable.id, "admin"));
  await assert.rejects(saveScorecardMetric(admin, metric, metricId), status(403));
  await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, "owner"));
  await assert.rejects(saveScorecardEntry(owner, metricId, week, entry(5, 4, "Old session"), now), status(403));
  const ws = await getScorecard(other, undefined, now);
  const audit = await db.select().from(auditLogTable).where(eq(auditLogTable.entityId, ws.entries[0].id));
  assert.equal(audit.length, ws.revisions.length);
});
