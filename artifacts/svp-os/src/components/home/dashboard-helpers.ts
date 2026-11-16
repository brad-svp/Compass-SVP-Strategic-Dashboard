import type { CalendarEvent, SixItem, SixPeriod } from '@workspace/api-client-react';
import { addDaysIso } from '@/lib/calendar-time';
import { overlaps, sortEvents, spanOf } from '@/lib/calendar';

/** The period whose civil dates cover `today`, or null. Never falls back to a past/future period. */
export function periodCovering(periods: SixPeriod[], today: string): SixPeriod | null {
  return periods.find((p) => p.startDate.slice(0, 10) <= today && today <= p.endDate.slice(0, 10)) ?? null;
}
export function myItemsIn(items: SixItem[], periodId: string, ownerId: string) {
  return items.filter((i) => i.periodId === periodId && i.ownerId === ownerId);
}
/** Window of 90 inclusive civil days starting today. */
export function ninetyDayWindow(today: string) { return { from: today, to: addDaysIso(today, 89) }; }
/** Dated, non-cancelled events overlapping the window (ongoing included), chronological. */
export function upcomingEvents(events: CalendarEvent[], today: string) {
  const { from, to } = ninetyDayWindow(today);
  return sortEvents(events.filter((e) => e.dateStatus !== 'cancelled' && !!spanOf(e) && overlaps(e, from, to)));
}
export function eventHref(e: CalendarEvent, today: string) {
  const s = spanOf(e);
  const year = s ? (s.start < today ? today : s.start).slice(0, 4) : String(e.planningYear);
  return `/calendar?event=${encodeURIComponent(e.id)}&year=${year}`;
}
