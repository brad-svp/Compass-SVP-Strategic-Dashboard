import { createHash, randomUUID } from "node:crypto";
import { db, calendarEventsTable, auditLogTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import source from "../data/notion-calendar-2026-2027.json";
import { validateCalendarEvent } from "./calendarService";
import { calendarImportInfo } from "./calendarImportInfo";
export function importedCalendarRows() {
  return source.records.map(record => {
    const startDate = record.start.slice(0, 10), endDate = (record.end ?? record.start).slice(0, 10);
    const sourceId = createHash("sha256").update(JSON.stringify([record.title, record.program, record.start, record.end])).digest("hex");
    const data = validateCalendarEvent({
      title: record.title, program: record.program ?? "", planningYear: Number(startDate.slice(0, 4)),
      startDate, endDate, allDay: record.allDay,
      startsAt: record.allDay ? null : new Date(record.start).toISOString(),
      endsAt: record.allDay ? null : new Date(record.end!).toISOString(),
      location: record.location ?? "", dateStatus: record.dateStatus?.toLowerCase() ?? "tbd",
      locationStatus: record.locationStatus?.toLowerCase() ?? "tbd", audience: [], wixUrl: "", ownerId: null,
      notes: "unmapped" in record ? `Source cell needs review: ${record.unmapped}` : "",
      expectedVersion: 0,
    });
    const { expectedVersion: _, ...fields } = data;
    return {
      ...fields, id: `notion-${sourceId}`, sourceId, sourceUrl: source.source, sourceData: record,
      startsAt: data.startsAt ? new Date(data.startsAt) : null, endsAt: data.endsAt ? new Date(data.endsAt) : null,
    };
  });
}
export async function seedCalendar() {
  const records = importedCalendarRows();
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    const added = await tx.insert(calendarEventsTable).values(records).onConflictDoNothing({ target: calendarEventsTable.sourceId }).returning({ id: calendarEventsTable.id });
    if (added.length) {
      await tx.insert(auditLogTable).values({
        id: randomUUID(), actorId: null, action: "import", entityType: "calendar_import", entityId: "notion-calendar-initial",
        before: null, after: { source: source.source, importedIds: added.map(r => r.id), coverage: calendarImportInfo }, via: "web",
      });
    }
    // Stable source identities prevent restarts from changing edits or
    // resurrecting removed events, including when the original had no row ID.
    return added.length;
  });
}
