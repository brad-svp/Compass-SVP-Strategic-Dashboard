/** Dev browser checks with a disposable teammate; no real staff profiles are changed. */
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { db, pool, usersTable, areasTable, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
if (process.env.REPLIT_DEPLOYMENT || !process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev")) throw Error("Development only");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const id = `photo-verification-${crypto.randomUUID()}`;
const [area] = await db.select().from(areasTable).limit(1);
await db.insert(usersTable).values({ id, name: "Temporary photo verification", areaId: area.id, role: "staff", active: true });
const browser = await chromium.launch({
  executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  headless: true, args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const login = async (role: string) => {
  assert.equal((await ctx.request.post(origin + "/api/dev-auth", { headers: { Origin: origin }, data: { role }, timeout: 15000 })).status(), 200);
};
try {
  await login("admin");
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(origin + "/scorecard");
  await page.getByTestId("button-scorecards-my").click();
  assert.match(page.url(), /owner=svp-dev-admin/);
  assert.equal(await page.getByTestId("button-scorecards-my").getAttribute("aria-pressed"), "true");
  const tracker = await (await ctx.request.get(origin + "/api/svp/scorecard/tracker")).json();
  const mine = tracker.metrics.filter((m: { active: boolean; ownerId: string }) => m.active && m.ownerId === "svp-dev-admin");
  assert.equal(await page.locator('[data-testid^="row-metric-"]').count(), mine.length);
  await page.reload();
  assert.equal(await page.getByTestId("button-scorecards-my").getAttribute("aria-pressed"), "true");
  await page.getByTestId("button-scorecards-all").click();
  assert.equal(new URL(page.url()).searchParams.has("owner"), false);
  assert.equal(await page.locator('[data-testid^="row-metric-"]').count(), tracker.metrics.filter((m: { active: boolean }) => m.active).length);
  console.log("PASS scorecard My/All filters, visible results and reload");
  await page.goto(origin + "/admin");
  console.log("Admin page loaded");
  await page.getByTestId(`button-edit-staff-${id}`).click();
  console.log("Teammate dialog opened");
  const editor = page.getByTestId(`photo-editor-${id}`);
  const photo = await readFile(new URL("../../artifacts/svp-os/public/brand/svp-mark-blue.png", import.meta.url));
  const uploaded = page.waitForResponse(r => r.url().endsWith(`/staff/${id}/photo`) && r.request().method() === "POST");
  console.log("Attaching test image");
  await editor.getByTestId("input-profile-photo").setInputFiles({ name: "temporary-test.png", mimeType: "image/png", buffer: photo });
  console.log("Test image attached");
  const result = await uploaded;
  console.log("Upload response received", result.status());
  assert.equal(result.status(), 200);
  console.log("Uploaded; waiting for refreshed avatar");
  await editor.getByText("Photo saved.", { exact: true }).waitFor();
  const img = editor.getByRole("img");
  await img.waitFor();
  console.log("Avatar rendered");
  const src = await img.getAttribute("src");
  assert.match(src!, /\/profile-photos\//);
  const served = await ctx.request.get(origin + src, { timeout: 15000 });
  assert.equal(served.status(), 200);
  assert.match(served.headers()["content-type"], /image\/webp/);
  const anonymous = await browser.newContext();
  assert.notEqual((await anonymous.request.get(origin + src, { timeout: 15000 })).status(), 200);
  await anonymous.close();
  await page.reload();
  await page.getByTestId(`button-edit-staff-${id}`).click();
  await editor.getByRole("img").waitFor();
  assert.equal(await editor.getByRole("img").getAttribute("src"), src);
  await mkdir("generated-artifacts/profile-review", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/profile-review/admin-photo.jpg" });
  await editor.getByTestId("button-remove-photo").click();
  await editor.getByText("Photo removed.", { exact: true }).waitFor();
  assert.equal(await editor.getByRole("img").count(), 0);
  assert.equal((await ctx.request.get(origin + src)).status(), 404);
  await login("staff");
  const forbidden = await ctx.request.post(`${origin}/api/svp/staff/${id}/photo`, { headers: { Origin: origin, "Content-Type": "application/octet-stream" }, data: photo });
  assert.equal(forbidden.status(), 403);
  await page.goto(origin + "/settings");
  await page.getByTestId("photo-editor-svp-dev-staff").getByTestId("button-upload-photo").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "generated-artifacts/profile-review/settings-mobile.jpg" });
  assert.deepEqual(errors, []);
  console.log("PASS actual storage upload, private image serving, reload, removal, admin teammate controls and staff self controls/permissions");
} finally {
  // Clear a failed test's photo through the real endpoint so storage is cleaned too.
  await login("admin");
  await ctx.request.delete(`${origin}/api/svp/staff/${id}/photo`, { headers: { Origin: origin }, timeout: 15000 });
  await browser.close();
  await db.delete(auditLogTable).where(eq(auditLogTable.entityId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  await pool.end();
}
