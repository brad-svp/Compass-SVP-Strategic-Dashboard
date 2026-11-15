import { Router, type IRouter } from "express";
import { CreateDevAuthBody, CreateDevAuthResponse, GetDevAuthResponse, DeleteDevAuthResponse } from "@workspace/api-zod";
import { createDevCookie, devAuthEnabled, devCookie, devCookieOptions, ensureDevActor, getDevActor } from "../lib/devAuth";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router: IRouter = Router();
router.use("/dev-auth", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!devAuthEnabled(req)) { res.sendStatus(404); return; }
  if (!["GET", "HEAD"].includes(req.method)) {
    let origin: URL;
    try { origin = new URL(req.get("origin") ?? ""); } catch { res.sendStatus(403); return; }
    if (origin.protocol !== "https:" || origin.host !== getClerkProxyHost(req)) { res.sendStatus(403); return; }
  }
  next();
});
router.get("/dev-auth", async (req, res) => {
  res.json(GetDevAuthResponse.parse({ enabled: true, signedIn: !!(await getDevActor(req)) }));
});
router.post("/dev-auth", async (req, res) => {
  const { role } = CreateDevAuthBody.strict().parse(req.body);
  const actor = await ensureDevActor(role);
  res.cookie(devCookie, createDevCookie(actor.id), devCookieOptions);
  res.json(CreateDevAuthResponse.parse({ id: actor.id }));
});
router.delete("/dev-auth", (_req, res) => {
  res.clearCookie(devCookie, { ...devCookieOptions, maxAge: undefined });
  res.json(DeleteDevAuthResponse.parse({ id: "signed-out" }));
});
export default router;
