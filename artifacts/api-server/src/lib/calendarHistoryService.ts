import { db, auditLogTable, usersTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { AppError, type StaffActor } from "./permissions";

// Expose only calendar fields, never import payloads, subscription keys, or other audit domains.
const fields: Record<string, string> = {
  kind: "Entry type", title: "Title", program: "Program", planningYear: "Planning year", planningMonth: "Planning month",
  startDate: "Start date", endDate: "End date", allDay: "All day", startsAt: "Start time", endsAt: "End time",
  location: "Location", dateStatus: "Date status", locationStatus: "Venue status",
  audience: "Audience", notes: "Details", ownerId: "Owner",
};

export async function getCalendarHistory(actor: StaffActor, eventId?: string, offset = 0) {
  const [person] = await db.select({ active: usersTable.active }).from(usersTable).where(eq(usersTable.id, actor.id));
  if (!person?.active) throw new AppError(403, "Your staff access is no longer available.");
  const [rows, people] = await Promise.all([
    db.select({ audit: auditLogTable, actorName: usersTable.name }).from(auditLogTable)
      .leftJoin(usersTable, eq(usersTable.id, auditLogTable.actorId))
      .where(and(eq(auditLogTable.entityType, "calendar_event"), eventId ? eq(auditLogTable.entityId, eventId) : undefined))
      .orderBy(desc(auditLogTable.createdAt), desc(auditLogTable.id)).limit(51).offset(offset),
    db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable),
  ]);
  const names = new Map(people.map(p => [p.id, p.name]));
  const display = (key: string, value: unknown): string | null => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) return null;
    if (key === "ownerId") return names.get(String(value)) ?? String(value);
    if (key === "kind") return value === "planning_note" ? "Planning note" : "Event";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return Array.isArray(value) ? value.join(", ") : String(value);
  };
  return {
    hasMore: rows.length > 50,
    entries: rows.slice(0, 50).map(({ audit, actorName }) => {
      const before = (audit.before ?? {}) as Record<string, unknown>;
      const after = (audit.after ?? {}) as Record<string, unknown>;
      const removed = audit.action === "remove";
      return {
        id: audit.id, eventId: audit.entityId, title: String(after.title ?? before.title ?? "Calendar entry"),
        action: audit.action, actorName: actorName ?? "System / import", at: audit.createdAt.toISOString(),
        changes: Object.entries(fields).flatMap(([key, field]) => {
          const oldValue = display(key, before[key]), newValue = removed ? null : display(key, after[key]);
          return oldValue === newValue ? [] : [{ field, before: oldValue, after: newValue }];
        }),
      };
    }),
  };
}
