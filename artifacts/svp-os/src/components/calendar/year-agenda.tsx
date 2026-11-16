import { Fragment, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { ArrowDown, ArrowUp, CalendarX2, MapPin, StickyNote, Users } from 'lucide-react';
import type { CalendarEvent } from '@workspace/api-client-react';
import { MONTHS, fmtDay } from '@/lib/calendar-time';
import { LOCATION_STATUS, NOTE_COLOR, isNote, programColor, spanOf, whenLabel } from '@/lib/calendar';
import { buildTimeline, scrollDeltaTo, type TimelineMonth } from '@/lib/calendar-timeline';
import { DateStatusBadge, ProgramTag } from './calendar-bits';
import { EventProgramMark } from './program-mark';

function Marker({ e, from }: { e: CalendarEvent; from?: string }) {
  const s = spanOf(e);
  const c = programColor(e.program);
  const confirmed = e.dateStatus === 'confirmed';
  const day = s ? (from && s.start < from ? from : s.start) : null;
  if (isNote(e)) {
    return (
      <div className="relative z-10 flex w-12 shrink-0 flex-col items-center pt-3 md:w-16">
        <span className="grid h-9 w-9 place-items-center rounded-md border-2 bg-[#E8F3F1] text-[13px] font-semibold tabular-nums text-[#1F5E5B] md:h-10 md:w-10" style={{ borderColor: NOTE_COLOR }}>
          {day ? Number(day.slice(8)) : '?'}
        </span>
        {day && <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{fmtDay(day, { weekday: 'short' })}</span>}
      </div>
    );
  }
  return (
    <div className="relative z-10 flex w-12 shrink-0 flex-col items-center pt-3 md:w-16">
      <span className={`grid h-9 w-9 place-items-center rounded-full border-2 text-[13px] font-semibold tabular-nums md:h-10 md:w-10 ${confirmed ? 'text-[#FBFAF6]' : 'border-dashed bg-[#FBFAF6] text-[#0A2540]'}`}
        style={confirmed ? { background: c, borderColor: c } : { borderColor: c }}>
        {day ? Number(day.slice(8)) : '?'}
      </span>
      {day && <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{fmtDay(day, { weekday: 'short' })}</span>}
    </div>
  );
}

function Card({ e, onOpen, continued }: { e: CalendarEvent; onOpen: (e: CalendarEvent) => void; continued?: boolean }) {
  const c = programColor(e.program);
  if (isNote(e)) {
    return (
      <button type="button" onClick={() => onOpen(e)}
        className="relative min-w-0 flex-1 rounded-xl border border-[#2E7D7A]/30 bg-[#E8F3F1] px-4 py-3 text-left transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2E7D7A]"
        data-testid={`row-note-${e.id}`}>
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: NOTE_COLOR }}><StickyNote className="h-3.5 w-3.5" /> Planning note</span>
        <span className="mt-1 block font-semibold leading-snug text-[#0A2540]">{e.title}</span>
        {e.notes && <span className="mt-1 block whitespace-pre-wrap text-[12.5px] text-[#3A4E63]">{e.notes}</span>}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span className="tabular-nums">{whenLabel(e).replace(' · all day', '')}</span>
          {e.program && <ProgramTag e={e} />}
        </span>
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(e)}
      className="group relative min-w-0 flex-1 rounded-xl border border-card-border bg-card px-4 py-3 text-left shadow-[0_1px_0_rgba(10,37,64,0.04)] transition-[transform,border-color] hover:-translate-y-px hover:border-[#1D8BC4]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D8BC4]"
      data-testid={`row-event-${e.id}`}>
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r" style={{ background: c, opacity: e.dateStatus === 'confirmed' ? 1 : 0.45 }} />
      <span className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-2.5">
          <EventProgramMark e={e} size={30} className="mt-0.5" testId={`logo-timeline-${e.id}`} />
          <span className={`min-w-0 font-semibold leading-snug text-[#0A2540] ${e.dateStatus === 'cancelled' ? 'line-through opacity-60' : ''}`}>{e.title}</span>
        </span>
        <DateStatusBadge status={e.dateStatus} />
      </span>
      <span className={`mt-1 block text-[12.5px] tabular-nums ${e.startDate ? 'text-[#3A4E63]' : 'italic text-muted-foreground'}`}>
        {continued && 'In progress · '}{whenLabel(e)}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
        <ProgramTag e={e} />
        {e.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{e.location}</span></span>}
        <span>{LOCATION_STATUS[e.locationStatus]}</span>
        {e.audience.length > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.audience.join(', ')}</span>}
      </span>
    </button>
  );
}

function MonthMarker({ label, count, tone = 'month', past }: { label: string; count: number; tone?: 'month' | 'tbd'; past?: boolean }) {
  return (
    <div className="relative z-10 flex items-center gap-3 pb-2 pt-6">
      <span className="flex w-12 justify-center md:w-16">
        <span className={`h-3 w-3 rotate-45 ${tone === 'tbd' ? 'border-2 border-dashed border-[#ECA519] bg-[#FBFAF6]' : past ? 'bg-[#0A2540]/40' : 'bg-[#0A2540]'}`} />
      </span>
      <span className={`font-display text-xl font-semibold ${tone === 'tbd' ? 'text-[#8A5A00]' : past ? 'text-[#0A2540]/65' : 'text-[#0A2540]'}`}>{label}</span>
      <span className="text-[12px] text-muted-foreground">{count} {count === 1 ? 'event' : 'events'}</span>
    </div>
  );
}

function YearRule({ year }: { year: number }) {
  return (
    <li className="relative z-10 mt-8 flex items-center gap-3 first:mt-2" data-testid={`timeline-year-${year}`} aria-label={`Year ${year}`}>
      <span className="w-12 md:w-16" />
      <span className="rounded-md bg-[#0A2540] px-2 py-0.5 font-mono text-[12px] font-medium tracking-wider text-[#FBFAF6]">{year}</span>
      <span className="h-px flex-1 bg-[#0A2540]/15" />
    </li>
  );
}

function MonthBlock({ m, onOpen, past, lastYear }: { m: TimelineMonth; onOpen: (e: CalendarEvent) => void; past?: boolean; lastYear: { v: number | null } }) {
  const showYear = lastYear.v !== m.year;
  lastYear.v = m.year;
  return (
    <Fragment>
      {showYear && <YearRule year={m.year} />}
      <li data-testid={`timeline-month-${m.key}`} className={past ? 'opacity-[0.88]' : undefined}>
        <MonthMarker label={`${MONTHS[m.month]} ${m.year}`} count={m.events.length} past={past} />
        <ul className="space-y-2.5">
          {m.events.map((e) => (
            <li key={e.id} className="flex gap-2 md:gap-3"><Marker e={e} /><Card e={e} onOpen={onOpen} /></li>
          ))}
        </ul>
      </li>
    </Fragment>
  );
}

const ctrl = 'inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[12px] font-semibold text-[#0A2540] hover:bg-[#0A2540]/[0.04]';

/**
 * Continuous timeline across every year of the given (already filtered) events. Opens at today
 * inside its own scroll pane. Re-anchors only when `anchorKey` or `todayNonce` changes, never on refetch.
 */
export function YearAgenda({ events, today, onOpen, anchorKey, todayNonce }: {
  events: CalendarEvent[]; today: string; onOpen: (e: CalendarEvent) => void; anchorKey: string; todayNonce: number;
}) {
  const t = useMemo(() => buildTimeline(events, today), [events, today]);
  const paneRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLLIElement>(null);

  const toToday = useCallback((smooth: boolean) => {
    const pane = paneRef.current, mark = todayRef.current;
    if (!pane || !mark) return;
    const d = scrollDeltaTo(pane.getBoundingClientRect().top, mark.getBoundingClientRect().top, 12);
    pane.scrollTo({ top: pane.scrollTop + d, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Anchor on mount, filter change; not on data refresh.
  useLayoutEffect(() => { toToday(false); }, [anchorKey, toToday]);
  const firstNonce = useRef(todayNonce);
  useLayoutEffect(() => { if (todayNonce !== firstNonce.current) toToday(true); }, [todayNonce, toToday]);

  const page = (dir: 1 | -1) => { const p = paneRef.current; if (p) p.scrollBy({ top: dir * p.clientHeight * 0.8, behavior: 'smooth' }); };

  if (!t.total) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center" data-testid="empty-year">
        <CalendarX2 className="h-7 w-7 text-[#1D8BC4]" />
        <div className="font-display text-xl font-semibold text-[#0A2540]">Nothing on the timeline here.</div>
        <p className="text-sm text-muted-foreground">No events in any year match these filters.</p>
      </div>
    );
  }

  const lastYear = { v: null as number | null };
  const todayYear = Number(today.slice(0, 4));
  const pastCount = t.past.reduce((n, m) => n + m.events.length, 0);
  const upCount = t.upcoming.reduce((n, m) => n + m.events.length, 0);

  return (
    <div data-testid="view-year">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-[#0A2540]/[0.025] px-3 py-2 md:px-6">
        <button type="button" className={ctrl} onClick={() => page(-1)} data-testid="button-timeline-earlier"><ArrowUp className="h-3.5 w-3.5" /> Earlier</button>
        <button type="button" className={ctrl} onClick={() => page(1)} data-testid="button-timeline-later"><ArrowDown className="h-3.5 w-3.5" /> Later</button>
        <span className="text-[12px] text-muted-foreground">Scroll up for older, down for newer · {pastCount} past · {t.ongoing.length} in progress · {upCount} upcoming</span>
      </div>
      <div ref={paneRef} tabIndex={0} role="region" aria-label="Event timeline, all years. Scroll up for older events, down for newer."
        className="relative max-h-[min(72vh,900px)] min-h-[360px] overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1D8BC4]"
        data-testid="pane-timeline">
        <div className="relative px-3 pb-[50vh] pt-4 md:px-6">
          <span aria-hidden className="absolute bottom-6 top-6 left-[calc(0.75rem+1.5rem-1px)] w-[2px] rounded bg-[#0A2540]/12 md:left-[calc(1.5rem+2rem-1px)]" />
          {pastCount === 0 && <p className="mb-2 ml-14 text-[12px] text-muted-foreground md:ml-[4.75rem]">No earlier events match these filters.</p>}
          <ol className="relative">
            {t.past.map((m) => <MonthBlock key={`p-${m.key}`} m={m} onOpen={onOpen} past lastYear={lastYear} />)}
            {lastYear.v !== todayYear && (() => { lastYear.v = todayYear; return <YearRule year={todayYear} />; })()}
            <li ref={todayRef} className="relative z-10 scroll-mt-3 pt-6" data-testid="timeline-today" aria-label={`Today, ${fmtDay(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}>
              <div className="flex items-center gap-3">
                <span className="flex w-12 justify-center md:w-16"><span className="h-3.5 w-3.5 rounded-full bg-[#B03E71] ring-4 ring-[#B03E71]/20" /></span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B03E71]">Today</span>
                <span className="text-[13px] font-semibold text-[#0A2540]">{fmtDay(today, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="h-px flex-1 bg-[#B03E71]/40" />
              </div>
              {t.ongoing.length > 0 && (
                <ul className="mt-2.5 space-y-2.5" data-testid="timeline-ongoing">
                  {t.ongoing.map((e) => (
                    <li key={e.id} className="flex gap-2 md:gap-3"><Marker e={e} from={today} /><Card e={e} onOpen={onOpen} continued /></li>
                  ))}
                </ul>
              )}
            </li>
            {t.upcoming.map((m) => <MonthBlock key={`u-${m.key}`} m={m} onOpen={onOpen} lastYear={lastYear} />)}
            {upCount === 0 && <li className="ml-14 pt-4 text-[12px] text-muted-foreground md:ml-[4.75rem]">No upcoming dated events match these filters.</li>}
            {t.undated.map((g) => (
              <li key={`tbd-${g.year}`} data-testid={`timeline-tbd-${g.year}`}>
                <MonthMarker label={`${g.year} · Month TBD`} count={g.events.length} tone="tbd" />
                <p className="mb-2 ml-14 text-[12px] text-muted-foreground md:ml-[4.75rem]">Planned for {g.year}; month and day not set yet. Nothing is placed on a guessed day.</p>
                <ul className="space-y-2.5">
                  {g.events.map((e) => <li key={e.id} className="flex gap-2 md:gap-3"><Marker e={e} /><Card e={e} onOpen={onOpen} /></li>)}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
