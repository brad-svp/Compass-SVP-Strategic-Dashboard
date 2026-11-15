import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";
import { db, pool, usersTable, areasTable, systemsTable, calendarEventsTable, programLogoUploadsTable, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSystemsOverview, saveSvpSystem, deleteSvpSystem } from "../src/lib/systemsService";
import { getSvpPurpose, updateSvpPurpose, seedPurpose } from "../src/lib/purposeService";
import { saveCalendarProgram, getCalendarPrograms, seedCalendarPrograms } from "../src/lib/calendarProgramsService";
import { saveCalendarEvent, getMasterCalendar } from "../src/lib/calendarService";
import { completeProgramLogoUpload, normalizeProgramLogo, requestProgramLogoUpload } from "../src/lib/programLogoService";
import type { StaffActor } from "../src/lib/permissions";
const schema = `svp_test_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: StaffActor, staff: StaffActor, other: StaffActor, systemId: string;
const status = (code: number) => (e: unknown) => !!e && typeof e === "object" && "status" in e && e.status === code;
const system = { name: "Team planning", url: "https://example.com/tools", purpose: "Keep team planning together", howUsed: "Review weekly", audience: "Operations team", usedByIds: ["staff"], ownerId: "admin", category: "Operations", cadence: "Weekly", accessInstructions: "Ask the owner for an invitation; credentials stay in the password manager.", status: "active", expectedVersion: 0 };
before(async () => {
  pool.options.options = `-c search_path=${schema}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`); await client.query(`SET search_path TO "${schema}"`);
    const dir = new URL("../../../lib/db/drizzle/", import.meta.url);
    for (const file of (await readdir(dir)).filter(f => /^\d+_.+\.sql$/.test(f)).sort()) {
      await client.query((await readFile(new URL(file, dir), "utf8")).replaceAll('"public".', `"${schema}".`));
    }
  } finally { client.release(); }
  await db.insert(areasTable).values({ id: "area", name: "Area", color: "#1D8BC4" });
  [admin, staff, other] = await db.insert(usersTable).values([
    { id: "admin", name: "Admin", role: "admin", areaId: "area" },
    { id: "staff", name: "Staff", role: "staff", areaId: "area" },
    { id: "other", name: "Other", role: "admin", areaId: "area" },
  ]).returning();
});
after(async () => { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); });
test("systems persist full usage metadata, staff read-only access and server-side admin restrictions", async () => {
  assert.equal((await getSystemsOverview(staff)).systems.length, 0);
  await assert.rejects(saveSvpSystem(staff, system), status(403));
  ({ id: systemId } = await saveSvpSystem(admin, system));
  const record = (await getSystemsOverview(staff)).systems[0];
  assert.equal(record.canEdit, false);
  assert.deepEqual(record.usedByIds, ["staff"]);
  assert.equal(record.accessInstructions, system.accessInstructions);
  await assert.rejects(saveSvpSystem(staff, { ...system, expectedVersion: 1 }, systemId), status(403));
  await assert.rejects(deleteSvpSystem(staff, systemId, { expectedVersion: 1 }), status(403));
});
test("system validation blocks unsafe links and invalid assignments", async () => {
  for (const url of ["javascript:alert(1)", "data:text/html,x", "https://name:password@example.com"]) await assert.rejects(saveSvpSystem(admin, { ...system, url }));
  await assert.rejects(saveSvpSystem(admin, { ...system, ownerId: "missing" }), status(400));
  await assert.rejects(saveSvpSystem(admin, { ...system, usedByIds: ["missing"] }), status(400));
  await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, staff.id));
  await assert.rejects(saveSvpSystem(admin, system), status(400));
  await saveSvpSystem(admin, { ...system, name: "Retired planning", status: "retired", expectedVersion: 1 }, systemId);
  await db.update(usersTable).set({ active: true }).where(eq(usersTable.id, staff.id));
});
test("system retirement/restoration, stale edits and removal preserve audit history", async () => {
  await assert.rejects(saveSvpSystem(admin, { ...system, expectedVersion: 1 }, systemId), status(409));
  await saveSvpSystem(admin, { ...system, expectedVersion: 2 }, systemId);
  assert.equal((await getSystemsOverview(staff)).systems[0].status, "active");
  await assert.rejects(deleteSvpSystem(admin, systemId, { expectedVersion: 2 }), status(409));
  await deleteSvpSystem(admin, systemId, { expectedVersion: 3 });
  assert.equal((await getSystemsOverview(admin)).systems.length, 0);
  assert.ok((await db.select().from(systemsTable).where(eq(systemsTable.id, systemId)))[0].deletedAt);
  assert.equal((await db.select().from(auditLogTable).where(eq(auditLogTable.entityId, systemId))).length, 4);
});
test("purpose imports approved website wording once; only admins configure, reorder and remove values", async () => {
  assert.equal(await seedPurpose(), true);
  const original = await getSvpPurpose(staff);
  assert.equal(original.canEdit, false);
  assert.equal(original.values.length, 6);
  assert.equal(original.vision, "A thriving Sacramento region where everyone can reach their potential.");
  const data = { mission: "Edited mission", vision: "", values: original.values.slice(1).reverse(), expectedVersion: 1 };
  await assert.rejects(updateSvpPurpose(staff, data), status(403));
  await updateSvpPurpose(admin, data);
  await assert.rejects(updateSvpPurpose(admin, data), status(409));
  assert.equal(await seedPurpose(), false);
  const changed = await getSvpPurpose(admin);
  assert.equal(changed.mission, "Edited mission");
  assert.equal(changed.vision, "");
  assert.deepEqual(changed.values, data.values);
  await assert.rejects(updateSvpPurpose(admin, { ...data, expectedVersion: 2, values: [data.values[0], data.values[0]] }));
});
test("programs preserve event assignments and versions on rename, and retired programs cannot be newly assigned", async () => {
  await db.insert(calendarEventsTable).values({ id: "old-event", title: "Old event", planningYear: 2027, startDate: "2027-01-20", endDate: "2027-01-20", program: "Community" });
  assert.equal(await seedCalendarPrograms(), 1);
  assert.equal(await seedCalendarPrograms(), 0);
  const program = (await getCalendarPrograms(admin))[0];
  assert.equal(program.eventCount, 1);
  await assert.rejects(saveCalendarProgram(staff, { name: "Other", logoId: null, active: true, expectedVersion: 0 }), status(403));
  await saveCalendarProgram(admin, { name: "Community events", logoId: null, active: false, expectedVersion: 1 }, program.id);
  const event = (await getMasterCalendar(staff)).events.find(e => e.id === "old-event")!;
  assert.equal(event.programId, program.id); assert.equal(event.program, "Community events"); assert.equal(event.version, 2);
  const fields = { title: "Edited event", program: event.program, planningYear: 2027, startDate: "2027-01-20", endDate: "2027-01-20", allDay: true, startsAt: null, endsAt: null, location: "", dateStatus: "proposed", locationStatus: "tbd", audience: [], wixUrl: "", notes: "", ownerId: null, expectedVersion: 2 };
  await saveCalendarEvent(admin, fields, event.id);
  await assert.rejects(saveCalendarEvent(admin, { ...fields, expectedVersion: 0 }), status(400));
  await assert.rejects(saveCalendarProgram(admin, { name: "COMMUNITY EVENTS", logoId: null, active: true, expectedVersion: 0 }), status(409));
  await assert.rejects(saveCalendarProgram(admin, { name: "Stale", logoId: null, active: true, expectedVersion: 1 }, program.id), status(409));
});
test("logos require admin-owned, unexpired verified uploads before program assignment", async () => {
  const id = crypto.randomUUID();
  await db.insert(programLogoUploadsTable).values({ id, actorId: admin.id, pendingPath: "/objects/uploads/test", contentType: "image/png", size: 10, expiresAt: new Date(Date.now() + 60_000) });
  const data = { name: "Logo program", logoId: id, active: true, expectedVersion: 0 };
  await assert.rejects(saveCalendarProgram(admin, data), status(400));
  await assert.rejects(completeProgramLogoUpload(staff, id), status(403));
  await assert.rejects(completeProgramLogoUpload(other, id), status(404));
  await completeProgramLogoUpload(admin, id, async () => ({ objectPath: "/objects/program-logos/verified", contentType: "image/webp", size: 20 }));
  await assert.rejects(saveCalendarProgram(other, data), status(400));
  const program = await saveCalendarProgram(admin, data);
  assert.equal((await getCalendarPrograms(staff)).find(p => p.id === program.id)?.logoUrl, `/api/svp/program-logos/${id}`);
  await assert.rejects(requestProgramLogoUpload(staff, { name: "test.png", size: 10, contentType: "image/png" }), status(403));
  await assert.rejects(requestProgramLogoUpload(admin, { name: "bad.svg", size: 10, contentType: "image/svg+xml" }));
  await assert.rejects(requestProgramLogoUpload(admin, { name: "large.png", size: 3_000_000, contentType: "image/png" }));
});
test("logo normalization fully decodes safe images, resizes and rejects scripts, invalid bytes and mismatched types", async () => {
  const png = await sharp({ create: { width: 800, height: 200, channels: 4, background: "#1D8BC4" } }).png().toBuffer();
  const webp = await normalizeProgramLogo(png, "image/png");
  const metadata = await sharp(webp).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 512);
  await assert.rejects(normalizeProgramLogo(png, "image/jpeg"), status(400));
  await assert.rejects(normalizeProgramLogo(Buffer.from('<svg><script>alert(1)</script></svg>'), "image/png"), status(400));
  await assert.rejects(normalizeProgramLogo(Buffer.from("not an image"), "image/png"), status(400));
});
test("revoked admin sessions cannot mutate systems, purpose or program configuration", async () => {
  await db.update(usersTable).set({ role: "staff" }).where(eq(usersTable.id, admin.id));
  await assert.rejects(saveSvpSystem(admin, system), status(403));
  await assert.rejects(updateSvpPurpose(admin, { mission: "", vision: "", values: [], expectedVersion: 2 }), status(403));
  await assert.rejects(saveCalendarProgram(admin, { name: "Revoked", active: true, logoId: null, expectedVersion: 0 }), status(403));
});
