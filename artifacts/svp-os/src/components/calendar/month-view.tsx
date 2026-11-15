import type { CalendarEvent } from '@workspace/api-client-react';
import { fmtTime } from '@/lib/calendar-time';
import { monthWeeks, programColor, timedOn, weekBars } from '@/lib/calendar';
import { eventStyle } from './calendar-bits';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LANE = 22;

export function MonthView({ year, month, events, today, onOpen, onAddOn }: {
  year: number; month: number; events: CalendarEvent[]; today: string;
  onOpen: (e: CalendarEvent) => void; onAddOn?: (day: string) => void;
}) {
  const weeks = monthWeeks(year, month);
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  return (
    <div className="overflow-x-auto" data-testid="view-month">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-border">
          {DOW.map((d) => <div key={d} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>)}
        </div>
        {weeks.map((week) => {
          const { bars, laneCount } = weekBars(week, events);
          return (
            <div key={week[0]} className="relative grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((day, i) => {
                const inMonth = day.slice(0, 7) === ym;
                const timed = timedOn(day, events);
                return (
                  <div key={day} className={`min-h-[7.5rem] border-l border-border/70 px-1.5 pb-2 first:border-l-0 ${inMonth ? '' : 'bg-[#0A2540]/[0.025]'} ${i === 0 || i === 6 ? 'bg-[#F6F3EC]/50' : ''}`}
                    data-testid={`day-${day}`}>
                    <div className="flex items-center justify-between pt-1.5">
                      {onAddOn ? (
                        <button type="button" onClick={() => onAddOn(day)} aria-label={`Add event on ${day}`}
                          className={`grid h-6 w-6 place-items-center rounded-full text-[12px] tabular-nums hover:ring-1 hover:ring-[#1D8BC4]/50 ${day === today ? 'bg-[#0A2540] font-semibold text-[#FBFAF6]' : inMonth ? 'text-[#0A2540]' : 'text-muted-foreground/60'}`}
                          data-testid={`button-add-on-${day}`}>{Number(day.slice(8))}</button>
                      ) : (
                        <span className={`grid h-6 w-6 place-items-center rounded-full text-[12px] tabular-nums ${day === today ? 'bg-[#0A2540] font-semibold text-[#FBFAF6]' : inMonth ? 'text-[#0A2540]' : 'text-muted-foreground/60'}`}>{Number(day.slice(8))}</span>
                      )}
                    </div>
                    <div style={{ height: laneCount * LANE }} />
                    <div className="mt-1 space-y-0.5">
                      {timed.map((e) => (
                        <button key={e.id} type="button" onClick={() => onOpen(e)}
                          className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11.5px] hover:bg-[#0A2540]/[0.05] ${e.dateStatus === 'cancelled' ? 'line-through opacity-60' : ''}`}
                          data-testid={`event-timed-${e.id}`}>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${e.dateStatus === 'confirmed' ? '' : 'ring-1 ring-inset ring-current bg-transparent'}`}
                            style={e.dateStatus === 'confirmed' ? { background: programColor(e.program) } : { color: programColor(e.program) }} />
                          <span className="shrink-0 tabular-nums text-muted-foreground">{e.startsAt ? fmtTime(e.startsAt) : ''}</span>
                          <span className="truncate text-[#0A2540]">{e.title}</span>
                          {e.dateStatus !== 'confirmed' && e.dateStatus !== 'cancelled' && <span className="shrink-0 text-[10px] uppercase text-[#8A5A00]">tent.</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {bars.map((b) => (
                <button key={`${b.event.id}-${week[0]}`} type="button" onClick={() => onOpen(b.event)}
                  title={`${b.event.title}${b.event.dateStatus === 'confirmed' ? '' : ` (${b.event.dateStatus})`}`}
                  className={`absolute truncate border px-1.5 text-left text-[11.5px] font-semibold leading-[18px] transition-transform hover:-translate-y-px ${b.contLeft ? 'rounded-l-none border-l-0' : 'rounded-l-md'} ${b.contRight ? 'rounded-r-none border-r-0' : 'rounded-r-md'}`}
                  style={{ ...eventStyle(b.event), top: 32 + b.lane * LANE, left: `calc(${(b.col / 7) * 100}% + 3px)`, width: `calc(${(b.span / 7) * 100}% - 6px)`, height: 20 }}
                  data-testid={`event-bar-${b.event.id}`}>
                  {b.contLeft && '... '}{b.event.title}{b.event.dateStatus === 'proposed' && ' · proposed'}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
