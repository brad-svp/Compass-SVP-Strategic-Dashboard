import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { db, pool, areasTable, usersTable, accountabilitySeatsTable, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAccountability, saveAccountability, deleteAccountability, validateReportingLine } from "../src/lib/accountabilityService";
import { seedAccountability } from "../src/lib/seedAccountability";
import type { StaffActor } from "../src/lib/permissions";

const schema = `svp_test_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: StaffActor, staff: StaffActor;
const status = (expected: number) => (err: unknown) => !!err && typeof err === "object" && "status" in err && err.status === expected;
before(async () => {
  pool.options.options = `-c search_path=${schema}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const file of ["0000_phase2_okrs.sql", "0001_accountability_chart.sql"]) {
      const migration = await readFile(new URL(`../../../lib/db/drizzle/${file}`, import.meta.url), "utf8");
      await client.query(migration.replaceAll('"public".', `"${schema}".`));
    }
  } finally { client.release(); }
  await db.insert(areasTable).values({ id: "area", name: "Test area", color: "#1D8BC4" });
  [admin, staff] = await db.insert(usersTable).values([
    { id: "admin", name: "Test Admin", role: "admin", areaId: "area" },
    { id: "staff", name: "Test Staff", role: "staff", areaId: "area" },
  ]).returning();
  await db.insert(usersTable).values(["brad", "drew", "jenny", "haylie", "dan", "amber"].map(id => ({ id, name: id, areaId: "area" })));
});
after(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test("chart imports all nine seats and exact shared-seat structure, without overwriting edits", async () => {
  await seedAccountability();
  let rows = await getAccountability();
  assert.equal(rows.length, 9);
  const drew = rows.filter(r => r.ownerId === "drew");
  assert.equal(drew.length, 3);
  assert.equal(drew.filter(r => r.sharedSeat).length, 2);
  assert.equal(rows.find(r => r.id === "accountability-marketing")?.personName, "Haylie Runner");
  assert.equal(rows.filter(r => r.kind === "function" && r.parentId === "accountability-integrator").length, 6);
  const visionary = rows.find(r => r.id === "accountability-visionary")!;
  await saveAccountability(admin, { ...input(visionary), roleLabel: "Edited strategy role" }, visionary.id);
  await seedAccountability();
  rows = await getAccountability();
  assert.equal(rows.find(r => r.id === visionary.id)?.roleLabel, "Edited strategy role");
});

function input(row: Awaited<ReturnType<typeof getAccountability>>[number]) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = row;
  return fields;
}

test("admin can create, edit and delete a seat with transactional audit history", async () => {
  const data = { title: "Temporary seat", kind: "function", ownerId: "staff", personName: "Test Staff", roleLabel: "", capacity: "Part time", responsibilities: ["One responsibility"], parentId: "accountability-integrator", sharedSeat: false, sortOrder: 10 };
  const created = await saveAccountability(admin, data);
  await saveAccountability(admin, { ...data, title: "Edited seat", ownerId: null, personName: "" }, created.id);
  assert.equal((await getAccountability()).find(s => s.id === created.id)?.ownerId, null);
  await deleteAccountability(admin, created.id);
  assert.ok(!(await getAccountability()).find(s => s.id === created.id));
  const history = await db.select().from(auditLogTable).where(eq(auditLogTable.entityId, created.id));
  assert.deepEqual(history.map(h => h.action), ["create", "update", "delete"]);
  await seedAccountability();
  assert.ok(!(await getAccountability()).find(s => s.id === created.id));
});

test("staff and revoked admins cannot modify the chart", async () => {
  const row = (await getAccountability())[1]!;
  await assert.rejects(saveAccountability(staff, input(row), row.id), status(403));
  await assert.rejects(deleteAccountability(staff, row.id), status(403));
  await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, admin.id));
  await assert.rejects(saveAccountability(admin, input(row), row.id), status(403));
  await db.update(usersTable).set({ active: true }).where(eq(usersTable.id, admin.id));
});

test("reporting cycles, missing parents, invalid owners and deletion of parent seats are blocked", async () => {
  const row = (await getAccountability()).find(s => s.id === "accountability-integrator")!;
  await assert.rejects(saveAccountability(admin, { ...input(row), parentId: "accountability-programs" }, row.id), status(400));
  await assert.rejects(saveAccountability(admin, { ...input(row), ownerId: "missing" }, row.id), status(400));
  await assert.rejects(deleteAccountability(admin, row.id), status(409));
  assert.throws(() => validateReportingLine("a", "a", []), status(400));
  assert.throws(() => validateReportingLine("a", "missing", []), status(400));
});
