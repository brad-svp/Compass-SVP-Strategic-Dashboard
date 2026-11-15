import type { calendarEventsTable } from "@workspace/db";
import { nextCalendarDate } from "./calendarDates";
type Event = typeof calendarEventsTable.$inferSelect;
const text = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const instant = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const day = (date: string) => date.replaceAll("-", "");
// RFC 5545 folding is measured in UTF-8 octets, not JS string length.
export function foldIcsLine(line: string) {
  const lines: string[] = []; let part = "";
  for (const character of line) {
    if (Buffer.byteLength(part + character, "utf8") > 75) { lines.push(part); part = " "; }
    part += character;
  }
  lines.push(part);
  return lines.join("\r\n");
}
export function renderCalendarIcs(events: Event[]) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SVP OS//Master Calendar//EN", "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH", "X-WR-CALNAME:SVP Master Calendar", "X-WR-TIMEZONE:America/Los_Angeles",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of events) {
    if (!event.startDate || !event.endDate) continue; // Unscheduled events cannot have invented dates.
    const cancelled = !!event.deletedAt || event.dateStatus === "cancelled";
    lines.push("BEGIN:VEVENT", `UID:${event.id}@svp-os`, `SEQUENCE:${event.version}`,
      `DTSTAMP:${instant(event.updatedAt)}`, `CREATED:${instant(event.createdAt)}`, `LAST-MODIFIED:${instant(event.updatedAt)}`);
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${day(event.startDate)}`, `DTEND;VALUE=DATE:${day(nextCalendarDate(event.endDate))}`);
    } else if (event.startsAt && event.endsAt) {
      lines.push(`DTSTART:${instant(event.startsAt)}`, `DTEND:${instant(event.endsAt)}`);
    } else { lines.push("END:VEVENT"); continue; }
    const tentative = event.dateStatus !== "confirmed" && !cancelled;
    lines.push(`SUMMARY:${text(event.deletedAt ? "Cancelled event" : `${tentative ? "[Proposed] " : ""}${event.title}`)}`,
      `STATUS:${cancelled ? "CANCELLED" : tentative ? "TENTATIVE" : "CONFIRMED"}`);
    if (!event.deletedAt) {
      lines.push(`CATEGORIES:${text(event.program)}`, `LOCATION:${text(event.location)}`,
        `DESCRIPTION:${text([
          event.notes, `Date: ${event.dateStatus}`, `Location: ${event.locationStatus}`,
          event.audience.length ? `Audience: ${event.audience.join(", ")}` : "",
          event.wixUrl, event.sourceUrl ? `Source: ${event.sourceUrl}` : "",
        ].filter(Boolean).join("\n\n"))}`);
      if (event.wixUrl) lines.push(`URL:${event.wixUrl}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
