import type { CalendarEvent, Cycle } from '@workspace/api-client-react';
import { isQuarter } from '@/lib/qbo';
import { overlaps, spanOf } from '@/lib/calendar';

export const EVENT_PRESETS = {
  registrations: { label: 'Registrations', unit: 'registrations' },
  attendance: { label: 'Attendance', unit: 'attendees' },
  revenue: { label: 'Event revenue', unit: 'USD' },
} as const;
export type EventPreset = keyof typeof EVENT_PRESETS;

/** "Fast Pitch 2026: Registrations", bounded to the 300-char KR title limit. */
export function presetTitle(preset: EventPreset, eventTitle: string) {
  const suffix = `: ${EVENT_PRESETS[preset].label}`;
  const room = 300 - suffix.length;
  const t = eventTitle.trim();
  return (t.length > room ? t.slice(0, room - 1).trimEnd() + '…' : t) + suffix;
}

/** Target must be explicit, finite and non-zero; we never invent one. */
export function targetError(target: string, start: string) {
  if (target.trim() === '') return 'Set a target; none is assumed.';
  const n = Number(target);
  if (!Number.isFinite(n)) return 'Target must be a number.';
  if (n === 0) return 'Target must not be zero.';
  if (!Number.isFinite(Number(start))) return 'Start must be a number.';
  return null;
}

function addMonths(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)).toISOString().slice(0, 10);
}
/** Calendar quarter (same month rule as the server) clipped to the cycle. Null when not derivable. */
export function quarterRange(cycle: Cycle | undefined, scope: string) {
  if (!cycle || !isQuarter(scope)) return null;
  const year = cycle.startDate.slice(0, 4);
  const qi = Number(scope[1]) - 1;
  const from = `${year}-${String(qi * 3 + 1).padStart(2, '0')}-01`;
  const to = new Date(Date.parse(addMonths(from, 3) + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
  const a = from < cycle.startDate ? cycle.startDate : from, b = to > cycle.endDate ? cycle.endDate : to;
  return a <= b ? { from: a, to: b } : null;
}

export function eventYear(e: Pick<CalendarEvent, 'startDate' | 'planningYear'>) {
  return e.startDate ? Number(e.startDate.slice(0, 4)) : e.planningYear;
}

/** Selectable: dated overlap with the quarter, or TBD in the cycle's year. Without a quarter, fall back to cycle span. */
export function isEligible(e: CalendarEvent, cycle: Cycle | undefined, scope: string) {
  if (e.kind === 'planning_note') return false;
  if (e.dateStatus === 'cancelled') return false;
  if (!cycle) return true;
  const range = quarterRange(cycle, scope) ?? { from: cycle.startDate, to: cycle.endDate };
  if (!spanOf(e)) return e.planningYear >= Number(cycle.startDate.slice(0, 4)) && e.planningYear <= Number(cycle.endDate.slice(0, 4));
  return overlaps(e, range.from, range.to);
}

export function calendarHref(e: Pick<CalendarEvent, 'id' | 'startDate' | 'planningYear'>) {
  return `/calendar?event=${encodeURIComponent(e.id)}&year=${eventYear(e)}`;
}
