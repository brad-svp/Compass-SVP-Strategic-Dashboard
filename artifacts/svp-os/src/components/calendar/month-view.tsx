import { MoveHorizontal } from 'lucide-react';
import type { CalendarEvent } from '@workspace/api-client-react';
import { monthWeeks, notesOn, timedOn, weekBars } from '@/lib/calendar';
import { MONTH_LANE, MonthEventBar, MonthEventCard, MonthNoteCard } from './month-event-card';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HEAD = 38; // day-number row height; bars start below it

export function MonthView({ year, month, events, today, onOpen, onAddOn }: {
  year: number; month: number; events: CalendarEvent[]; today: string;
  onOpen: (e: CalendarEvent) => void; onAddOn?: (day: string) => void;
}) {
  const weeks = monthWeeks(year, month);
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  return (
    <div data-testid="view-month">
      <p className="flex items-center gap-1.5 px-2 pb-2 text-[11.5px] text-muted-foreground lg:hidden" data-testid="text-month-scroll-hint">
        <MoveHorizontal className="h-3.5 w-3.5" /> Scroll sideways to see the full week
      </p>
      <div className="overflow-x-auto">
        <div className="min-w-[1050px]">
          <div className="grid grid-cols-7 border-b border-border">
            {DOW.map((d) => <div key={d} className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>)}
          </div>
          {weeks.map((week) => {
            const { bars, laneCount } = weekBars(week, events);
            const anyTimed = week.some((d) => timedOn(d, events).length > 0 || notesOn(d, events).length > 0);
            return (
              <div key={week[0]} className="relative grid grid-cols-7 border-b border-border last:border-b-0">
                {week.map((day, i) => {
                  const inMonth = day.slice(0, 7) === ym;
                  const timed = timedOn(day, events);
                  const notes = notesOn(day, events);
                  const numCls = `grid h-7 w-7 place-items-center rounded-full text-[13px] tabular-nums ${day === today ? 'bg-[#0A2540] font-semibold text-[#FBFAF6]' : inMonth ? 'font-medium text-[#0A2540]' : 'text-muted-foreground/60'}`;
                  return (
                    <div key={day} className={`${anyTimed || laneCount ? 'min-h-[8.5rem]' : 'min-h-[6.5rem]'} border-l border-border/70 px-2 pb-2.5 first:border-l-0 ${inMonth ? '' : 'bg-[#0A2540]/[0.025]'} ${i === 0 || i === 6 ? 'bg-[#F6F3EC]/50' : ''}`}
                      data-testid={`day-${day}`}>
                      <div className="flex items-center justify-between" style={{ height: HEAD }}>
                        {onAddOn ? (
                          <button type="button" onClick={() => onAddOn(day)} aria-label={`Add event on ${day}`}
                            className={`${numCls} hover:ring-1 hover:ring-[#1D8BC4]/50`} data-testid={`button-add-on-${day}`}>{Number(day.slice(8))}</button>
                        ) : (
                          <span className={numCls}>{Number(day.slice(8))}</span>
                        )}
                      </div>
                      <div style={{ height: laneCount * MONTH_LANE }} />
                      {notes.length > 0 && (
                        <div className={`${laneCount ? 'mt-1.5' : ''} space-y-1.5`}>
                          {notes.map((e) => <MonthNoteCard key={e.id} e={e} onOpen={onOpen} />)}
                        </div>
                      )}
                      {timed.length > 0 && (
                        <div className={`${laneCount || notes.length ? 'mt-1.5' : ''} space-y-1.5`}>
                          {timed.map((e) => <MonthEventCard key={e.id} e={e} onOpen={onOpen} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {bars.map((b) => (
                  <MonthEventBar key={`${b.event.id}-${week[0]}`} b={b} weekKey={week[0]} top={HEAD + b.lane * MONTH_LANE} onOpen={onOpen} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
