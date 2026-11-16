import { Clock, MapPin, StickyNote } from 'lucide-react';
import type { CalendarEvent } from '@workspace/api-client-react';
import { fmtTime } from '@/lib/calendar-time';
import { DATE_STATUS, NOTE_COLOR, type Bar } from '@/lib/calendar';
import { eventStyle } from './calendar-bits';
import { EventProgramMark, useEventProgram } from './program-mark';

/** Height of one spanning-bar lane in the month grid (bar + gap). */
export const MONTH_LANE = 64;
const BAR_H = 58;

function StatusPill({ status, onSolid = false }: { status: string; onSolid?: boolean }) {
  const s = DATE_STATUS[status] ?? DATE_STATUS.tbd;
  if (onSolid) {
    return <span className="inline-flex shrink-0 items-center rounded-full bg-[#FBFAF6]/20 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[#FBFAF6] ring-1 ring-inset ring-[#FBFAF6]/40" data-testid={`badge-date-${status}`}>{s.label}</span>;
  }
  return <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${s.cls}`} data-testid={`badge-date-${status}`}>{s.label}</span>;
}

/** A timed, single-day event in a month cell: program, time, multi-line title, place, status. */
export function MonthEventCard({ e, onOpen }: { e: CalendarEvent; onOpen: (e: CalendarEvent) => void }) {
  const { name, color } = useEventProgram(e);
  const cancelled = e.dateStatus === 'cancelled';
  const confirmed = e.dateStatus === 'confirmed';
  const start = e.startsAt ? fmtTime(e.startsAt) : '';
  const end = e.endsAt ? fmtTime(e.endsAt) : '';
  return (
    <button type="button" onClick={() => onOpen(e)}
      className={`group relative w-full overflow-hidden rounded-lg border bg-[#FBFAF6] py-2 pl-3 pr-2 text-left shadow-[0_1px_2px_rgba(10,37,64,0.06)] transition-transform hover:-translate-y-px hover:shadow-[0_4px_12px_-4px_rgba(10,37,64,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D8BC4]/50 ${confirmed ? 'border-[#0A2540]/12' : 'border-dashed'} ${cancelled ? 'opacity-65' : ''}`}
      style={confirmed ? undefined : { borderColor: `${color}88`, background: cancelled ? '#FBFAF6' : `repeating-linear-gradient(135deg, ${color}12 0 6px, #FBFAF6 6px 12px)` }}
      data-testid={`event-timed-${e.id}`}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color, opacity: confirmed ? 1 : 0.5 }} />
      <div className="flex items-center gap-1.5 text-[11px] text-[#3A4E63]">
        <EventProgramMark e={e} size={18} testId={`logo-month-${e.id}`} />
        {name && <span className="min-w-0 truncate font-semibold" style={{ color }}>{name}</span>}
      </div>
      <div className={`mt-1 break-words text-[13px] font-semibold leading-snug text-[#0A2540] ${cancelled ? 'line-through' : ''}`} data-testid={`text-month-title-${e.id}`}>{e.title}</div>
      <div className="mt-1.5 space-y-0.5 text-[11.5px] leading-tight text-[#3A4E63]">
        <div className="flex items-start gap-1 tabular-nums">
          <Clock className="mt-px h-3 w-3 shrink-0" />
          <span>{start ? `${start}${end ? ` to ${end}` : ''}` : 'Time TBD'}</span>
        </div>
        {e.location && (
          <div className="flex items-start gap-1">
            <MapPin className="mt-px h-3 w-3 shrink-0" />
            <span className="break-words">{e.location}</span>
          </div>
        )}
      </div>
      {!confirmed && <div className="mt-1.5"><StatusPill status={e.dateStatus} /></div>}
    </button>
  );
}

/** All-day / multi-day spanning bar, two lines tall. Positioned absolutely by the caller's week row. */
export function MonthEventBar({ b, weekKey, top, onOpen }: { b: Bar; weekKey: string; top: number; onOpen: (e: CalendarEvent) => void }) {
  const e = b.event;
  const { name } = useEventProgram(e);
  const confirmed = e.dateStatus === 'confirmed';
  const meta = [b.span === 1 && !b.contLeft && !b.contRight ? 'All day' : null, name || null, e.location || null].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={() => onOpen(e)}
      title={`${e.title}${confirmed ? '' : ` (${DATE_STATUS[e.dateStatus]?.label ?? e.dateStatus})`}${e.location ? ` · ${e.location}` : ''}`}
      className={`absolute flex items-center gap-2 overflow-hidden border px-2 text-left transition-transform hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D8BC4]/50 ${b.contLeft ? 'rounded-l-none border-l-0' : 'rounded-l-lg'} ${b.contRight ? 'rounded-r-none border-r-0' : 'rounded-r-lg'}`}
      style={{ ...eventStyle(e), textDecoration: 'none', top, left: `calc(${(b.col / 7) * 100}% + 4px)`, width: `calc(${(b.span / 7) * 100}% - 8px)`, height: BAR_H }}
      data-testid={`event-bar-${e.id}`}>
      <EventProgramMark e={e} size={24} className="ring-1 ring-[#FBFAF6]/60" testId={`logo-bar-${e.id}-${weekKey}`} />
      <span className="min-w-0 flex-1">
        <span className={`line-clamp-2 text-[12.5px] font-semibold leading-tight ${e.dateStatus === 'cancelled' ? 'line-through' : ''}`}>
          {b.contLeft && '... '}{e.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-tight opacity-85">
          {!confirmed && <StatusPill status={e.dateStatus} onSolid={false} />}
          <span className="truncate">{meta}</span>
        </span>
      </span>
    </button>
  );
}

/** Planning note in a month cell: paper-slip look, teal fold, full title and body (no clamping). */
export function MonthNoteCard({ e, onOpen }: { e: CalendarEvent; onOpen: (e: CalendarEvent) => void }) {
  const { name, color } = useEventProgram(e);
  return (
    <button type="button" onClick={() => onOpen(e)}
      className="relative w-full overflow-hidden rounded-md border border-[#2E7D7A]/35 bg-[#E8F3F1] py-1.5 pl-2.5 pr-2 text-left transition-transform hover:-translate-y-px hover:shadow-[0_4px_12px_-4px_rgba(46,125,122,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D7A]/50"
      data-testid={`note-month-${e.id}`}>
      <span aria-hidden className="absolute right-0 top-0 h-3 w-3" style={{ background: `linear-gradient(225deg, #FBFAF6 50%, ${NOTE_COLOR}55 50%)` }} />
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: NOTE_COLOR }}>
        <StickyNote className="h-3 w-3 shrink-0" /> Planning note
      </div>
      <div className="mt-0.5 break-words text-[12.5px] font-semibold leading-snug text-[#0A2540]" data-testid={`text-note-title-${e.id}`}>{e.title}</div>
      {e.notes && <div className="mt-0.5 whitespace-pre-wrap break-words text-[11.5px] leading-snug text-[#3A4E63]">{e.notes}</div>}
      {name && <div className="mt-1 truncate text-[10.5px] font-semibold" style={{ color }}>{name}</div>}
    </button>
  );
}
