import type { ReactNode } from 'react';
import { CalendarClock, ChevronDown, Pencil, Plus } from 'lucide-react';
import type { SixItem, SixPeriod } from '@workspace/api-client-react';
import { StatusPill } from '@/components/ui-bits';
import { fmtDate } from '@/lib/format';
import { summarize } from '@/lib/six-by-six';

export type Slot = 'previous' | 'viewing' | 'next';
const SLOT_LABEL: Record<Slot, string> = { previous: 'Previous', viewing: 'Viewing', next: 'Next' };

export function PeriodAccordion({ slot, period, items, open, onToggle, isActual, isAdmin, onEdit, children }: {
  slot: Slot; period: SixPeriod; items: SixItem[]; open: boolean; onToggle: () => void; isActual: boolean; isAdmin: boolean; onEdit: () => void; children: ReactNode;
}) {
  const sum = summarize(items);
  const pct = sum.total ? Math.round((sum.done / sum.total) * 1000) / 10 : 0;
  const bodyId = `six-body-${period.id}`;
  const status = period.status === 'draft' ? 'planning' : period.status;
  return (
    <section className={`overflow-hidden rounded-2xl border bg-card transition-shadow ${slot === 'viewing' ? 'border-[#0A2540]/25 shadow-[0_10px_30px_-18px_rgba(10,37,64,0.35)]' : 'border-card-border'}`}
      data-testid={`accordion-${slot}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 md:px-5">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid={`button-toggle-${slot}`}>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#3A4E63] transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
          <span className={`w-[4.5rem] shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.18em] ${slot === 'viewing' ? 'text-[#1D8BC4]' : 'text-muted-foreground'}`}>{SLOT_LABEL[slot]}</span>
          <span className="min-w-0">
            <span className={`block truncate font-display font-semibold text-[#0A2540] ${slot === 'viewing' ? 'text-xl' : 'text-[17px]'}`} data-testid={`text-period-name-${slot}`}>{period.name}</span>
            <span className="block text-[12.5px] text-muted-foreground">{fmtDate(period.startDate)} to {fmtDate(period.endDate)}{period.meetingDate ? ` · Meeting ${fmtDate(period.meetingDate)}` : ''}</span>
          </span>
        </button>
        <div className="flex items-center gap-3">
          {isActual && <span className="inline-flex items-center gap-1 rounded-full bg-[#ECA519]/15 px-2 py-0.5 text-[11px] font-semibold text-[#8A5A00]" data-testid={`tag-today-${slot}`}><CalendarClock className="h-3 w-3" />Today</span>}
          <StatusPill status={status} label={period.status} />
          <div className="hidden w-36 sm:block" data-testid={`summary-${slot}`}>
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{sum.total ? `${sum.done} of ${sum.total} done` : 'No items yet'}</span>
              {sum.blocked > 0 && <span className="text-[#8E2D58]">{sum.blocked} blocked</span>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#0A2540]/[0.07]">
              <div className="h-full origin-left rounded-full bg-[#49B949] transition-transform duration-500" style={{ transform: `scaleX(${pct / 100})` }} />
            </div>
          </div>
          {isAdmin && (
            <button type="button" onClick={onEdit} aria-label={`Edit ${period.name}`}
              className="rounded-md p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/[0.06]" data-testid={`button-edit-period-${slot}`}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {open && (
        <div id={bodyId} className="rise border-t border-border">
          {period.meetingNotes && (
            <div className="border-b border-border bg-[#F6F3EC]/60 px-5 py-3 text-[13px] leading-relaxed text-[#3A4E63]">
              <span className="mr-2 text-[11px] font-semibold uppercase tracking-wider text-[#0A2540]">Meeting notes</span>
              <span className="whitespace-pre-wrap">{period.meetingNotes}</span>
            </div>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

export function MissingPeriod({ slot, isAdmin, onAdd }: { slot: 'previous' | 'next'; isAdmin: boolean; onAdd: () => void }) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-3.5 md:px-5" data-testid={`placeholder-${slot}`}>
      <span className="w-[4.5rem] pl-7 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{SLOT_LABEL[slot]}</span>
      <span className="flex-1 text-sm text-muted-foreground">{slot === 'previous' ? 'No earlier period on record.' : 'Nothing planned after this period yet.'}</span>
      {isAdmin && (
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-[#0A2540] hover:border-[#1D8BC4]/50" data-testid={`button-add-${slot}-period`}>
          <Plus className="h-3.5 w-3.5" /> Add {slot} period
        </button>
      )}
    </section>
  );
}
