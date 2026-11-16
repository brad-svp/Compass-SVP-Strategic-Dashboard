/** Real development-session browser checks. Does not create planning records. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

if(process.env.REPLIT_DEPLOYMENT||!process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev"))throw new Error("Development only.");
const origin=`https://${process.env.REPLIT_DEV_DOMAIN}`;
const out=new URL("../generated-artifacts/ui-verification/",import.meta.url).pathname;
await mkdir(out,{recursive:true});
const executablePath=process.argv.find(arg=>arg.startsWith("--chromium="))?.slice("--chromium=".length)??execFileSync("which",["chromium"],{encoding:"utf8"}).trim();
const browser=await chromium.launch({executablePath,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
let context=await browser.newContext({viewport:{width:1366,height:1000}});
let original:unknown;
let adminOriginal:unknown;
async function login(role:string) {
  const r=await context.request.post(`${origin}/api/dev-auth`,{headers:{Origin:origin},data:{role}});
  assert.equal(r.status(),200);
}
async function api(path:string) {
  const r=await context.request.get(`${origin}/api/svp${path}`);
  assert.equal(r.status(),200,`GET ${path}`);return r.json();
}
try {
  await login("staff");original=await api("/six-by-six/view-preferences");
  const me=await api("/session"),foundation=await api("/foundation");
  const other=foundation.staff.find((s:any)=>s.active&&s.id!==me.id);
  assert.ok(other);
  let page=await context.newPage();
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${origin}/six-by-six`);
  await page.getByTestId("button-view-all").waitFor();
  await page.getByTestId("button-view-all").click();
  await page.getByTestId("status-six-view-save").filter({hasText:"Saved to your account"}).waitFor();
  await page.locator(`[data-testid^="plan-"][data-testid$="-${other.id}"]`).first().waitFor();
  assert.equal(await page.locator(`[data-testid^="plan-"][data-testid$="-${other.id}"] [data-testid^="button-add-priority"]`).count(),0);
  assert.ok(await page.locator(`[data-testid^="plan-"][data-testid$="-${me.id}"] [data-testid^="button-add-priority"]`).count()>0);
  await page.getByTestId("button-view-custom").click();
  await page.getByTestId("button-select-none").click();
  await page.getByTestId(`checkbox-person-${other.id}`).check();
  await page.getByTestId("button-apply-custom").click();
  await page.getByTestId("status-six-view-save").filter({hasText:"Saved to your account"}).waitFor();
  assert.deepEqual(await api("/six-by-six/view-preferences"),{mode:"custom",staffIds:[other.id]});
  await context.close();
  // New browser session, no localStorage/cookies copied: account persistence only.
  context=await browser.newContext({viewport:{width:1366,height:1000}});
  await login("staff");page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${origin}/dashboard`);
  await page.locator(`[data-testid^="plan-"][data-testid$="-${me.id}"]`).first().waitFor();
  assert.equal(await page.locator(`[data-testid^="plan-"][data-testid$="-${other.id}"]`).count(),0);
  await page.getByRole("link",{name:"View all 6x6 priorities"}).waitFor();
  assert.equal(await page.getByText("Recent check-ins",{exact:true}).count(),0);
  assert.equal(await page.getByText(/^Who carries Q/).count(),0);
  await page.getByRole("link",{name:"View all 6x6 priorities"}).click();
  await page.locator(`[data-testid^="plan-"][data-testid$="-${other.id}"]`).first().waitFor();
  await page.goto(`${origin}/dashboard`);
  assert.equal(await page.getByTestId("filter-cycle").count(),0);
  assert.equal(await page.getByTestId("filter-quarter").count(),0);
  await page.getByTestId("panel-mission").waitFor();
  await page.screenshot({path:`${out}/dashboard.jpg`,fullPage:true});
  const order=await page.evaluate(()=>[...document.querySelectorAll('[data-testid="panel-my-six"],[data-testid="panel-mission"]')].map(e=>e.getAttribute("data-testid")));
  assert.deepEqual(order,["panel-my-six","panel-mission"]);
  await login("admin"); // Explicit user-requested development role login, not auth bypass.
  adminOriginal=await api("/six-by-six/view-preferences");
  await page.goto(`${origin}/six-by-six`);
  await page.getByTestId("button-view-all").click();
  await page.locator(`[data-testid^="plan-"][data-testid$="-${other.id}"]`).first().waitFor();
  assert.ok(await page.locator(`[data-testid^="plan-"][data-testid$="-${other.id}"] [data-testid^="button-add-priority"]`).count()>0);
  await page.goto(`${origin}/calendar`);
  const pane=page.getByTestId("pane-timeline");
  await pane.waitFor();
  const before=await pane.evaluate(e=>({scroll:e.scrollTop,top:e.getBoundingClientRect().top}));
  const mark=await page.getByTestId("timeline-today").evaluate(e=>e.getBoundingClientRect().top);
  assert.ok(before.scroll>0,"Timeline must scroll past existing historical events.");
  assert.ok(Math.abs(mark-before.top-12)<25,"Initial today marker should be at the top.");
  assert.equal(await page.getByTestId("select-year").count(),0);
  await page.getByTestId("button-timeline-earlier").click();
  await page.waitForTimeout(500);
  assert.ok(await pane.evaluate(e=>e.scrollTop)<before.scroll);
  await page.getByTestId("button-today").click();
  await page.waitForTimeout(600);
  assert.ok(Math.abs(await pane.evaluate(e=>e.scrollTop)-before.scroll)<10);
  await page.screenshot({path:`${out}/calendar.jpg`,fullPage:true});
  // Smaller mobile viewport emulates the visible space left above a soft keyboard.
  await page.setViewportSize({width:712,height:480});
  await page.getByTestId("button-new-event").click();
  const program=page.getByTestId("select-event-program");
  await program.click();
  const list=page.getByRole("listbox").last();
  await list.waitFor();
  assert.ok(await list.getByRole("option").count()>=8);
  assert.ok((await list.boundingBox())!.height>=44,"Mobile dropdown choices must not collapse to zero height.");
  await list.getByRole("option",{name:"Think Tank",exact:true}).click();
  assert.match(await program.innerText(),/Think Tank/);
  await page.getByTestId("input-event-title").fill("Unsaved browser verification");
  assert.equal(await page.getByTestId("input-event-title").inputValue(),"Unsaved browser verification");
  const status=page.getByTestId("select-event-date-status");
  await status.click();
  assert.ok((await page.getByRole("listbox").last().boundingBox())!.height>=44);
  await page.screenshot({path:`${out}/mobile-options.jpg`,fullPage:true});
  assert.equal(await page.getByRole("button",{name:"Close choices",exact:true}).count(),0);
  await page.getByTestId("input-event-title").click();
  assert.equal(await page.getByRole("listbox").count(),0,"Outside pointerdown must close the dropdown.");
  assert.equal(await page.getByTestId("input-event-title").evaluate(e=>e===document.activeElement),true,"Outside field keeps focus.");
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.goto(`${origin}/admin`);
  await page.getByTestId("tab-programs").click();
  await page.getByTestId("button-admin-manage-programs").waitFor();
  assert.ok(await page.locator('[data-testid^="row-program-"]').count()>=8);
  await page.goto(`${origin}/systems`);
  await page.locator('[data-testid="button-add-first-system"],[data-testid="button-add-system"]').first().click();
  await page.getByTestId("system-form-dialog").waitFor();
  // A closing Radix navigation/menu can leave a page-wide pointer lock behind.
  // The native dialog must remain interactive rather than inheriting that lock.
  await page.evaluate(()=>{document.body.style.pointerEvents="none";});
  await page.getByTestId("input-system-name").click();
  await page.keyboard.type("Unsaved system interaction check");
  assert.equal(await page.getByTestId("input-system-name").inputValue(),"Unsaved system interaction check");
  await page.getByTestId("input-system-purpose").click();
  await page.keyboard.type("A real pointer click and keyboard entry.");
  assert.match(await page.getByTestId("input-system-purpose").inputValue(),/real pointer click/);
  assert.equal(await page.getByTestId("list-system-users").count(),0);
  assert.equal(await page.getByTestId("input-system-audience").count(),0);
  assert.equal(await page.getByTestId("input-system-cadence").count(),0);
  assert.equal(await page.getByTestId("input-system-how").count(),0);
  assert.ok(await page.getByText("How/why we use it",{exact:true}).count()>0);
  assert.ok(await page.getByText("Access notes",{exact:true}).count()>0);
  await page.getByTestId("select-system-owner").click();
  await page.getByRole("listbox").getByRole("option").filter({hasText:other.name}).click();
  await page.screenshot({path:`${out}/systems-form.jpg`,fullPage:true});
  await page.getByTestId("button-cancel-system").click();
  await page.evaluate(()=>{document.body.style.pointerEvents="";});
  await page.goto(`${origin}/qbos`);
  await page.locator('[data-testid="button-empty-new-qbo"],[data-testid="button-new-qbo"]').first().click();
  const qboDialog=page.getByRole("dialog").last();
  await qboDialog.waitFor();
  await page.evaluate(()=>{document.body.style.pointerEvents="none";});
  const title=qboDialog.getByRole("textbox").first();
  await title.click();await page.keyboard.type("Unsaved QBO interaction check");
  assert.equal(await title.inputValue(),"Unsaved QBO interaction check");
  await qboDialog.getByRole("textbox").nth(1).click();
  await page.keyboard.type("The description accepts actual typing.");
  assert.match(await qboDialog.getByRole("textbox").nth(1).inputValue(),/actual typing/);
  await qboDialog.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.evaluate(()=>{document.body.style.pointerEvents="";});
  assert.deepEqual(errors,[]);
  process.stdout.write("PASS: staff sees all plans but edits own; admin edits all; full-page custom view persists; home is own-only; timeline and outside-click menus work; simplified Systems form and QBO typing remain clickable under a page pointer lock.\n");
} finally {
  // Restore each development account's original viewing choice, never its content.
  if(original){await login("staff");await context.request.put(`${origin}/api/svp/six-by-six/view-preferences`,{headers:{Origin:origin},data:original});}
  if(adminOriginal){await login("admin");await context.request.put(`${origin}/api/svp/six-by-six/view-preferences`,{headers:{Origin:origin},data:adminOriginal});}
  await context.close();await browser.close();
}
