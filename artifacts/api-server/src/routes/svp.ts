import { Router, type IRouter } from "express";
import { db, usersTable, areasTable, cyclesTable, periodsTable, majorMomentsTable, auditLogTable } from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import {
  GetSessionResponse, GetFoundationResponse, CreateFoundationItemParams, CreateFoundationItemBody,
  CreateFoundationItemResponse, UpdateFoundationItemParams, UpdateFoundationItemBody, UpdateFoundationItemResponse,
} from "@workspace/api-zod";
import { staffAuth } from "../middlewares/staffAuth";
import { saveFoundation } from "../lib/foundationService";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import okrsRouter from "./okrs";
import accountabilityRouter from "./accountability";
import scorecardRouter from "./scorecard";
import sixBySixRouter from "./six-by-six";
import calendarRouter, { calendarFeed } from "./calendar";
import systemsRouter from "./systems";
import purposeRouter from "./purpose";
import calendarProgramsRouter from "./calendar-programs";
import brainRouter from "./brain";

const router: IRouter = Router();
// Google Calendar cannot present a staff session. This exact read-only route
// instead requires a revocable, high-entropy URL key tied to active staff.
router.get("/svp/calendar/feed.ics", calendarFeed);
router.use("/svp", staffAuth);
router.use("/svp", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    // Browser writes must be same-origin; non-browser MCP will use its own authenticated transport.
    if (!origin || (() => { try { return new URL(origin).host !== getClerkProxyHost(req); } catch { return true; } })()) {
      res.status(403).json({ error: "This request must come from SVP OS." }); return;
    }
  }
  next();
});
router.get("/svp/session", (_req, res) => {
  res.json(GetSessionResponse.parse(res.locals.actor));
});
router.use("/svp", okrsRouter);
router.use("/svp", accountabilityRouter);
router.use("/svp", scorecardRouter);
router.use("/svp", sixBySixRouter);
router.use("/svp", calendarRouter);
router.use("/svp", systemsRouter);
router.use("/svp", purposeRouter);
router.use("/svp", calendarProgramsRouter);
router.use("/svp", brainRouter);
router.get("/svp/foundation", async (_req, res): Promise<void> => {
  const [staff, areas, cycles, periods, moments] = await Promise.all([
    db.select().from(usersTable).orderBy(asc(usersTable.createdAt), asc(usersTable.name)),
    db.select().from(areasTable).orderBy(asc(areasTable.sortOrder)),
    db.select().from(cyclesTable).orderBy(desc(cyclesTable.startDate)),
    db.select().from(periodsTable).orderBy(asc(periodsTable.startDate)),
    db.select().from(majorMomentsTable).orderBy(asc(majorMomentsTable.position)),
  ]);
  const activity = res.locals.actor.role === "admin" ? await db.select({
    id: auditLogTable.id, actorName: usersTable.name, action: auditLogTable.action,
    entityType: auditLogTable.entityType, entityId: auditLogTable.entityId,
    createdAt: auditLogTable.createdAt, via: auditLogTable.via,
  }).from(auditLogTable).leftJoin(usersTable, eq(auditLogTable.actorId, usersTable.id)).orderBy(desc(auditLogTable.createdAt)).limit(50) : [];
  res.json(GetFoundationResponse.parse({
    staff, areas, cycles,
    periods: periods.map((period) => ({ ...period, moments: moments.filter((m) => m.periodId === period.id) })),
    activity: activity.map((a) => ({ ...a, actorName: a.actorName ?? "Initial setup", createdAt: a.createdAt.toISOString() })),
  }));
});
router.post("/svp/admin/:collection", async (req, res): Promise<void> => {
  const params = CreateFoundationItemParams.parse(req.params);
  const input = CreateFoundationItemBody.parse(req.body);
  const result = await saveFoundation(res.locals.actor, params.collection, input);
  res.status(201).json(CreateFoundationItemResponse.parse(result));
});
router.patch("/svp/admin/:collection/:id", async (req, res): Promise<void> => {
  const params = UpdateFoundationItemParams.parse(req.params);
  const input = UpdateFoundationItemBody.parse(req.body);
  const result = await saveFoundation(res.locals.actor, params.collection, input, params.id);
  res.json(UpdateFoundationItemResponse.parse(result));
});
export default router;
