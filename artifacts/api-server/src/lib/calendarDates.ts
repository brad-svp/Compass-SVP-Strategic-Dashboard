export const CALENDAR_ZONE = "America/Los_Angeles";
export function calendarDate(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: CALENDAR_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function isCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01";
}
export function nextCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
