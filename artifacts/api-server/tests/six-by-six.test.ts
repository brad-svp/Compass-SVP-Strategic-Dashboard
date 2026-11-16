import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { db, pool, usersTable, areasTable, auditLogTable, sixItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetSixBySixResponse } from "@workspace/api-zod";
import { saveSixPeriod, saveSixMoment, saveSixItem, deleteSixItem, getSixBySix } from "../src/lib/sixBySixService";
import type { StaffActor } from "../src/lib/permissions";
const schema = `svp_test_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: StaffActor, owner: StaffActor, other: StaffActor;
let pastId: string, currentId: string, futureId: string, momentId: string, itemId: string;
const status = (code: number) => (e: unknown) => !!e && typeof e === "object" && "status" in e && e.status === code;
const period = (name: string, startDate: string, endDate: string, state: "closed" | "active" | "draft" = "active") => ({
  name, startDate, endDate, meetingDate: null, meetingNotes: "", status: state, expectedVersion: 0,
});
const item = (title = "Prepare partner follow-up") => ({ momentId, ownerId: owner.id, title, description: "Coordinate the team", status: "planned" as const });
before(async () => {
  pool.options.options = `-c search_path=${schema}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const file of ["0000_phase2_okrs.sql", "0001_accountability_chart.sql", "0002_qbos_scorecard.sql", "0003_editable_six_by_six.sql"]) {
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
});
after(async () => { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); });
test("admins create dated, non-overlapping periods with exactly six moment slots", async () => {
  await assert.rejects(saveSixPeriod(owner, period("No permission", "1920-01-01", "1920-02-11")), status(403));
  ({ id: pastId } = await saveSixPeriod(admin, period("Past", "1920-01-01", "1920-02-11", "closed")));
  ({ id: currentId } = await saveSixPeriod(admin, period("Middle", "1920-02-12", "1920-03-24")));
  ({ id: futureId } = await saveSixPeriod(admin, period("Future", "2090-01-01", "2090-02-11", "draft")));
  const ws = GetSixBySixResponse.parse(await getSixBySix(owner));
  assert.deepEqual(ws.periods.map(p => p.id), [pastId, currentId, futureId]);
  assert.deepEqual(ws.periods[0].moments.map(m => m.position), [1, 2, 3, 4, 5, 6]);
  assert.equal(ws.periods.every(p => p.moments.length === 6), true);
  momentId = ws.periods[0].moments[0].id;
  await assert.rejects(saveSixPeriod(admin, period("Overlap", "1920-02-01", "1920-03-01")), status(400));
  await assert.rejects(saveSixPeriod(admin, period("Backwards", "2080-02-01", "2080-01-01")), status(400));
  await assert.rejects(saveSixPeriod(admin, period("Invalid date", "2080-02-30", "2080-04-01")));
});
test("major moments stay editable in closed periods, with dates, versioning and audit", async () => {
  const data = { title: "Partner gathering", eventDate: "1920-01-09", expectedVersion: 1 };
  await assert.rejects(saveSixMoment(owner, momentId, data), status(403));
  await assert.rejects(saveSixMoment(admin, momentId, { ...data, eventDate: "1920-03-01" }), status(400));
  await saveSixMoment(admin, momentId, data);
  await assert.rejects(saveSixMoment(admin, momentId, data), status(409));
  const ws = await getSixBySix(admin);
  assert.equal(ws.periods[0].moments[0].title, "Partner gathering");
  assert.equal(ws.periods[0].moments[0].version, 2);
});
test("period edits preserve moment/item identity and reject stale or stranding date edits", async () => {
  const data = { ...period("Past revised", "1920-01-01", "1920-02-11", "closed"), expectedVersion: 1 };
  await saveSixPeriod(admin, data, pastId);
  await assert.rejects(saveSixPeriod(admin, data, pastId), status(409));
  await assert.rejects(saveSixPeriod(admin, { ...data, startDate: "1920-01-10", expectedVersion: 2 }, pastId), status(400));
  const ws = await getSixBySix(admin);
  assert.equal(ws.periods[0].moments[0].id, momentId);
  assert.equal(ws.periods[0].name, "Past revised");
});
test("staff create their own items and all periods allow editing, including old/closed and future", async () => {
  await assert.rejects(saveSixItem(other, item()), status(403));
  await assert.rejects(saveSixItem(owner, { ...item(), momentId: "missing" }), status(404));
  ({ id: itemId } = await saveSixItem(owner, item()));
  await assert.rejects(saveSixItem(owner, item("Second item in same cell")), status(409));
  const ws = GetSixBySixResponse.parse(await getSixBySix(owner));
  assert.equal(ws.items.length, 1);
  assert.equal(ws.items[0].periodId, pastId);
  assert.equal(ws.items[0].canEdit, true);
  assert.equal((await getSixBySix(other)).items[0].canEdit, false);
  const futureMoment = ws.periods.find(p => p.id === futureId)!.moments[0];
  const future = await saveSixItem(owner, { ...item("Prepare the next period"), momentId: futureMoment.id });
  assert.ok((await getSixBySix(owner)).items.find(i => i.id === future.id));
});
test("item ownership cannot be stolen, staff can update status/details, and concurrent edits conflict", async () => {
  const { momentId: _, ...fields } = item();
  await assert.rejects(saveSixItem(other, { ...fields, ownerId: other.id, expectedVersion: 1 }, itemId), status(403));
  await assert.rejects(saveSixItem(owner, { ...fields, momentId: "other", expectedVersion: 1 }, itemId));
  const results = await Promise.allSettled([
    saveSixItem(owner, { ...fields, status: "done", expectedVersion: 1 }, itemId),
    saveSixItem(admin, { ...fields, title: "Other draft", expectedVersion: 1 }, itemId),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.ok(status(409)((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason));
  const fresh = (await getSixBySix(owner)).items.find(i => i.id === itemId)!;
  await saveSixItem(admin, { ...fields, ownerId: other.id, status: "blocked", expectedVersion: fresh.version }, itemId);
  await assert.rejects(saveSixItem(owner, { ...fields, expectedVersion: fresh.version + 1 }, itemId), status(403));
});
test("removal confirms version, enforces owner, retains audit history and hides item", async () => {
  const existing = (await getSixBySix(other)).items.find(i => i.id === itemId)!;
  await assert.rejects(deleteSixItem(owner, itemId, { expectedVersion: existing.version }), status(403));
  await assert.rejects(deleteSixItem(other, itemId, { expectedVersion: 1 }), status(409));
  await deleteSixItem(other, itemId, { expectedVersion: existing.version });
  assert.equal((await getSixBySix(other)).items.some(i => i.id === itemId), false);
  const [row] = await db.select().from(sixItemsTable).where(eq(sixItemsTable.id, itemId));
  assert.ok(row.deletedAt);
  const audits = await db.select().from(auditLogTable).where(eq(auditLogTable.entityId, itemId));
  assert.equal(audits.at(-1)?.action, "remove");
  assert.ok(audits.at(-1)?.before);
  await assert.rejects(deleteSixItem(admin, itemId, { expectedVersion: existing.version + 1 }), status(404));
});
test("one priority per person and box survives concurrent creates, reassignment and deletion", async () => {
  const ws = await getSixBySix(admin);
  const slot = ws.periods.find(p => p.id === currentId)!.moments[1].id;
  const data = { ...item(), momentId: slot };
  const results = await Promise.allSettled([saveSixItem(owner, data), saveSixItem(owner, data)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.ok(status(409)((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason));
  const saved = (results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>).value;
  await saveSixItem(other, { ...data, ownerId: other.id });
  const { momentId: _, ...fields } = data;
  await assert.rejects(saveSixItem(admin, { ...fields, ownerId: other.id, expectedVersion: 1 }, saved.id), status(409));
  await saveSixItem(owner, { ...fields, title: "Edited priority", expectedVersion: 1 }, saved.id);
  await deleteSixItem(owner, saved.id, { expectedVersion: 2 });
  await saveSixItem(owner, data);
});
test("inactive owners retain visible history and stale admin/staff snapshots cannot write", async () => {
  await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, owner.id));
  const own = (await getSixBySix(admin)).items.find(i => i.ownerId === owner.id)!;
  const fields = { ownerId: owner.id, title: own.title, description: own.description, status: own.status, expectedVersion: own.version };
  await saveSixItem(admin, fields, own.id); // may maintain the former owner's history
  await assert.rejects(saveSixItem(admin, item("No new inactive assignment")), status(400));
  await assert.rejects(saveSixItem(owner, item("Revoked session")), status(403));
  await db.update(usersTable).set({ role: "staff" }).where(eq(usersTable.id, admin.id));
  await assert.rejects(saveSixMoment(admin, momentId, { title: "Old admin", eventDate: null, expectedVersion: 2 }), status(403));
  await assert.rejects(saveSixPeriod(admin, period("Old admin", "2100-01-01", "2100-02-11")), status(403));
});
