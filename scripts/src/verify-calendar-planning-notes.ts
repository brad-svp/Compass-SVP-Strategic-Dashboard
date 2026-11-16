/** Dev-only calendar browser regression. Removes only its uniquely named fixture. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { db, pool, calendarEventsTable, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";

if (process.env.REPLIT_DEPLOYMENT || !process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev")) throw Error("Development only.");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const title = `Planning note verification ${crypto.randomUUID()}`;
const out = new URL("../../generated-artifacts/calendar-review/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.argv.find(x => x.startsWith("--chromium="))?.slice(11) ?? "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  headless: true, args: ["--no-sandbox"],
});
let id = "";
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const login = await ctx.request.post(origin + "/api/dev-auth", { headers: { Origin: origin }, data: { role: "admin" } });
  assert.equal(login.status(), 200);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(origin + "/calendar");
  await page.getByTestId("button-new-note").click();
  await page.getByTestId("input-event-title").fill(title);
  await page.getByTestId("input-note-date").fill("2027-04-05");
  await page.getByTestId("input-event-notes").fill("Release Fast Pitch applications and share instructions.");
  assert.equal(await page.getByTestId("input-event-location").count(), 0);
  const created = page.waitForResponse(r => r.url().endsWith("/api/svp/calendar/events") && r.request().method() === "POST");
  await page.getByTestId("button-save-event").click();
  const response = await created;
  assert.equal(response.status(), 201, await response.text());
  id = (await response.json()).id;
  assert.ok(id);
  const row = page.getByTestId(`row-note-${id}`);
  await row.waitFor();
  assert.match(await row.innerText(), /Planning note/);
  await row.click();
  await page.getByTestId("button-edit-event").click();
  assert.equal(await page.getByTestId("input-event-title").inputValue(), title);
  await page.getByTestId("input-event-notes").fill("Updated instructions for the program team.");
  const edited = page.waitForResponse(r => r.url().endsWith(`/api/svp/calendar/events/${id}`) && r.request().method() === "PATCH");
  await page.getByTestId("button-save-event").click();
  assert.equal((await edited).status(), 200);
  await page.goto(`${origin}/calendar?event=${id}&year=2027`);
  await page.getByTestId(`detail-event-${id}`).waitFor();
  await page.getByTestId(`detail-event-${id}`).getByRole("button", { name: "Close", exact: true }).click();
  const card = page.getByTestId(`note-month-${id}`);
  await card.waitFor();
  assert.match(await card.innerText(), /Updated instructions/);
  assert.equal(await page.getByTestId("day-2027-04-05").getByTestId(`note-month-${id}`).count(), 1);
  const eventCard = page.locator('[data-testid^="event-timed-"]').first();
  if (await eventCard.count()) {
    const size = await eventCard.boundingBox();
    assert.ok(size && size.width >= 120 && size.height >= 80, "Month events must be readable cards.");
  }
  await page.getByTestId("view-month").screenshot({ path: out + "month-desktop.jpg" });
  await page.setViewportSize({ width: 390, height: 844 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "month-mobile.jpg" });
  const grid = page.getByTestId("view-month").locator(".overflow-x-auto");
  assert.ok(await grid.evaluate(e => e.scrollWidth > e.clientWidth), "Narrow screens keep readable cards with internal scrolling.");
  await card.click();
  await page.getByTestId(`detail-event-${id}`).waitFor();
  await page.getByTestId(`detail-event-${id}`).getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("button-view-year").click();
  await page.getByTestId(`row-note-${id}`).waitFor();
  const staffLogin = await ctx.request.post(origin + "/api/dev-auth", { headers: { Origin: origin }, data: { role: "staff" } });
  assert.equal(staffLogin.status(), 200);
  // Drop the earlier ?event deep link; reloading it intentionally reopens its detail dialog.
  await page.goto(origin + "/calendar");
  await page.getByTestId(`row-note-${id}`).waitFor();
  assert.equal(await page.getByTestId("button-new-note").count(), 0);
  await page.getByTestId(`row-note-${id}`).click();
  assert.equal(await page.getByTestId("button-edit-event").count(), 0);
  const adminAgain = await ctx.request.post(origin + "/api/dev-auth", { headers: { Origin: origin }, data: { role: "admin" } });
  assert.equal(adminAgain.status(), 200);
  await page.goto(`${origin}/calendar?event=${id}&year=2027`);
  await page.getByTestId("button-edit-event").click();
  await page.getByTestId("button-delete-event").click();
  const removed = page.waitForResponse(r => r.url().endsWith(`/api/svp/calendar/events/${id}`) && r.request().method() === "DELETE");
  await page.getByTestId("button-confirm-delete-event").click();
  assert.equal((await removed).status(), 200);
  await page.getByTestId(`note-month-${id}`).waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
  console.log("PASS: admin create/edit/delete, note placement, larger cards, timeline/month, mobile scrolling and staff read-only access.");
} finally {
  await browser.close();
  if (id) {
    await db.delete(auditLogTable).where(eq(auditLogTable.entityId, id));
    await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, id));
  }
  await pool.end();
}
