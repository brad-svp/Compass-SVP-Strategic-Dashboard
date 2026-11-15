import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { db, pool, areasTable, usersTable, cyclesTable, objectivesTable, keyResultsTable, checkInsTable, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetOkrWorkspaceResponse } from "@workspace/api-zod";
import { saveObjective, saveKeyResult, addCheckIn, saveComment, removeOkr, getOkrWorkspace } from "../src/lib/okrService";
import { metricProgress, progressHealth, expectedProgress } from "../src/lib/okrProgress";
import { type StaffActor } from "../src/lib/permissions";

// Never writes test objectives into the real planning cycle. Every connection in
// this test process targets a disposable, uniquely named PostgreSQL schema.
const schema = `svp_test_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: StaffActor, alice: StaffActor, bob: StaffActor;
let companyId: string, individualId: string, metricId: string;
const isStatus = (status: number) => (error: unknown) => !!error && typeof error === "object" && "status" in error && error.status === status;
before(async () => {
  assert.match(schema, /^svp_test_[a-f0-9]+$/);
  pool.options.options = `-c search_path=${schema}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const baseline = await readFile(new URL("../../../lib/db/drizzle/0000_phase2_okrs.sql", import.meta.url), "utf8");
    // Drizzle emits explicitly public-qualified foreign-key targets.
    await client.query(baseline.replaceAll('"public".', `"${schema}".`));
    for (const migration of ["0001_accountability_chart.sql", "0002_qbos_scorecard.sql"]) {
      const sql = await readFile(new URL(`../../../lib/db/drizzle/${migration}`, import.meta.url), "utf8");
      await client.query(sql.replaceAll('"public".', `"${schema}".`));
    }
  } finally { client.release(); }
  await db.insert(areasTable).values({ id: "area", name: "Test area", color: "#1D8BC4" });
  [admin, alice, bob] = await db.insert(usersTable).values([
    { id: "admin", name: "Test Admin", role: "admin", areaId: "area" },
    { id: "alice", name: "Test Alice", role: "staff", areaId: "area" },
    { id: "bob", name: "Test Bob", role: "staff", areaId: "area" },
  ]).returning();
  await db.insert(cyclesTable).values([
    { id: "cycle", name: "Test cycle", startDate: "2025-01-01", endDate: "2025-12-31" },
    { id: "other", name: "Other cycle", startDate: "2026-01-01", endDate: "2026-12-31" },
  ]);
});
after(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test("progress math clamps, supports decreasing targets, and handles confidence/pace boundaries", () => {
  assert.equal(metricProgress(0, 100, 140), 100);
  assert.equal(metricProgress(0, 100, -5), 0);
  assert.equal(metricProgress(100, 0, 50), 50);
  assert.equal(metricProgress(0, 100, null), 0);
  assert.equal(progressHealth("confidence", 70, 100, true), "green");
  assert.equal(progressHealth("confidence", 40, 100, true), "yellow");
  assert.equal(progressHealth("confidence", 39, 100, true), "red");
  assert.equal(progressHealth("metric", 40, 50, true), "green");
  assert.equal(progressHealth("metric", 25, 50, true), "yellow");
  assert.equal(progressHealth("metric", 24.9, 50, true), "red");
  assert.equal(progressHealth("metric", 0, 100, false), "none");
  assert.equal(expectedProgress("2025-01-01", "2025-12-31", "Q2", new Date("2025-04-01T00:00:00Z")), 0);
  assert.equal(expectedProgress("2025-01-01", "2025-12-31", "Q2", new Date("2025-07-01T00:00:00Z")), 100);
  assert.equal(expectedProgress("2027-01-01", "2027-12-31", "annual", new Date("2026-11-11T00:00:00Z")), 0);
});
test("new QBOs require an administrator and organization-wide quarterly scope", async () => {
  const input = { cycleId: "cycle", level: "company", ownerId: "admin", areaId: "area", title: "Quarterly objective", timeScope: "Q2" };
  await assert.rejects(saveObjective(alice, { ...input, ownerId: "alice" }), isStatus(403));
  await assert.rejects(saveObjective(admin, { ...input, timeScope: "annual" }), isStatus(400));
  ({ id: companyId } = await saveObjective(admin, input));
  await assert.rejects(saveObjective(alice, { title: "Not allowed" }, companyId), isStatus(403));
});
test("legacy individual objectives remain editable but cannot be newly created", async () => {
  const input = { cycleId: "cycle", level: "individual", ownerId: "alice", areaId: "area", title: "Personal objective", timeScope: "Q2", parentObjectiveId: companyId };
  await assert.rejects(saveObjective(alice, { ...input, ownerId: "bob" }), isStatus(403));
  await assert.rejects(saveObjective(admin, input), isStatus(400));
  individualId = "legacy-individual";
  // Imported legacy data, not a new-workflow path. Existing ownership and
  // alignment protections must survive the QBO transition.
  await db.insert(objectivesTable).values({
    id: individualId, cycleId: "cycle", level: "individual", ownerId: "alice", areaId: "area",
    title: "Legacy personal objective", timeScope: "Q2", parentObjectiveId: companyId,
  });
  await assert.rejects(saveObjective(alice, { parentObjectiveId: null }, individualId), isStatus(400));
  await assert.rejects(saveObjective(bob, { title: "Stolen" }, individualId), isStatus(403));
  await saveObjective(alice, { title: "Updated title", description: "Clear outcome", status: "active", sortOrder: 2 }, individualId);
  const [row] = await db.select().from(objectivesTable).where(eq(objectivesTable.id, individualId));
  assert.equal(row.title, "Updated title");
  assert.equal(row.description, "Clear outcome");
});
test("key result values change only through append-only, validated owner check-ins", async () => {
  ({ id: metricId } = await saveKeyResult(alice, { objectiveId: individualId, ownerId: "alice", title: "Increase test participation", measurementType: "metric", startValue: 0, targetValue: 100, unit: "people" }));
  let [row] = await db.select().from(keyResultsTable).where(eq(keyResultsTable.id, metricId));
  assert.equal(row.currentValue, null);
  await assert.rejects(saveKeyResult(alice, { currentValue: 80 }, metricId));
  await assert.rejects(saveKeyResult(alice, { confidence: 80 }, metricId));
  await assert.rejects(saveKeyResult(alice, { targetValue: 0 }, metricId), isStatus(400));
  await assert.rejects(addCheckIn(bob, metricId, { measurementType: "metric", value: 30, note: "No permission" }), isStatus(403));
  await assert.rejects(addCheckIn(alice, metricId, { measurementType: "metric", value: 30, note: " " }));
  await assert.rejects(addCheckIn(alice, metricId, { measurementType: "confidence", confidence: 30, note: "Stale form" }), isStatus(409));
  await addCheckIn(alice, metricId, { measurementType: "metric", value: 30, note: "Thirty people joined." });
  [row] = await db.select().from(keyResultsTable).where(eq(keyResultsTable.id, metricId));
  assert.equal(row.currentValue, 30);
  const history = await db.select().from(checkInsTable).where(eq(checkInsTable.keyResultId, metricId));
  assert.equal(history.length, 1);
  assert.equal(history[0].progress, 30);
  const audit = await db.select().from(auditLogTable).where(eq(auditLogTable.entityId, history[0].id));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actorId, "alice");
});
test("measurement switching preserves old values, historical measurement types and progress snapshots", async () => {
  await saveKeyResult(alice, { measurementType: "confidence" }, metricId);
  await assert.rejects(addCheckIn(alice, metricId, { measurementType: "confidence", confidence: 101, note: "Invalid" }));
  await addCheckIn(alice, metricId, { measurementType: "confidence", confidence: 75, note: "Partners confirmed." });
  const workspace = GetOkrWorkspaceResponse.parse(await getOkrWorkspace(alice, new Date("2025-05-15T00:00:00Z")));
  assert.equal(workspace.keyResults.find(k => k.id === metricId)!.progress, 75);
  assert.equal(workspace.keyResults.find(k => k.id === metricId)!.health, "green");
  assert.equal(workspace.objectives.find(o => o.id === individualId)!.progress, 75);
  const history = workspace.checkIns.filter(h => h.keyResultId === metricId);
  assert.equal(history.length, 2);
  assert.equal(history[0].measurementType, "metric");
  assert.equal(history[0].progress, 30);
  assert.equal(history[1].measurementType, "confidence");
  await saveKeyResult(alice, { measurementType: "metric", targetValue: 200 }, metricId);
  const second = await getOkrWorkspace(alice);
  const result = second.keyResults.find(k => k.id === metricId)!;
  assert.equal(result.currentValue, 30);
  assert.equal(result.confidence, 75);
  assert.equal(result.progress, 15);
  assert.equal(second.checkIns[0].progress, 30);
});
test("all staff may comment, but only authors edit or delete—even administrators", async () => {
  const { id: commentId } = await saveComment(bob, { entityType: "objective", entityId: individualId, body: "I can help." });
  await assert.rejects(saveComment(admin, { body: "Changed" }, commentId), isStatus(403));
  await assert.rejects(saveComment(alice, {}, commentId, true), isStatus(403));
  await saveComment(bob, { body: "I can help next week." }, commentId);
  let workspace = await getOkrWorkspace(bob);
  assert.ok(workspace.comments.find(c => c.id === commentId)?.editedAt);
  assert.equal(workspace.comments.find(c => c.id === commentId)?.canEdit, true);
  workspace = await getOkrWorkspace(admin);
  assert.equal(workspace.comments.find(c => c.id === commentId)?.canEdit, false);
  await saveComment(bob, {}, commentId, true);
  assert.equal((await getOkrWorkspace(bob)).comments.length, 0);
  await saveComment(alice, { entityType: "key_result", entityId: metricId, body: "KR discussion" });
});
test("read permissions return all staff data and accurate per-item controls", async () => {
  const workspace = GetOkrWorkspaceResponse.parse(await getOkrWorkspace(bob));
  assert.equal(workspace.objectives.length, 2);
  assert.equal(workspace.objectives.every(o => !o.canEdit), true);
  assert.equal(workspace.keyResults[0].canEdit, false);
  const company = workspace.objectives.find(o => o.id === companyId)!;
  assert.equal(company.health, "none");
  assert.equal(company.progress, 0);
});
test("KR owner—not objective owner—controls progress and editing", async () => {
  await saveKeyResult(admin, { ownerId: "bob" }, metricId);
  await assert.rejects(addCheckIn(alice, metricId, { measurementType: "metric", value: 50, note: "No longer mine" }), isStatus(403));
  await assert.rejects(removeOkr(alice, "objective", individualId), isStatus(403));
  await addCheckIn(bob, metricId, { measurementType: "metric", value: 60, note: "New owner update" });
  await saveKeyResult(admin, { ownerId: "alice" }, metricId);
});
test("revoked staff cannot write with an old actor snapshot", async () => {
  await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, "alice"));
  await assert.rejects(saveObjective(alice, { title: "No access" }, individualId), isStatus(403));
  await db.update(usersTable).set({ active: true }).where(eq(usersTable.id, "alice"));
});
test("removal is permission checked, protects alignment, and retains check-in history", async () => {
  await assert.rejects(removeOkr(admin, "objective", companyId), isStatus(409));
  await assert.rejects(removeOkr(bob, "key_result", metricId), isStatus(403));
  await removeOkr(alice, "key_result", metricId);
  assert.equal((await getOkrWorkspace(admin)).keyResults.length, 0);
  assert.equal((await getOkrWorkspace(admin)).checkIns.length, 0);
  assert.equal((await db.select().from(checkInsTable).where(eq(checkInsTable.keyResultId, metricId))).length, 3);
  await removeOkr(alice, "objective", individualId);
  await removeOkr(admin, "objective", companyId);
  assert.equal((await getOkrWorkspace(admin)).objectives.length, 0);
});
