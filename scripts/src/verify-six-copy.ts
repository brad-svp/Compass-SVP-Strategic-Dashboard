/** UI integration with intercepted fixtures: never changes real planning periods. */
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
if (process.env.REPLIT_DEPLOYMENT || !process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev")) throw Error("Development only");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({ executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext();
  assert.equal((await context.request.post(origin + "/api/dev-auth", { headers: { Origin: origin }, data: { role: "staff" } })).status(), 200);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const day = (n: number) => new Date(Date.parse(today + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const periods = [-1, 0, 1].map((n, index) => ({
    id: `copy-period-${index}`, name: ["Previous fixture", "Current fixture", "Next fixture"][index],
    startDate: day(n * 42 - 1), endDate: day(n * 42 + 40), meetingDate: null, meetingNotes: "", status: n < 0 ? "closed" : "active", version: 1,
    moments: Array.from({ length: 6 }, (_, i) => ({ id: `copy-slot-${index}-${i}`, periodId: `copy-period-${index}`, position: i + 1, title: "", eventDate: null, version: 1 })),
  }));
  const source = {
    id: "copy-source", periodId: periods[1].id, momentId: periods[1].moments[2].id, ownerId: "svp-dev-staff",
    title: "Carry this priority forward", description: "Keep the original details", status: "done", version: 1, canEdit: true, updatedAt: new Date().toISOString(),
  };
  const items = [source, { ...source, id: "past-source", periodId: periods[0].id, momentId: periods[0].moments[2].id }, { ...source, id: "future-source", periodId: periods[2].id, momentId: periods[2].moments[2].id }];
  let created: Record<string, unknown> | null = null;
  const page = await context.newPage();
  await page.route("**/api/svp/six-by-six", route => route.fulfill({ json: { periods, items } }));
  await page.route("**/api/svp/six-by-six/view-preferences", route => route.fulfill({ json: { mode: "all", staffIds: [] } }));
  await page.route("**/api/svp/six-by-six/items", async route => {
    created = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id: "created-copy" } });
  });
  await page.goto(origin + "/six-by-six");
  const copy = page.getByTestId("button-copy-item-copy-source");
  await copy.click();
  assert.equal(await page.getByTestId("input-item-title").inputValue(), source.title);
  assert.equal(await page.getByTestId("input-item-description").inputValue(), source.description);
  assert.match(await page.getByRole("dialog").innerText(), /Next fixture/);
  assert.match(await page.getByTestId("select-item-status").innerText(), /Planned/);
  await page.getByTestId("input-item-title").fill("Copied priority");
  await page.getByTestId("button-save-item").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.deepEqual(created, { momentId: periods[2].moments[2].id, ownerId: "svp-dev-staff", title: "Copied priority", description: source.description, status: "planned" });
  assert.equal(await page.getByTestId("button-copy-item-past-source").count(), 0);
  assert.equal(await page.getByTestId("button-copy-item-future-source").count(), 0);
  assert.match(await page.getByTestId("button-item-copy-source").innerText(), /Carry this priority forward/);
  // Read-only teammate item must never expose a carry-forward action to staff.
  items[0] = { ...source, ownerId: "svp-dev-admin", canEdit: false };
  await page.reload();
  assert.equal(await page.getByTestId("button-copy-item-copy-source").count(), 0);
  console.log("PASS current-only copy, next-period/same-priority payload, planned reset, original unchanged and staff ownership gate (intercepted UI fixtures)");
} finally { await browser.close(); }
