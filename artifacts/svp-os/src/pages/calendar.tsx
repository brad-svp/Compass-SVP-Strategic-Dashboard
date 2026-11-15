import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, GitCommitVertical, Rss } from 'lucide-react';
import type { CalendarEvent, Foundation, MasterCalendar } from '@workspace/api-client-react';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel } from '@/components/ui-bits';
import { NativeSelect } from '@/components/native-select';
import { useStaffSession } from '@/lib/session-context';
import { errorMessage } from '@/lib/format';
import { MONTHS, todayInZone } from '@/lib/calendar-time';
import { EMPTY_FILTERS, KNOWN_PROGRAMS, blankDraft, distinct, inYear, matches, overlaps, sortEvents, spanOf, type Filters } from '@/lib/calendar';
import { useCalendarActions, useMasterCalendar } from '@/lib/calendar-hooks';
import { FiltersBar } from '@/components/calendar/calendar-bits';
import { MonthView } from '@/components/calendar/month-view';
import { YearAgenda } from '@/components/calendar/year-agenda';
import { EventDialog, type EventTarget } from '@/components/calendar/event-dialog';
import { SubscribeDialog } from '@/components/calendar/subscribe-dialog';

const ghost = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-[#0A2540] transition-colors hover:bg-[#0A2540]/[0.04] disabled:opacity-40';

function CalendarBoard({ foundation, cal }: { foundation: Foundation; cal: MasterCalendar }) {
  const actor = useStaffSession();
  const isAdmin = actor.role === 'admin';
  const actions = useCalendarActions();
  const today = todayInZone(cal.timeZone);
  const thisYear = Number(today.slice(0, 4));

  const [view, setView] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [target, setTarget] = useState<EventTarget | null>(null);
  const [subOpen, setSubOpen] = useState(false);

  // Deep link (?event=&year=): honoured once per event id, only when that event exists, so polling never overrides navigation.
  const search = useSearch();
  const deepId = new URLSearchParams(search).get('event');
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!deepId || handled.current === deepId) return;
    const ev = cal.events.find((x) => x.id === deepId);
    if (!ev) return;
    handled.current = deepId;
    const s = spanOf(ev);
    const qy = Number(new URLSearchParams(search).get('year'));
    const y = s ? Number(s.start.slice(0, 4)) : ev.planningYear;
    setYear(Number.isInteger(qy) && qy >= 1900 && qy <= 9999 && inYear(ev, qy) ? qy : y);
    if (s) { setMonth(Number(s.start.slice(5, 7)) - 1); setView('month'); } else setView('year');
    setTarget({ event: ev, seed: blankDraft(y), editing: false, nonce: 0 });
  }, [deepId, cal.events, search]);

  const programs = useMemo(() => distinct([...KNOWN_PROGRAMS, ...cal.events.map((e) => e.program)]), [cal.events]);
  const audiences = useMemo(() => distinct(cal.events.flatMap((e) => e.audience)), [cal.events]);
  const years = useMemo(() => {
    const ys = new Set([2026, 2027, thisYear, thisYear + 1, thisYear + 2, year]);
    cal.events.forEach((e) => { const s = spanOf(e); if (s) { ys.add(Number(s.start.slice(0, 4))); ys.add(Number(s.end.slice(0, 4))); } else ys.add(e.planningYear); });
    return [...ys].filter((y) => y >= 1900 && y <= 9999).sort((a, b) => a - b);
  }, [cal.events, thisYear, year]);

  const filtered = useMemo(() => cal.events.filter((e) => matches(e, filters)), [cal.events, filters]);
  const yearEvents = filtered.filter((e) => inYear(e, year));
  const mm = String(month + 1).padStart(2, '0');
  const monthLast = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthEvents = filtered.filter((e) => overlaps(e, `${year}-${mm}-01`, `${year}-${mm}-${monthLast}`));
  const tbdThisYear = sortEvents(yearEvents.filter((e) => !spanOf(e)));
  const counts = { total: yearEvents.length, confirmed: yearEvents.filter((e) => e.dateStatus === 'confirmed').length, tentative: yearEvents.filter((e) => e.dateStatus === 'proposed' || e.dateStatus === 'tbd').length };

  const shiftMonth = (n: number) => { const m = month + n; setYear(year + Math.floor(m / 12)); setMonth(((m % 12) + 12) % 12); };
  const goToday = () => { setYear(thisYear); setMonth(Number(today.slice(5, 7)) - 1); };
  const open = (e: CalendarEvent) => setTarget({ event: e, seed: blankDraft(year), editing: false, nonce: 0 });
  const addNew = (day?: string) => setTarget({ event: null, seed: blankDraft(day ? Number(day.slice(0, 4)) : year, day), editing: true, nonce: 0 });
  const reopen = () => {
    if (!target?.event) return;
    const latest = cal.events.find((x) => x.id === target.event!.id);
    setTarget(latest ? { ...target, event: latest, nonce: target.nonce + 1 } : null);
  };

  return (
    <>
      <PageHeader eyebrow="Master calendar" title="Every SVP gathering, one calendar."
        actions={<>
          <button type="button" className={ghost} onClick={() => setSubOpen(true)} data-testid="button-subscribe"><Rss className="h-4 w-4" /> Subscribe</button>
          {isAdmin && <button type="button" onClick={() => addNew()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2540] px-3.5 text-[13px] font-semibold text-[#FBFAF6]" data-testid="button-new-event"><CalendarPlus className="h-4 w-4" /> New event</button>}
        </>}>
        Think Tanks, 100x, Fast Pitch, AI for Good, Impact Tours, Board and partner socials. Times are Sacramento time. Hatched means proposed, solid means confirmed.
      </PageHeader>

      {cal.sourceImport && <details className="mb-4 rounded-lg border border-[#ECA519]/35 bg-[#ECA519]/5 px-4 py-2 text-[12px] text-[#3A4E63]">
        <summary className="cursor-pointer font-medium">Notion import: {cal.sourceImport.year2026} events in 2026 · {cal.sourceImport.year2027} in 2027 · {cal.sourceImport.complete ? 'Complete archive' : 'Partial archive — review coverage'}</summary>
        <p className="mt-2 max-w-4xl">{cal.sourceImport.note}</p>
      </details>}
      <Panel className="rise mb-4 space-y-3 p-4 md:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="View">
            {(['month', 'year'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold ${view === v ? 'bg-[#0A2540] text-[#FBFAF6]' : 'text-[#3A4E63]'}`} data-testid={`button-view-${v}`}>
                {v === 'month' ? <CalendarDays className="h-4 w-4" /> : <GitCommitVertical className="h-4 w-4" />}{v === 'month' ? 'Month' : 'Timeline'}
              </button>
            ))}
          </div>
          <NativeSelect aria-label="Year" wrapClassName="w-28" value={String(year)} onChange={(e) => setYear(Number(e.target.value))} data-testid="select-year">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </NativeSelect>
          {view === 'month' && (<>
            <button type="button" className={ghost} onClick={() => shiftMonth(-1)} aria-label="Previous month" data-testid="button-month-back"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[9rem] text-center font-display text-lg font-semibold text-[#0A2540]" data-testid="text-month">{MONTHS[month]} {year}</span>
            <button type="button" className={ghost} onClick={() => shiftMonth(1)} aria-label="Next month" data-testid="button-month-next"><ChevronRight className="h-4 w-4" /></button>
          </>)}
          <button type="button" className={ghost} onClick={goToday} data-testid="button-today">Today</button>
          <span className="ml-auto text-[12px] text-muted-foreground" data-testid="text-year-counts">{year}: {counts.total} events · {counts.confirmed} confirmed · {counts.tentative} tentative</span>
        </div>
        <FiltersBar value={filters} onChange={setFilters} programs={programs} audiences={audiences} />
      </Panel>

      {cal.events.length === 0 ? (
        <Panel className="flex flex-col items-start gap-3 py-10" >
          <CalendarDays className="h-8 w-8 text-[#1D8BC4]" />
          <div className="font-display text-2xl font-semibold text-[#0A2540]">The master calendar is empty.</div>
          <p className="max-w-md text-sm text-muted-foreground">{isAdmin ? 'Import from Notion or add the first event.' : 'Events will appear here once an admin adds or imports them.'}</p>
          {isAdmin && <button type="button" onClick={() => addNew()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2540] px-3.5 text-[13px] font-semibold text-[#FBFAF6]" data-testid="button-first-event"><CalendarPlus className="h-4 w-4" /> Add first event</button>}
        </Panel>
      ) : (
        <Panel className="overflow-hidden p-0 md:p-0">
          {view === 'month'
            ? <MonthView year={year} month={month} events={monthEvents} today={today} onOpen={open} onAddOn={isAdmin ? addNew : undefined} />
            : <YearAgenda year={year} events={yearEvents} onOpen={open} />}
          {view === 'month' && tbdThisYear.length > 0 && (
            <div className="border-t border-border bg-[#ECA519]/[0.06] px-4 py-3" data-testid="list-month-tbd">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A5A00]">{year} events with no date yet</div>
              <div className="flex flex-wrap gap-1.5">
                {tbdThisYear.map((e) => (
                  <button key={e.id} type="button" onClick={() => open(e)} className="rounded-md border border-dashed border-[#ECA519]/60 bg-card px-2 py-1 text-[12px] font-semibold text-[#0A2540] hover:border-[#ECA519]" data-testid={`chip-tbd-${e.id}`}>
                    {e.title}{e.program && <span className="font-normal text-muted-foreground"> · {e.program}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      <EventDialog target={target} staff={foundation.staff} programs={programs} isAdmin={isAdmin} actions={actions}
        onClose={() => setTarget(null)} onEdit={() => target && setTarget({ ...target, event: cal.events.find((x) => x.id === target.event?.id) ?? target.event, editing: true, nonce: target.nonce + 1 })} onReopen={reopen} />
      <SubscribeDialog open={subOpen} onClose={() => setSubOpen(false)} hasSubscription={cal.hasSubscription} isPublished={cal.isPublished} actions={actions} />
    </>
  );
}

function CalendarData({ foundation }: { foundation: Foundation }) {
  const q = useMasterCalendar();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <CalendarBoard foundation={foundation} cal={q.data} />;
}

export default function CalendarPage() {
  return <WithFoundation>{(data) => <CalendarData foundation={data} />}</WithFoundation>;
}
