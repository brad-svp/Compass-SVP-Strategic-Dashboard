/** Fixture-only UI round trips: no real QBOs, cycles or narratives are changed. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
if (process.env.REPLIT_DEPLOYMENT || !process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev")) throw Error("Development only");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({ executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium", args: ["--no-sandbox"] });
try {
  const context = await browser.newContext();
  assert.equal((await context.request.post(origin + "/api/dev-auth", { headers: { Origin: origin }, data: { role: "admin" } })).status(), 200);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const cycles = [2027, 2026].map(year => ({ id: `rich-${year}`, name: String(year), startDate: `${year}-01-01`, endDate: `${year}-12-31`, status: year === 2027 ? "active" : "closed" }));
  await page.route("**/api/svp/foundation", async route => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), cycles } });
  });
  const objective = (year: number) => ({
    id: `objective-${year}`, cycleId: `rich-${year}`, level: "company", ownerId: "svp-dev-admin",
    areaId: "", parentObjectiveId: null, title: `${year} QBO fixture`, description: "",
    timeScope: "Q1", status: "active", sortOrder: 0, aiDrafted: false, progress: 0,
    expectedProgress: 0, health: "none", canEdit: true,
  });
  await page.route("**/api/svp/okrs", route => route.fulfill({ json: {
    objectives: [objective(2027), objective(2026)], keyResults: [], checkIns: [], comments: [],
  } }));
  const narratives = new Map<string, { narrative: string; version: number }>([
    ["rich-2027/Q1", { narrative: "Original plain text <b>literal example</b>", version: 1 }],
    ["rich-2026/Q1", { narrative: "Past-year plain direction", version: 1 }],
  ]);
  await page.route(/\/api\/svp\/qbos\/narratives\/[^/]+\/Q[1-4]$/, async route => {
    const path = new URL(route.request().url()).pathname.split("/").slice(-2).join("/");
    const [cycleId, quarter] = path.split("/");
    const saved = narratives.get(path) ?? { narrative: "", version: 0 };
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      assert.equal(body.expectedVersion, saved.version);
      narratives.set(path, { narrative: body.narrative, version: saved.version + 1 });
    }
    await route.fulfill({ json: { cycleId, quarter, ...narratives.get(path) ?? saved, canEdit: true, updatedAt: null } });
  });
  await page.goto(origin + "/qbos?cycle=rich-2027&q=Q1");
  const display = page.getByTestId("text-quarter-narrative");
  await display.waitFor();
  assert.equal(await display.locator("b,strong").count(), 0, "Legacy HTML remains literal plain text");
  await page.getByTestId("button-edit-quarter-narrative").click();
  const editor = page.getByTestId("input-quarter-narrative");
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await editor.pressSequentially("Quarter focus");
  await page.getByRole("button", { name: "Heading 2", exact: true }).click();
  await editor.press("End");
  await editor.press("Enter");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await editor.pressSequentially("Bold direction");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await editor.press("Enter");
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  await editor.pressSequentially("Italic direction");
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  await editor.press("Enter");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await editor.pressSequentially("First action");
  await editor.press("Enter");
  await editor.pressSequentially("Second action");
  await editor.press("Enter");
  await editor.press("Enter");
  await page.getByRole("button", { name: "Numbered list", exact: true }).click();
  await editor.pressSequentially("First milestone");
  await editor.press("Enter");
  await editor.pressSequentially("Second milestone");
  await page.getByTestId("button-save-narrative").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  for (const tag of ["h2", "strong", "em", "ul", "ol"]) {
    assert.ok(await display.locator(tag).count(), `Saved ${tag} formatting`);
  }
  assert.ok(narratives.get("rich-2027/Q1")!.narrative.startsWith("<!--svp-rich-text:v1-->"));
  await page.reload();
  await page.getByTestId("button-edit-quarter-narrative").click();
  assert.equal(await editor.locator("ul li").count(), 2);
  assert.equal(await editor.locator("ol li").count(), 2);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("select-qbo-year").click();
  await page.getByRole("option", { name: "2026", exact: true }).click();
  await page.getByText("2026 QBO fixture", { exact: true }).waitFor();
  assert.equal(await page.getByText("2027 QBO fixture", { exact: true }).count(), 0);
  assert.equal(await display.innerText(), "Past-year plain direction");
  await page.getByTestId("tab-quarter-Q2").click();
  assert.equal(new URL(page.url()).searchParams.get("year"), "2026");
  await page.reload();
  assert.match(await page.getByTestId("select-qbo-year").innerText(), /2026/);
  await page.getByTestId("select-qbo-year").click();
  await page.getByRole("option", { name: "2025", exact: true }).click();
  await page.getByText(/No planning cycle has been set up for 2025/).waitFor();
  assert.equal(await page.getByTestId("button-new-qbo").count(), 0);

  narratives.set("rich-2027/Q1", { narrative: '<!--svp-rich-text:v1--><h2>Safe title</h2><p onclick="window.__richXss=true">Safe body</p><img src="x" onerror="window.__richXss=true"><script>window.__richXss=true</script>', version: 3 });
  await page.goto(origin + "/qbos?cycle=rich-2027&q=Q1");
  await display.locator("h2").waitFor();
  assert.equal(await display.locator("script,img,[onclick]").count(), 0);
  assert.equal(await page.evaluate(() => (globalThis as unknown as Record<string, unknown>).__richXss), undefined);
  await page.getByTestId("button-edit-quarter-narrative").click();
  await page.getByTestId("button-clear-narrative").click();
  await page.getByTestId("button-confirm-clear-narrative").click();
  await page.getByTestId("button-add-quarter-narrative").waitFor();
  assert.equal(narratives.get("rich-2027/Q1")!.narrative, "");

  // Real click/keyboard behavior inside a cross-origin frame at phone size.
  await page.setViewportSize({ width: 390, height: 750 });
  await page.route("https://preview-shell.test/**", route => route.fulfill({ contentType: "text/html",
    body: `<iframe title="App" src="${origin}/qbos?cycle=rich-2027&q=Q1" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>` }));
  await page.goto("https://preview-shell.test/");
  const frame = page.frameLocator("iframe");
  await frame.getByTestId("button-add-quarter-narrative").click();
  const embedded = frame.getByTestId("input-quarter-narrative");
  await embedded.evaluate(el => {
    el.blur();
    el.addEventListener("mousedown", (e: { preventDefault: () => void }) => e.preventDefault(), { once: true });
  });
  await embedded.click();
  assert.ok(await embedded.evaluate(e => e.ownerDocument.activeElement === e), "Embedded editor accepts cancelled native focus");
  await embedded.pressSequentially("Embedded direction");
  await embedded.press("ControlOrMeta+A");
  await frame.getByRole("button", { name: "Bold", exact: true }).click();
  assert.equal(await embedded.locator("strong").innerText(), "Embedded direction");
  await mkdir("generated-artifacts/qbo-review", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/qbo-review/mobile-rich-text.jpg" });
  await frame.getByTestId("button-save-narrative").click();
  await frame.getByRole("dialog").waitFor({ state: "detached" });
  assert.match(narratives.get("rich-2027/Q1")!.narrative, /<strong>Embedded direction<\/strong>/);
  assert.deepEqual(errors, []);
  console.log("PASS bold, italic, headings, bullet/numbered lists, save/reload/reopen, plain-text compatibility, XSS filtering, clear, historical year/quarter isolation, empty years and embedded mobile focus (fixtures only)");
} finally { await browser.close(); }
