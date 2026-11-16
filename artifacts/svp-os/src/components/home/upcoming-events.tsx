import { useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, CalendarRange } from 'lucide-react';
import { ErrorPanel, Panel } from '@/components/ui-bits';
import { useMasterCalendar } from '@/lib/calendar-hooks';
import { DATE_STATUS, whenLabel } from '@/lib/calendar';
import { CAL_TZ, fmtDay, todayInZone } from '@/lib/calendar-time';
import { indexPrograms } from '@/lib/calendar-programs';
import { EventProgramMark, ProgramIndexContext } from '@/components/calendar/program-mark';
import { errorMessage } from '@/lib/format';
import { eventHref, ninetyDayWindow, upcomingEvents } from './dashboard-helpers';

export function UpcomingEventsPanel() {
  const q = useMasterCalendar();
  const tz = q.data?.timeZone || CAL_TZ;
  const today = todayInZone(tz);
  const idx = useMemo(() => indexPrograms(q.data?.programs), [q.data?.programs]);
  const list = useMemo(() => upcomingEvents(q.data?.events ?? [], today), [q.data?.events, today]);
  const { to } = ninetyDayWindow(today);
  let lastMonth = '';

  return (
    <Panel className="rise" data-testid="panel-upcoming-events">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><CalendarRange className="h-5 w-5 text-[#1D8BC4]" /><h2 className="font-display text-xl font-semibold text-[#0A2540]">Next 90 days</h2></div>
        <Link href="/calendar" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1D8BC4]" data-testid="link-full-calendar">Full calendar <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{fmtDay(today)} to {fmtDay(to, { month: 'short', day: 'numeric', year: 'numeric' })} · Pacific</div>
      {q.isLoading ? (
        <div className="mt-4 space-y-2" data-testid="loading-events">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-[#0A2540]/[0.05]" />)}</div>
      ) : q.isError || !q.data ? (
        <div className="mt-3"><ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div>
      ) : list.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="empty-events">Nothing dated on the calendar in the next 90 days.</p>
      ) : (
        <ProgramIndexContext.Provider value={idx}>
          <ol className="relative mt-4 border-l-2 border-[#1D8BC4]/20 pl-4">
            {list.map((e) => {
              const start = e.startDate!.slice(0, 10);
              const ongoing = start < today;
              const m = (ongoing ? today : start).slice(0, 7);
              const header = m !== lastMonth ? fmtDay(`${m}-01`, { month: 'long', year: 'numeric' }) : null;
              lastMonth = m;
              const proposed = e.dateStatus !== 'confirmed';
              return (
                <li key={e.id} className="relative">
                  {header && <div className="-ml-4 mb-1 mt-3 pl-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:mt-0">{header}</div>}
                  <span className={`absolute -left-[21px] top-3.5 h-2 w-2 rounded-full ring-2 ring-card ${proposed ? 'bg-[#ECA519]' : 'bg-[#1D8BC4]'}`} />
                  <Link href={eventHref(e, today)} className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#0A2540]/[0.03]" data-testid={`link-event-${e.id}`}>
                    <EventProgramMark e={e} size={22} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-[#0A2540] group-hover:text-[#1D8BC4]">{e.title}</div>
                      <div className="text-[11.5px] text-muted-foreground">{whenLabel(e, tz)}{ongoing ? ' · ongoing' : ''}</div>
                    </div>
                    {proposed && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${DATE_STATUS[e.dateStatus]?.cls ?? ''}`}>{DATE_STATUS[e.dateStatus]?.label ?? e.dateStatus}</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </ProgramIndexContext.Provider>
      )}
    </Panel>
  );
}
