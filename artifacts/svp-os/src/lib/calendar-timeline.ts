import type { CalendarEvent } from '@workspace/api-client-react';
import { planningMonthOf, sortEvents, spanOf } from './calendar';

export type TimelineMonth = { key: string; year: number; month: number; events: CalendarEvent[] };
export type Timeline = {
  past: TimelineMonth[];
  /** Started before today and still running through today. */
  ongoing: CalendarEvent[];
  upcoming: TimelineMonth[];
  undated: { year: number; events: CalendarEvent[] }[];
  total: number;
};

function byMonth(list: CalendarEvent[]): TimelineMonth[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of sortEvents(list)) {
    const s = spanOf(e);
    const key = s ? s.start.slice(0, 7) : `${e.planningYear}-${String(planningMonthOf(e)).padStart(2, '0')}`;
    const arr = map.get(key);
    if (arr) arr.push(e); else map.set(key, [e]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, events]) => ({ key, year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1, events }));
}

/**
 * Continuous cross-year chronology. Each dated event appears exactly once: past (ended before
 * today) and upcoming (starts today or later) by start month; ongoing multi-day events sit at the
 * today marker. Month-only (day TBD) events join their planning month; the current month counts as
 * upcoming, never past. Year-only undated events are never given a guessed date; they group by planning year.
 */
export function buildTimeline(events: CalendarEvent[], today: string): Timeline {
  const past: CalendarEvent[] = [], ongoing: CalendarEvent[] = [], upcoming: CalendarEvent[] = [], undated: CalendarEvent[] = [];
  const todayMonth = today.slice(0, 7);
  for (const e of events) {
    const s = spanOf(e);
    const pm = s ? null : planningMonthOf(e);
    if (pm) { (`${e.planningYear}-${String(pm).padStart(2, '0')}` < todayMonth ? past : upcoming).push(e); continue; }
    if (!s) undated.push(e);
    else if (s.end < today) past.push(e);
    else if (s.start < today) ongoing.push(e);
    else upcoming.push(e);
  }
  const uy = new Map<number, CalendarEvent[]>();
  for (const e of sortEvents(undated)) { const a = uy.get(e.planningYear); if (a) a.push(e); else uy.set(e.planningYear, [e]); }
  return {
    past: byMonth(past), ongoing: sortEvents(ongoing), upcoming: byMonth(upcoming),
    undated: [...uy.entries()].sort(([a], [b]) => a - b).map(([year, evs]) => ({ year, events: evs })),
    total: events.length,
  };
}

/** Scroll delta that brings `target` to `pad` px below the pane's top edge (bounding rects, no offsetParent). */
export function scrollDeltaTo(paneTop: number, targetTop: number, pad = 12) {
  return targetTop - paneTop - pad;
}
