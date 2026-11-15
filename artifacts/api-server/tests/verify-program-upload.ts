// Explicit development-only integration check. Never included in *.test.ts.
// Creates only UUID-labelled fixtures and removes their rows and storage objects.
import assert from "node:assert/strict";
import sharp from "sharp";
import { db, pool, systemsTable, calendarEventsTable, calendarProgramsTable, programLogoUploadsTable, auditLogTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { ObjectNotFoundError, ObjectStorageService } from "../src/lib/objectStorage";
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const ids: { system?: string; event?: string; program?: string; upload?: string } = {};
const name = `Upload verification ${crypto.randomUUID()}`;
async function login(role: "admin" | "staff") {
  const response = await fetch(`${origin}/api/dev-auth`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
  assert.equal(response.status, 200, "Development quick login must be available; never run on production.");
  const cookie = response.headers.getSetCookie().map(v => v.split(";")[0]).join("; ");
  assert.ok(cookie, "Development login must issue a session.");
  return cookie;
}
async function api(cookie: string, path: string, method = "GET", data?: unknown, expected = 200) {
  const response = await fetch(`${origin}/api/svp${path}`, { method, headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  assert.equal(response.status, expected, `${method} ${path} must return ${expected}`);
  return response;
}
try {
  const admin = await login("admin"), staff = await login("staff");
  const purpose = await (await api(staff, "/purpose")).json();
  assert.equal(typeof purpose.vision, "string");
  assert.equal(purpose.canEdit, false);
  const system = { name, url: "https://example.com", purpose: "Temporary integration fixture", howUsed: "", audience: "", usedByIds: [], ownerId: null, category: "", cadence: "", accessInstructions: "", status: "active", expectedVersion: 0 };
  ids.system = (await (await api(admin, "/systems", "POST", system, 201)).json()).id;
  assert.ok((await (await api(staff, "/systems")).json()).systems.some((s: { id: string }) => s.id === ids.system));
  await api(staff, `/systems/${ids.system}`, "PATCH", { ...system, expectedVersion: 1 }, 403);
  ids.program = (await (await api(admin, "/calendar/programs", "POST", { name, logoId: null, active: true, expectedVersion: 0 }, 201)).json()).id;
  const bytes = await sharp({ create: { width: 128, height: 64, channels: 4, background: "#1D8BC4" } }).png().toBuffer();
  const requested = await (await api(admin, "/calendar/program-logo-uploads", "POST", { name: "verification.png", size: bytes.length, contentType: "image/png" }, 201)).json();
  ids.upload = requested.id;
  const cors = await fetch(requested.uploadURL, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
  assert.ok([origin, "*"].includes(cors.headers.get("access-control-allow-origin") ?? ""), "Storage must permit browser PUT from this development origin.");
  const uploaded = await fetch(requested.uploadURL, { method: "PUT", headers: { "Content-Type": "image/png" }, body: bytes });
  assert.equal(uploaded.ok, true, "Direct-to-storage file upload must succeed.");
  await api(staff, `/calendar/program-logo-uploads/${ids.upload}/complete`, "POST", undefined, 403);
  const complete = await (await api(admin, `/calendar/program-logo-uploads/${ids.upload}/complete`, "POST")).json();
  await api(staff, `/program-logos/${ids.upload}`, "GET", undefined, 404);
  await api(admin, `/calendar/programs/${ids.program}`, "PATCH", { name, logoId: complete.logoId, active: true, expectedVersion: 1 });
  const logo = await api(staff, `/program-logos/${ids.upload}`);
  assert.equal(logo.headers.get("content-type"), "image/webp");
  assert.equal(logo.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await sharp(Buffer.from(await logo.arrayBuffer())).metadata()).width, 128);
  ids.event = (await (await api(admin, "/calendar/events", "POST", { title: name, program: name, planningYear: 2026, startDate: "2026-11-17", endDate: "2026-11-17", allDay: true, startsAt: null, endsAt: null, location: "", dateStatus: "confirmed", locationStatus: "tbd", audience: [], wixUrl: "", notes: "Temporary integration fixture", ownerId: null, expectedVersion: 0 }, 201)).json()).id;
  const calendar = await (await api(staff, "/calendar")).json();
  assert.equal(calendar.programs.find((p: { id: string }) => p.id === ids.program).logoUrl, complete.logoUrl);
  assert.equal(calendar.events.find((e: { id: string }) => e.id === ids.event).programId, ids.program);
  console.log("PASS: development HTTP auth, Systems save/read and staff restriction, purpose content, direct persistent logo upload, CORS, validation/finalization, staff image serving, calendar logo/event association.");
} finally {
  if (ids.event) await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, ids.event));
  if (ids.program) await db.delete(calendarProgramsTable).where(eq(calendarProgramsTable.id, ids.program));
  if (ids.system) await db.delete(systemsTable).where(eq(systemsTable.id, ids.system));
  if (ids.upload) {
    const [upload] = await db.select().from(programLogoUploadsTable).where(eq(programLogoUploadsTable.id, ids.upload));
    const storage = new ObjectStorageService();
    if (upload) for (const path of [upload.pendingPath, upload.objectPath].filter((v): v is string => !!v)) {
      try {
        const object = await storage.getObjectEntityFile(path);
        await object.delete();
      } catch (error) { if (!(error instanceof ObjectNotFoundError)) throw error; }
    }
    await db.delete(programLogoUploadsTable).where(eq(programLogoUploadsTable.id, ids.upload));
  }
  const entityIds = Object.values(ids).filter((v): v is string => !!v);
  if (entityIds.length) await db.delete(auditLogTable).where(inArray(auditLogTable.entityId, entityIds));
  await pool.end();
  console.log("Removed only this check's temporary records and uploaded objects.");
}
