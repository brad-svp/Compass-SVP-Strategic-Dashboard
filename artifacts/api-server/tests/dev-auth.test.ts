import { test } from "node:test";
import assert from "node:assert/strict";
import { createDevCookie, devAuthEnabled, devCookie, readDevCookie } from "../src/lib/devAuth";
import { pool } from "@workspace/db";
import { after } from "node:test";

after(async () => { await pool.end(); });
const host = "test.replit.dev";
const req = { headers: { host } };
const env = { NODE_ENV: "development", REPLIT_DEV_DOMAIN: host };

test("quick login is allowed only on the exact development host", () => {
  assert.equal(devAuthEnabled(req, env), true);
  assert.equal(devAuthEnabled(req, { ...env, NODE_ENV: "production" }), false);
  assert.equal(devAuthEnabled(req, { ...env, REPLIT_DEPLOYMENT: "1" }), false);
  assert.equal(devAuthEnabled(req, { ...env, REPLIT_DEV_DOMAIN: "" }), false);
  assert.equal(devAuthEnabled({ headers: { host: "published.replit.app" } }, env), false);
  assert.equal(devAuthEnabled(req, { ...env, REPLIT_DEV_DOMAIN: "test.replit.app" }), false);
});

test("development cookies are signed, allowlisted and time limited", () => {
  const token = createDevCookie("svp-dev-staff");
  assert.equal(readDevCookie(`${devCookie}=${token}`), "svp-dev-staff");
  assert.equal(readDevCookie(`${devCookie}=${createDevCookie("svp-dev-admin")}`), "svp-dev-admin");
  assert.equal(readDevCookie(`${devCookie}=${createDevCookie("real-user")}`), null);
  assert.equal(readDevCookie(`${devCookie}=${token}tampered`), null);
  assert.equal(readDevCookie(`${devCookie}=malformed`), null);
  assert.equal(readDevCookie(undefined), null);
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 9 * 60 * 60 * 1000;
    assert.equal(readDevCookie(`${devCookie}=${token}`), null);
  } finally { Date.now = originalNow; }
});
