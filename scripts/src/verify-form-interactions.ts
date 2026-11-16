/** Dev-only real pointer/keyboard regression; never submits or changes stored content. */
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

if (process.env.REPLIT_DEPLOYMENT || !process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev")) throw Error("Development only");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({
  executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  headless: true, args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  assert.equal((await context.request.post(origin + "/api/dev-auth", {
    headers: { Origin: origin }, data: { role: "admin" },
  })).status(), 200);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await mkdir("generated-artifacts/form-review", { recursive: true });
  // Cross-origin iframe wrapper approximates an embedded preview, not actual iPad Safari.
  await page.route("https://preview-shell.test/**", route => route.fulfill({
    contentType: "text/html", body: `<iframe title="App" src="${origin}/qbos" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`,
  }));
  for (const embedded of [false, true]) {
    if (process.argv.includes("--iframe-mobile") && !embedded) continue;
    if (embedded) await page.goto("https://preview-shell.test/");
    for (const mobile of [false, true]) {
      if (process.argv.includes("--iframe-mobile") && !mobile) continue;
      await page.setViewportSize(mobile ? { width: 390, height: 650 } : { width: 1280, height: 900 });
      const app = embedded ? page.frames().find(f => f.url().startsWith(origin))! : page.mainFrame();
      assert.ok(app, "App iframe loaded");
      for (const form of [
        { path: "/qbos", open: '[data-testid="button-add-quarter-narrative"],[data-testid="button-edit-quarter-narrative"]' },
        { path: "/qbos", name: /Add.*QBO/i },
        { path: "/systems", open: '[data-testid="button-add-system"],[data-testid="button-add-first-system"]' },
        { path: "/calendar", open: '[data-testid="button-new-note"]' },
        { path: "/scorecard", name: /Metric/, exact: true },
        { path: "/brain", open: '[data-testid="button-brain-new"]' },
        { path: "/admin", open: '[data-testid="button-add-staff"]' },
        { path: "/purpose", open: '[data-testid="button-edit-purpose"]' },
      ]) {
        if (process.argv.includes("--iframe-mobile") && !["/brain", "/admin", "/purpose"].includes(form.path)) continue;
        await app.goto(origin + form.path);
        const opener = form.open ? app.locator(form.open).first() : app.getByRole("button", { name: form.name!, exact: form.exact }).first();
        await opener.click();
        const modal = app.getByRole("dialog").last();
        await modal.waitFor();
        const fields = modal.locator('input:not([type="hidden"]):not([type="number"]):not([type="date"]):not([type="checkbox"]),textarea');
        for (let i = 0; i < await fields.count(); i++) {
          const field = fields.nth(i);
          if (!await field.isVisible() || !await field.isEditable()) continue;
          await field.click();
          await field.press("ControlOrMeta+A");
          await field.pressSequentially("Keyboard interaction check");
          assert.equal(await field.inputValue(), "Keyboard interaction check", form.path);
          assert.ok(await field.evaluate(e => e.ownerDocument.activeElement === e), "Pointer click retains field focus");
        }
        const selector = modal.locator('button[aria-haspopup="listbox"]').first();
        if (await selector.count()) {
          await selector.click();
          const options = modal.locator('[role="option"]:not(:disabled)');
          await options.first().waitFor();
          const rect = await options.first().boundingBox();
          assert.ok(rect && rect.height > 10);
          await options.first().click();
          assert.equal(await selector.getAttribute("aria-expanded"), "false");
          await selector.click();
          // The floating option panel can legitimately cover a field below it.
          // Click the uncovered dialog heading to exercise outside dismissal.
          await modal.getByRole("heading").first().click();
          assert.equal(await selector.getAttribute("aria-expanded"), "false");
          await fields.first().click();
          await fields.first().pressSequentially(" after dropdown");
          assert.match(await fields.first().inputValue(), /after dropdown/);
        }
        await modal.getByRole("button", { name: "Close", exact: true }).last().focus();
        await page.keyboard.press("Tab");
        assert.ok(await modal.evaluate(e => e.contains(e.ownerDocument.activeElement)), "Tab stays inside dialog");
        if (form.path === "/qbos" && !form.name) {
          await page.screenshot({ path: `generated-artifacts/form-review/narrative-${embedded ? "iframe" : "direct"}-${mobile ? "mobile" : "desktop"}.jpg` });
        }
        await page.keyboard.press("Escape");
        await modal.waitFor({ state: "detached" });
        assert.equal(await app.locator("[data-modal-layer]").count(), 0);
        assert.notEqual(await app.locator("body").evaluate(e => e.style.overflow), "hidden");
        console.log(`PASS ${embedded ? "cross-origin iframe" : "direct"} ${mobile ? "mobile" : "desktop"} ${form.path} ${form.name ?? "form"}`);
      }
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
