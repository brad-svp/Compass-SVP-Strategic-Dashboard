import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { db, pool, usersTable, areasTable, cyclesTable, calendarEventsTable, calendarSubscriptionsTable, calendarProgramsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetMasterCalendarResponse } from "@workspace/api-zod";
import { saveCalendarEvent, deleteCalendarEvent, getMasterCalendar, createCalendarSubscription, revokeCalendarSubscription, getCalendarFeed, calendarSubscriberAllowed } from "../src/lib/calendarService";
import { foldIcsLine } from "../src/lib/calendarIcs";
import type { StaffActor } from "../src/lib/permissions";
import { seedCalendar } from "../src/lib/seedCalendar";
import { saveObjective, saveKeyResult, getOkrWorkspace, addCheckIn } from "../src/lib/okrService";
const schema = `svp_test_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: StaffActor, staff: StaffActor, id: string;
const status = (code: number) => (e: unknown) => !!e && typeof e === "object" && "status" in e && e.status === code;
const base = {
  title: "Partner planning", program: "Partner Social", planningYear: 2027,
  startDate: "2027-05-17", endDate: "2027-05-21", allDay: true, startsAt: null as string | null, endsAt: null as string | null,
  location: "Sacramento", dateStatus: "proposed", locationStatus: "tbd", audience: ["Partners"],
  wixUrl: "", notes: "Dates proposed, pending confirmation", ownerId: null, expectedVersion: 0,
};
before(async () => {
  pool.options.options = `-c search_path=${schema}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`); await client.query(`SET search_path TO "${schema}"`);
    for (const file of ["0000_phase2_okrs.sql", "0001_accountability_chart.sql", "0002_qbos_scorecard.sql", "0003_editable_six_by_six.sql", "0004_master_calendar.sql", "0005_event_key_results.sql", "0006_systems_overview.sql", "0007_purpose_calendar_programs.sql"]) {
      const sql = await readFile(new URL(`../../../lib/db/drizzle/${file}`, import.meta.url), "utf8");
      await client.query(sql.replaceAll('"public".', `"${schema}".`));
    }
  } finally { client.release(); }
  await db.insert(areasTable).values({ id: "area", name: "Area", color: "#1D8BC4" });
  await db.insert(calendarProgramsTable).values({ id: "social", name: "Partner Social" });
  [admin, staff] = await db.insert(usersTable).values([
    { id: "admin", name: "Admin", role: "admin", areaId: "area" },
    { id: "staff", name: "Staff", role: "staff", areaId: "area" },
  ]).returning();
});
after(async () => { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); });
test("admin-managed events validate dates, ownership, timing and safe URLs", async () => {
  await assert.rejects(saveCalendarEvent(staff, base), status(403));
  await assert.rejects(saveCalendarEvent(admin, { ...base, endDate: "2027-05-01" }), status(400));
  await assert.rejects(saveCalendarEvent(admin, { ...base, startDate: "2027-02-30" }));
  await assert.rejects(saveCalendarEvent(admin, { ...base, planningYear: 2026 }), status(400));
  await assert.rejects(saveCalendarEvent(admin, { ...base, ownerId: "missing" }), status(400));
  await assert.rejects(saveCalendarEvent(admin, { ...base, wixUrl: "javascript:alert(1)" }));
  ({ id } = await saveCalendarEvent(admin, base));
  const workspace = GetMasterCalendarResponse.parse(await getMasterCalendar(staff));
  assert.equal(workspace.events[0].canEdit, false);
  assert.equal(workspace.events[0].version, 1);
  assert.equal(workspace.events[0].endDate, "2027-05-21");
});
test("Pacific winter and summer instants preserve civil dates; undated events are kept without guessed dates", async () => {
  const timed = { ...base, title: "Winter evening", startDate: "2027-01-28", endDate: "2027-01-28", allDay: false, startsAt: "2027-01-29T01:30:00Z", endsAt: "2027-01-29T03:30:00Z" };
  await saveCalendarEvent(admin, timed);
  await assert.rejects(saveCalendarEvent(admin, { ...timed, endDate: "2027-01-29" }), status(400));
  await assert.rejects(saveCalendarEvent(admin, { ...timed, endsAt: timed.startsAt }), status(400));
  await saveCalendarEvent(admin, { ...timed, title: "Summer evening", startDate: "2027-07-15", endDate: "2027-07-15", startsAt: "2027-07-16T01:00:00Z", endsAt: "2027-07-16T03:00:00Z" });
  await saveCalendarEvent(admin, { ...base, title: "Date TBD", startDate: null, endDate: null, dateStatus: "tbd" });
});
test("stale edits cannot overwrite newer data and source provenance survives local edits", async () => {
  await db.update(calendarEventsTable).set({ sourceId: "notion-test", sourceUrl: "https://example.com/source", sourceData: { originalTitle: base.title } }).where(eq(calendarEventsTable.id, id));
  await saveCalendarEvent(admin, { ...base, title: "Changed locally", expectedVersion: 1 }, id);
  await assert.rejects(saveCalendarEvent(admin, { ...base, title: "Stale draft", expectedVersion: 1 }, id), status(409));
  const event = (await getMasterCalendar(admin)).events.find(e => e.id === id)!;
  assert.equal(event.sourceUrl, "https://example.com/source");
  assert.equal(event.imported, true);
  assert.equal(event.title, "Changed locally");
});
test("private subscriptions work without a session, store hashes only, and preserve all-day inclusive ends", async () => {
  const subscription = await createCalendarSubscription(staff);
  const key = new URL(subscription.path, "https://example.com").searchParams.get("key")!;
  assert.equal(key.length, 43);
  const [record] = await db.select().from(calendarSubscriptionsTable).where(eq(calendarSubscriptionsTable.userId, staff.id));
  assert.notEqual(record.tokenHash, key);
  const ics = await getCalendarFeed(key);
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /PRODID:-\/\/SVP Compass\/\/Master Calendar\/\/EN\r\n/);
  assert.match(ics, /X-WR-CALNAME:SVP Compass Master Calendar\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270517/);
  assert.match(ics, /DTEND;VALUE=DATE:20270522/);
  assert.match(ics, /DTSTART:20270129T013000Z/);
  assert.match(ics, /DTSTART:20270716T010000Z/);
  assert.match(ics, /STATUS:TENTATIVE/);
  assert.doesNotMatch(ics, /SUMMARY:.*Date TBD/);
  assert.equal((await getMasterCalendar(staff)).hasSubscription, true);
  await assert.rejects(getCalendarFeed("invalid"), status(404));
});
test("rotation and revocation invalidate old links; inactive staff cannot expose a calendar feed", async () => {
  assert.equal(calendarSubscriberAllowed("svp-dev-admin", true, true), false);
  assert.equal(calendarSubscriberAllowed("svp-dev-staff", true, true), false);
  assert.equal(calendarSubscriberAllowed("svp-dev-admin", true, false), true);
  assert.equal(calendarSubscriberAllowed("real-staff", true, true), true);
  const first = await createCalendarSubscription(staff);
  const old = new URL(first.path, "https://example.com").searchParams.get("key");
  const next = await createCalendarSubscription(staff);
  const key = new URL(next.path, "https://example.com").searchParams.get("key");
  await assert.rejects(getCalendarFeed(old), status(404));
  assert.match(await getCalendarFeed(key), /VCALENDAR/);
  await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, staff.id));
  await assert.rejects(getCalendarFeed(key), status(404));
  await assert.rejects(createCalendarSubscription(staff), status(403));
  await db.update(usersTable).set({ active: true }).where(eq(usersTable.id, staff.id));
  await revokeCalendarSubscription(staff);
  await assert.rejects(getCalendarFeed(key), status(404));
  assert.equal((await getMasterCalendar(staff)).hasSubscription, false);
});
test("removed events leave cancellation tombstones with stable UID and incremented sequence", async () => {
  await assert.rejects(deleteCalendarEvent(staff, id, { expectedVersion: 2 }), status(403));
  await assert.rejects(deleteCalendarEvent(admin, id, { expectedVersion: 1 }), status(409));
  await deleteCalendarEvent(admin, id, { expectedVersion: 2 });
  assert.equal((await getMasterCalendar(admin)).events.some(e => e.id === id), false);
  const { path } = await createCalendarSubscription(admin);
  const ics = await getCalendarFeed(new URL(path, "https://example.com").searchParams.get("key"));
  assert.match(ics, new RegExp(`UID:${id}@svp-os\\r\\nSEQUENCE:3`));
  assert.match(ics, /SUMMARY:Cancelled event\r\nSTATUS:CANCELLED/);
});
test("ICS text escaping and folding preserve UTF-8 while blocking injected properties", async () => {
  await saveCalendarEvent(admin, { ...base, title: "Hello, team;\nATTENDEE:bad", notes: "Long notes " + "🎉é".repeat(100) });
  const { path } = await createCalendarSubscription(admin);
  const ics = await getCalendarFeed(new URL(path, "https://example.com").searchParams.get("key"));
  assert.match(ics, /Hello\\, team\\;\\nATTENDEE:bad/);
  assert.doesNotMatch(ics, /\r\nATTENDEE:/);
  assert.equal(ics.split("\r\n").every(line => Buffer.byteLength(line, "utf8") <= 75), true);
  assert.equal(foldIcsLine("A".repeat(76)), "A".repeat(75) + "\r\n A");
});
test("Notion import preserves all 67 observed records and never overwrites edits or resurrects removed events", async () => {
  assert.equal(await seedCalendar(), 67);
  const imported = (await getMasterCalendar(admin)).events.filter(e => e.imported && e.sourceId !== "notion-test");
  assert.equal(imported.filter(e => e.planningYear === 2026).length, 39);
  assert.equal(imported.filter(e => e.planningYear === 2027).length, 28);
  const first = imported[0];
  await db.update(calendarEventsTable).set({ title: "Edited after import", version: 2 }).where(eq(calendarEventsTable.id, first.id));
  await deleteCalendarEvent(admin, imported[1].id, { expectedVersion: 1 });
  assert.equal(await seedCalendar(), 0);
  const after = await getMasterCalendar(admin);
  assert.equal(after.events.find(e => e.id === first.id)?.title, "Edited after import");
  assert.equal(after.events.some(e => e.id === imported[1].id), false);
  assert.equal(after.sourceImport.complete, false);
});
test("event-related quarterly results retain event links and require manual check-ins", async () => {
  await db.insert(cyclesTable).values({ id: "qbo-cycle", name: "Quarterly", startDate: "2027-01-01", endDate: "2027-12-31" });
  const objective = await saveObjective(admin, { cycleId: "qbo-cycle", level: "company", ownerId: admin.id, areaId: "area", title: "Grow event participation", timeScope: "Q1" });
  const event = await saveCalendarEvent(admin, { ...base, title: "Q1 partner event", startDate: "2027-01-28", endDate: "2027-01-28" });
  const kr = await saveKeyResult(admin, { objectiveId: objective.id, ownerId: staff.id, title: "Q1 partner event — Registrations", measurementType: "metric", unit: "registrations", startValue: 0, targetValue: 80, calendarEventId: event.id });
  let result = (await getOkrWorkspace(staff)).keyResults.find(k => k.id === kr.id)!;
  assert.equal(result.calendarEventId, event.id);
  assert.equal(result.currentValue, null);
  await addCheckIn(staff, kr.id, { measurementType: "metric", value: 12, note: "Twelve actual registrations" });
  await saveCalendarEvent(admin, { ...base, title: "Renamed event", expectedVersion: 1 }, event.id);
  result = (await getOkrWorkspace(staff)).keyResults.find(k => k.id === kr.id)!;
  assert.equal(result.currentValue, 12);
  await assert.rejects(saveKeyResult(staff, { ...base, objectiveId: objective.id }));
  await assert.rejects(saveKeyResult(admin, { objectiveId: objective.id, ownerId: staff.id, title: "Bad event", measurementType: "metric", calendarEventId: "missing" }), status(400));
  await assert.rejects(saveKeyResult(admin, { objectiveId: objective.id, ownerId: staff.id, title: "Non-numeric event", measurementType: "confidence", calendarEventId: event.id }), status(400));
  await saveKeyResult(admin, { calendarEventId: null }, kr.id);
  assert.equal((await getOkrWorkspace(admin)).keyResults.find(k => k.id === kr.id)!.calendarEventId, null);
});
