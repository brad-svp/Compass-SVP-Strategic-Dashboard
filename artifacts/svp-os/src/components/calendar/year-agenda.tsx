import { CalendarX2, MapPin, Users } from 'lucide-react';
import type { CalendarEvent } from '@workspace/api-client-react';
import { MONTHS, fmtDay } from '@/lib/calendar-time';
import { LOCATION_STATUS, overlaps, programColor, sortEvents, spanOf, whenLabel } from '@/lib/calendar';
import { DateStatusBadge, ProgramTag } from './calendar-bits';
import { EventProgramMark } from './program-mark';

/** Day marker on the axis: the first day of the event visible in this month (continuations say so). */
function Marker({ e, monthFrom }: { e: CalendarEvent; monthFrom?: string }) {
  const s = spanOf(e);
  const c = programColor(e.program);
  const confirmed = e.dateStatus === 'confirmed';
  const day = s ? (monthFrom && s.start < monthFrom ? monthFrom : s.start) : null;
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
        {continued && 'Continues · '}{whenLabel(e)}
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

function MonthMarker({ label, count, tone = 'month' }: { label: string; count: number; tone?: 'month' | 'tbd' }) {
  return (
    <div className="relative z-10 flex items-center gap-3 pb-2 pt-6 first:pt-2">
      <span className="flex w-12 justify-center md:w-16">
        <span className={`h-3 w-3 rotate-45 ${tone === 'tbd' ? 'border-2 border-dashed border-[#ECA519] bg-[#FBFAF6]' : 'bg-[#0A2540]'}`} />
      </span>
      <span className={`font-display text-xl font-semibold ${tone === 'tbd' ? 'text-[#8A5A00]' : 'text-[#0A2540]'}`}>{label}</span>
      <span className="text-[12px] text-muted-foreground">{count} {count === 1 ? 'event' : 'events'}</span>
    </div>
  );
}

export function YearAgenda({ year, events, onOpen }: { year: number; events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void }) {
  const dated = sortEvents(events.filter((e) => spanOf(e)));
  const undated = sortEvents(events.filter((e) => !spanOf(e)));
  const months = MONTHS.map((name, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const from = `${year}-${mm}-01`;
    const to = `${year}-${mm}-${new Date(Date.UTC(year, i + 1, 0)).getUTCDate()}`;
    const list = dated.filter((e) => overlaps(e, from, to))
      .sort((a, b) => { const sa = spanOf(a)!.start, sb = spanOf(b)!.start; return (sa < from ? from : sa).localeCompare(sb < from ? from : sb); });
    return { name, from, list };
  }).filter((m) => m.list.length);

  if (!months.length && !undated.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center" data-testid="empty-year">
        <CalendarX2 className="h-7 w-7 text-[#1D8BC4]" />
        <div className="font-display text-xl font-semibold text-[#0A2540]">Nothing on the {year} timeline here.</div>
        <p className="text-sm text-muted-foreground">No events match this year and these filters.</p>
      </div>
    );
  }

  return (
    <div className="relative px-3 py-4 md:px-6" data-testid="view-year">
      <span aria-hidden className="absolute bottom-6 top-6 left-[calc(0.75rem+1.5rem-1px)] w-[2px] rounded bg-gradient-to-b from-[#0A2540]/25 via-[#0A2540]/12 to-[#0A2540]/5 md:left-[calc(1.5rem+2rem-1px)]" />
      <ol className="relative">
        {months.map((m) => (
          <li key={m.name} data-testid={`timeline-month-${m.from.slice(5, 7)}`}>
            <MonthMarker label={`${m.name} ${year}`} count={m.list.length} />
            <ul className="space-y-2.5">
              {m.list.map((e) => (
                <li key={e.id} className="flex gap-2 md:gap-3">
                  <Marker e={e} monthFrom={m.from} />
                  <Card e={e} onOpen={onOpen} continued={spanOf(e)!.start < m.from} />
                </li>
              ))}
            </ul>
          </li>
        ))}
        {undated.length > 0 && (
          <li data-testid="timeline-tbd">
            <MonthMarker label={`Date to be decided · ${year}`} count={undated.length} tone="tbd" />
            <p className="mb-2 ml-14 text-[12px] text-muted-foreground md:ml-[4.75rem]">Planned for {year} with no date yet. Nothing is placed on a guessed day.</p>
            <ul className="space-y-2.5">
              {undated.map((e) => (
                <li key={e.id} className="flex gap-2 md:gap-3">
                  <Marker e={e} />
                  <Card e={e} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </li>
        )}
      </ol>
    </div>
  );
}
