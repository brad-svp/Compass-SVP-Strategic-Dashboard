import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db, usersTable, auditLogTable, calendarEventsTable as events, calendarSubscriptionsTable as subscriptions } from "@workspace/db";
import { asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { AppError, requireAdmin, type StaffActor } from "./permissions";
import { CALENDAR_ZONE, calendarDate, isCalendarDate } from "./calendarDates";
import { renderCalendarIcs } from "./calendarIcs";
import { calendarImportInfo } from "./calendarImportInfo";
import { sql } from "drizzle-orm";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const date = z.string().refine(isCalendarDate, "Enter a valid YYYY-MM-DD date.").nullable();
const time = z.string().datetime({ offset: true }).nullable();
const input = z.object({
  title: z.string().trim().min(1).max(300), program: z.string().trim().max(120),
  planningYear: z.number().int().min(1900).max(9999), startDate: date, endDate: date,
  allDay: z.boolean(), startsAt: time, endsAt: time,
  location: z.string().trim().max(1000), dateStatus: z.enum(["proposed", "confirmed", "tbd", "cancelled"]),
  locationStatus: z.enum(["proposed", "confirmed", "tbd", "not_applicable"]),
  audience: z.array(z.string().trim().min(1).max(120)).max(30),
  wixUrl: z.string().trim().max(2000).refine(v => {
    if (!v) return true;
    try { return !/[\r\n]/.test(v) && ["http:", "https:"].includes(new URL(v).protocol); } catch { return false; }
  }, "Enter an HTTP or HTTPS event URL."),
  notes: z.string().max(16000), ownerId: z.string().min(1).nullable(), expectedVersion: z.number().int().min(0),
}).strict();
async function actorNow(tx: Tx, actor: StaffActor) {
  await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
  const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
  if (!current?.active) throw new AppError(403, "Your staff access is no longer available.");
  return current;
}
function versionMatches(expected: number, actual: number) {
  if (expected !== actual) throw new AppError(409, "This event changed while you were editing. Your draft was not saved. Reopen it to review the latest version.");
}
export function validateCalendarEvent(raw: unknown) {
  const data = input.parse(raw);
  if (data.startDate === null || data.endDate === null) {
    if (data.startDate !== null || data.endDate !== null || !data.allDay || data.startsAt || data.endsAt) throw new AppError(400, "An unscheduled event must have no dates or times.");
  } else {
    if (data.endDate < data.startDate) throw new AppError(400, "End date must be on or after start date.");
    if (Number(data.startDate.slice(0, 4)) !== data.planningYear) throw new AppError(400, "Planning year must match the start date.");
    if (data.allDay) {
      if (data.startsAt || data.endsAt) throw new AppError(400, "All-day events cannot have timed values.");
    } else {
      if (!data.startsAt || !data.endsAt) throw new AppError(400, "Enter both a start and end time.");
      const start = new Date(data.startsAt), end = new Date(data.endsAt);
      if (!(end > start)) throw new AppError(400, "End time must be after start time.");
      if (calendarDate(start) !== data.startDate || calendarDate(end) !== data.endDate) throw new AppError(400, "Dates and times must agree in America/Los_Angeles.");
    }
  }
  return data;
}
export async function saveCalendarEvent(actor: StaffActor, raw: unknown, id?: string) {
  const { expectedVersion, ...data } = validateCalendarEvent(raw);
  return db.transaction(async tx => {
    actor = await actorNow(tx, actor); requireAdmin(actor);
    const [before] = id ? await tx.select().from(events).where(eq(events.id, id)) : [];
    if (id && (!before || before.deletedAt)) throw new AppError(404, "Event not found.");
    versionMatches(expectedVersion, before?.version ?? 0);
    if (data.ownerId) {
      const [person] = await tx.select().from(usersTable).where(eq(usersTable.id, data.ownerId));
      if (!person || (!person.active && before?.ownerId !== person.id)) throw new AppError(400, "Choose an active owner.");
    }
    const entityId = id ?? randomUUID();
    const values = { ...data, startsAt: data.startsAt ? new Date(data.startsAt) : null, endsAt: data.endsAt ? new Date(data.endsAt) : null };
    const [after] = id
      ? await tx.update(events).set({ ...values, version: before!.version + 1, updatedAt: new Date() }).where(eq(events.id, id)).returning()
      : await tx.insert(events).values({ ...values, id: entityId }).returning();
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action: id ? "update" : "create", entityType: "calendar_event", entityId, before: before ?? null, after, via: "web" });
    return { id: entityId };
  });
}
export async function deleteCalendarEvent(actor: StaffActor, id: string, raw: unknown) {
  const { expectedVersion } = z.object({ expectedVersion: z.number().int().min(1) }).strict().parse(raw);
  return db.transaction(async tx => {
    actor = await actorNow(tx, actor); requireAdmin(actor);
    const [before] = await tx.select().from(events).where(eq(events.id, id));
    if (!before || before.deletedAt) throw new AppError(404, "Event not found.");
    versionMatches(expectedVersion, before.version);
    const [after] = await tx.update(events).set({ version: before.version + 1, deletedAt: new Date(), updatedAt: new Date() }).where(eq(events.id, id)).returning();
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action: "remove", entityType: "calendar_event", entityId: id, before, after, via: "web" });
    return { id };
  });
}
export async function getMasterCalendar(actor: StaffActor) {
  const [all, feeds] = await Promise.all([
    db.select().from(events).where(isNull(events.deletedAt)).orderBy(asc(events.startDate), asc(events.title)),
    db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.userId, actor.id)),
  ]);
  return {
    events: all.map(event => ({
      ...event, startsAt: event.startsAt?.toISOString() ?? null, endsAt: event.endsAt?.toISOString() ?? null,
      updatedAt: event.updatedAt.toISOString(), imported: !!event.sourceId, canEdit: actor.role === "admin", expectedVersion: event.version,
    })),
    timeZone: CALENDAR_ZONE, hasSubscription: !!feeds.length, isPublished: !!process.env.REPLIT_DEPLOYMENT, sourceImport: calendarImportInfo,
  };
}
const hash = (key: string) => createHash("sha256").update(key).digest("hex");
export function calendarSubscriberAllowed(userId: string, active: boolean, published = !!process.env.REPLIT_DEPLOYMENT) {
  // Development-only identities must not gain a production read capability
  // through a feed key if development data is copied into a first deployment.
  return active && !(published && (userId === "svp-dev-admin" || userId === "svp-dev-staff"));
}
export async function createCalendarSubscription(actor: StaffActor) {
  return db.transaction(async tx => {
    actor = await actorNow(tx, actor);
    const key = randomBytes(32).toString("base64url");
    const [before] = await tx.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.userId, actor.id));
    const id = before?.id ?? randomUUID();
    await tx.insert(subscriptions).values({ id, userId: actor.id, tokenHash: hash(key) })
      .onConflictDoUpdate({ target: subscriptions.userId, set: { tokenHash: hash(key), updatedAt: new Date() } });
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action: "create_subscription", entityType: "calendar_subscription", entityId: id, before: { enabled: !!before }, after: { enabled: true }, via: "web" });
    return { path: `/api/svp/calendar/feed.ics?key=${key}` };
  });
}
export async function revokeCalendarSubscription(actor: StaffActor) {
  return db.transaction(async tx => {
    actor = await actorNow(tx, actor);
    const [before] = await tx.delete(subscriptions).where(eq(subscriptions.userId, actor.id)).returning({ id: subscriptions.id });
    if (before) await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action: "revoke_subscription", entityType: "calendar_subscription", entityId: before.id, before: { enabled: true }, after: { enabled: false }, via: "web" });
    return { id: before?.id ?? actor.id };
  });
}
export async function getCalendarFeed(key: unknown) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(key)) throw new AppError(404, "Calendar feed not found.");
  const [subscription] = await db.select({ active: usersTable.active, userId: usersTable.id }).from(subscriptions)
    .innerJoin(usersTable, eq(usersTable.id, subscriptions.userId)).where(eq(subscriptions.tokenHash, hash(key)));
  if (!subscription || !calendarSubscriberAllowed(subscription.userId, subscription.active)) throw new AppError(404, "Calendar feed not found.");
  return renderCalendarIcs(await db.select().from(events).orderBy(asc(events.startDate), asc(events.id)));
}
