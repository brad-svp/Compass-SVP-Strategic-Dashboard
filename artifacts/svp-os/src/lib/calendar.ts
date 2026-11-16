import type { CalendarEvent, CalendarEventInput, CalendarEventInputDateStatus, CalendarEventInputKind, CalendarEventInputLocationStatus } from '@workspace/api-client-react';
import { CAL_TZ, MONTHS, addDaysIso, dayOfWeek, fmtDay, fmtTime, isValidIsoDate, utcToZoned, zonedToUtc } from './calendar-time';

export const DATE_STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-[#49B949]/14 text-[#22702A] ring-[#49B949]/40' },
  proposed: { label: 'Proposed', cls: 'bg-[#ECA519]/15 text-[#8A5A00] ring-[#ECA519]/45' },
  tbd: { label: 'Date TBD', cls: 'bg-[#0A2540]/[0.05] text-[#3A4E63] ring-[#0A2540]/20' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#B03E71]/10 text-[#8E2D58] ring-[#B03E71]/30' },
};
export const LOCATION_STATUS: Record<string, string> = {
  confirmed: 'Venue confirmed', proposed: 'Venue proposed', tbd: 'Venue TBD', not_applicable: 'No venue',
};
/** Colour order only (keeps historic program colours stable); not a program list. */
const COLOR_ORDER = ['Think Tank', '100x', 'Fast Pitch', 'AI for Good', 'Impact Tours', 'Board', 'Partner Social', 'Other'];
const PALETTE = ['#1D8BC4', '#B03E71', '#49B949', '#ECA519', '#0A2540', '#2E7D7A', '#7A5BA6', '#C2602F'];

export function programColor(program: string) {
  const i = COLOR_ORDER.findIndex((p) => p.toLowerCase() === program.trim().toLowerCase());
  if (i >= 0) return PALETTE[i % PALETTE.length];
  let h = 0;
  for (const c of program) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/* ---------- spans & filtering ---------- */

/** Planning notes are date-specific reminders (kind=planning_note); missing kind means a normal event. */
export function isNote(e: Pick<CalendarEvent, 'kind'>) { return e.kind === 'planning_note'; }
export const NOTE_COLOR = '#2E7D7A';

export function isUndated(e: Pick<CalendarEvent, 'startDate' | 'endDate'>) { return !e.startDate; }
/** Inclusive civil-date span, or null for TBD. */
export function spanOf(e: Pick<CalendarEvent, 'startDate' | 'endDate'>) {
  if (!e.startDate) return null;
  const end = e.endDate && e.endDate >= e.startDate ? e.endDate : e.startDate;
  return { start: e.startDate.slice(0, 10), end: end.slice(0, 10) };
}
/** Known planning month (1..12) for an undated event, else null. Dated events never use it. */
export function planningMonthOf(e: Pick<CalendarEvent, 'startDate' | 'planningMonth'>) {
  const m = e.startDate ? null : e.planningMonth;
  return typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
}
export function overlaps(e: Pick<CalendarEvent, 'startDate' | 'endDate'>, from: string, to: string) {
  const s = spanOf(e);
  return !!s && s.start <= to && s.end >= from;
}
/** Dated: any overlap with the year (cross-year shows in both). Undated: its planning year. */
export function inYear(e: Pick<CalendarEvent, 'startDate' | 'endDate' | 'planningYear'>, year: number) {
  return isUndated(e) ? e.planningYear === year : overlaps(e, `${year}-01-01`, `${year}-12-31`);
}

export type Filters = { program: string; dateStatus: string; audience: string; q: string };
export const EMPTY_FILTERS: Filters = { program: '', dateStatus: '', audience: '', q: '' };
export function matches(e: CalendarEvent, f: Filters) {
  if (f.program && e.program !== f.program) return false;
  if (f.dateStatus && e.dateStatus !== f.dateStatus) return false;
  if (f.audience && !e.audience.includes(f.audience)) return false;
  const q = f.q.trim().toLowerCase();
  if (q && ![e.title, e.program, e.location, e.notes, ...e.audience].some((x) => x.toLowerCase().includes(q))) return false;
  return true;
}
export function sortEvents(list: CalendarEvent[]) {
  return [...list].sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999')
    || (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || (a.startsAt ?? '').localeCompare(b.startsAt ?? '') || a.title.localeCompare(b.title));
}
export function distinct(list: string[]) { return [...new Set(list.map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }

/* ---------- month grid ---------- */

export function monthWeeks(year: number, month: number) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  let cur = addDaysIso(first, -dayOfWeek(first));
  const weeks: string[][] = [];
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysIso(cur, i)));
    cur = addDaysIso(cur, 7);
  } while (cur.slice(0, 7) === first.slice(0, 7));
  return weeks;
}

export type Bar = { event: CalendarEvent; col: number; span: number; lane: number; contLeft: boolean; contRight: boolean };
/** Lay out all-day/multi-day events as bars within one week; timed single-day events are excluded. */
export function weekBars(week: string[], events: CalendarEvent[]) {
  const from = week[0], to = week[6];
  const bars: Bar[] = [];
  const lanes: string[][] = [];
  const multi = sortEvents(events.filter((e) => !isNote(e) && (e.allDay || spanOf(e)!.start !== spanOf(e)!.end) && overlaps(e, from, to)));
  for (const e of multi) {
    const s = spanOf(e)!;
    const a = s.start < from ? from : s.start, b = s.end > to ? to : s.end;
    const col = week.indexOf(a), end = week.indexOf(b);
    let lane = lanes.findIndex((used) => week.slice(col, end + 1).every((d) => !used.includes(d)));
    if (lane < 0) { lane = lanes.length; lanes.push([]); }
    lanes[lane].push(...week.slice(col, end + 1));
    bars.push({ event: e, col, span: end - col + 1, lane, contLeft: s.start < from, contRight: s.end > to });
  }
  return { bars, laneCount: lanes.length };
}
/** Planning notes placed on their single day (shown as in-cell cards, never as bars). */
export function notesOn(day: string, events: CalendarEvent[]) {
  return sortEvents(events.filter((e) => isNote(e) && spanOf(e)?.start === day));
}
export function timedOn(day: string, events: CalendarEvent[]) {
  return sortEvents(events.filter((e) => !isNote(e) && !e.allDay && spanOf(e)?.start === day && spanOf(e)?.end === day));
}

/* ---------- labels ---------- */

export function whenLabel(e: CalendarEvent, tz = CAL_TZ) {
  const s = spanOf(e);
  if (!s) { const m = planningMonthOf(e); return m ? `${MONTHS[m - 1]} ${e.planningYear} · Day TBD` : `Date TBD · ${e.planningYear}`; }
  const sameYear = s.start.slice(0, 4) === s.end.slice(0, 4);
  const d1 = fmtDay(s.start, { weekday: 'short', month: 'short', day: 'numeric', year: sameYear && s.start === s.end ? 'numeric' : sameYear ? undefined : 'numeric' });
  if (e.allDay) {
    if (s.start === s.end) return `${d1} · all day`;
    return `${d1} to ${fmtDay(s.end, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · all day`;
  }
  const t1 = e.startsAt ? fmtTime(e.startsAt, tz) : '';
  const t2 = e.endsAt ? fmtTime(e.endsAt, tz) : '';
  if (s.start === s.end) return `${d1} · ${t1} to ${t2} PT`;
  return `${d1} ${t1} to ${fmtDay(s.end, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} ${t2} PT`;
}
export function isTentative(e: CalendarEvent) { return e.dateStatus === 'proposed' || e.dateStatus === 'tbd'; }

/* ---------- form draft <-> input ---------- */

export type DateMode = 'allday' | 'timed' | 'tbd';
export type EventDraft = {
  title: string; program: string; planningYear: string; planningMonth: string; mode: DateMode;
  startDate: string; endDate: string; startTime: string; endTime: string;
  location: string; dateStatus: CalendarEventInputDateStatus; locationStatus: CalendarEventInputLocationStatus;
  audience: string; wixUrl: string; notes: string; ownerId: string;
  kind?: CalendarEventInputKind;
};

export function blankDraft(year: number, day?: string, kind?: CalendarEventInputKind): EventDraft {
  if (kind === 'planning_note') {
    return { title: '', program: '', planningYear: String(year), planningMonth: '', mode: 'allday', startDate: day ?? '', endDate: day ?? '',
      startTime: '09:00', endTime: '10:00', location: '', dateStatus: 'confirmed', locationStatus: 'not_applicable', audience: '', wixUrl: '', notes: '', ownerId: '', kind };
  }
  return { kind, title: '', program: '', planningYear: String(year), planningMonth: '', mode: day ? 'allday' : 'tbd', startDate: day ?? '', endDate: day ?? '',
    startTime: '09:00', endTime: '10:00', location: '', dateStatus: 'proposed', locationStatus: 'tbd', audience: '', wixUrl: '', notes: '', ownerId: '' };
}
export function eventToDraft(e: CalendarEvent, tz = CAL_TZ): EventDraft {
  const mode: DateMode = !e.startDate ? 'tbd' : e.allDay ? 'allday' : 'timed';
  return {
    title: e.title, program: e.program, planningYear: String(e.planningYear), planningMonth: planningMonthOf(e) ? String(planningMonthOf(e)) : '', mode,
    startDate: e.startDate?.slice(0, 10) ?? '', endDate: (e.endDate ?? e.startDate)?.slice(0, 10) ?? '',
    startTime: e.startsAt ? utcToZoned(Date.parse(e.startsAt), tz).time : '09:00',
    endTime: e.endsAt ? utcToZoned(Date.parse(e.endsAt), tz).time : '10:00',
    location: e.location, dateStatus: e.dateStatus, locationStatus: e.locationStatus,
    audience: e.audience.join(', '), wixUrl: e.wixUrl, notes: e.notes, ownerId: e.ownerId ?? '',
    kind: e.kind ?? undefined,
  };
}
export function parseAudience(s: string) { return distinct(s.split(/[,\n]/)); }
export function isHttpUrl(s: string) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

export type BuildResult = { ok: true; input: CalendarEventInput; notice: string | null } | { ok: false; error: string };
export function buildInput(d: EventDraft, expectedVersion: number, tz = CAL_TZ): BuildResult {
  const title = d.title.trim();
  if (!title) return { ok: false, error: 'Add a title.' };
  if (d.kind === 'planning_note') {
    if (!isValidIsoDate(d.startDate)) return { ok: false, error: 'Pick the date this note belongs to (years 1900 to 9999).' };
    return { ok: true, notice: null, input: { title, kind: 'planning_note', program: d.program.trim(), location: '', dateStatus: d.dateStatus, locationStatus: 'not_applicable',
      audience: [], wixUrl: '', notes: d.notes, ownerId: d.ownerId || null, expectedVersion, planningYear: Number(d.startDate.slice(0, 4)), planningMonth: null,
      startDate: d.startDate, endDate: d.startDate, allDay: true, startsAt: null, endsAt: null } };
  }
  if (d.wixUrl.trim() && !isHttpUrl(d.wixUrl.trim())) return { ok: false, error: 'Wix URL must start with http:// or https://.' };
  const audience = parseAudience(d.audience);
  const base = { title, program: d.program.trim(), location: d.location.trim(), dateStatus: d.dateStatus, locationStatus: d.locationStatus,
    audience, wixUrl: d.wixUrl.trim(), notes: d.notes, ownerId: d.ownerId || null, expectedVersion, ...(d.kind ? { kind: d.kind } : {}) };
  if (d.mode === 'tbd') {
    const y = Number(d.planningYear);
    if (!Number.isInteger(y) || y < 1900 || y > 9999) return { ok: false, error: 'Planning year must be between 1900 and 9999.' };
    const pm = d.planningMonth ? Number(d.planningMonth) : null;
    if (pm !== null && (!Number.isInteger(pm) || pm < 1 || pm > 12)) return { ok: false, error: 'Planning month must be January to December, or Month TBD.' };
    return { ok: true, notice: null, input: { ...base, planningYear: y, planningMonth: pm, startDate: null, endDate: null, allDay: true, startsAt: null, endsAt: null } };
  }
  if (!isValidIsoDate(d.startDate)) return { ok: false, error: 'Pick a valid start date (years 1900 to 9999).' };
  if (!isValidIsoDate(d.endDate)) return { ok: false, error: 'Pick a valid end date (years 1900 to 9999).' };
  if (d.endDate < d.startDate) return { ok: false, error: 'End date cannot be before the start date.' };
  const planningYear = Number(d.startDate.slice(0, 4));
  if (d.mode === 'allday') {
    return { ok: true, notice: null, input: { ...base, planningYear, planningMonth: null, startDate: d.startDate, endDate: d.endDate, allDay: true, startsAt: null, endsAt: null } };
  }
  const a = zonedToUtc(d.startDate, d.startTime, tz), b = zonedToUtc(d.endDate, d.endTime, tz);
  for (const [r, w] of [[a, 'Start'], [b, 'End']] as const) {
    if (!r.ok) return { ok: false, error: r.reason === 'nonexistent' ? `${w} time does not exist in Sacramento (clocks spring forward). Choose another time.` : `${w} time is not valid.` };
  }
  if (!a.ok || !b.ok) return { ok: false, error: 'Invalid time.' };
  if (Date.parse(b.iso) <= Date.parse(a.iso)) return { ok: false, error: 'End must be after the start.' };
  const notice = a.ambiguous || b.ambiguous ? 'That time happens twice when clocks fall back; the earlier (daylight time) occurrence is used.' : null;
  return { ok: true, notice, input: { ...base, planningYear, planningMonth: null, startDate: d.startDate, endDate: d.endDate, allDay: false, startsAt: a.iso, endsAt: b.iso } };
}
