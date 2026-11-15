import { Router, type IRouter, type RequestHandler } from "express";
import {
  GetMasterCalendarResponse, CreateCalendarEventBody, CreateCalendarEventResponse,
  UpdateCalendarEventParams, UpdateCalendarEventBody, UpdateCalendarEventResponse,
  DeleteCalendarEventParams, DeleteCalendarEventBody, DeleteCalendarEventResponse,
  CreateCalendarSubscriptionResponse, RevokeCalendarSubscriptionResponse,
} from "@workspace/api-zod";
import { getMasterCalendar, saveCalendarEvent, deleteCalendarEvent, createCalendarSubscription, revokeCalendarSubscription, getCalendarFeed } from "../lib/calendarService";

export const calendarFeed: RequestHandler = async (req, res) => {
  const ics = await getCalendarFeed(req.query.key);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", 'inline; filename="svp-master-calendar.ics"');
  res.send(ics);
};
const router: IRouter = Router();
router.get("/calendar", async (_req, res) => res.json(GetMasterCalendarResponse.parse(await getMasterCalendar(res.locals.actor))));
router.post("/calendar/events", async (req, res) => {
  res.status(201).json(CreateCalendarEventResponse.parse(await saveCalendarEvent(res.locals.actor, CreateCalendarEventBody.strict().parse(req.body))));
});
router.patch("/calendar/events/:id", async (req, res) => {
  const { id } = UpdateCalendarEventParams.parse(req.params);
  res.json(UpdateCalendarEventResponse.parse(await saveCalendarEvent(res.locals.actor, UpdateCalendarEventBody.strict().parse(req.body), id)));
});
router.delete("/calendar/events/:id", async (req, res) => {
  const { id } = DeleteCalendarEventParams.parse(req.params);
  res.json(DeleteCalendarEventResponse.parse(await deleteCalendarEvent(res.locals.actor, id, DeleteCalendarEventBody.strict().parse(req.body))));
});
router.post("/calendar/subscription", async (_req, res) => {
  res.status(201).json(CreateCalendarSubscriptionResponse.parse(await createCalendarSubscription(res.locals.actor)));
});
router.delete("/calendar/subscription", async (_req, res) => {
  res.json(RevokeCalendarSubscriptionResponse.parse(await revokeCalendarSubscription(res.locals.actor)));
});
export default router;
