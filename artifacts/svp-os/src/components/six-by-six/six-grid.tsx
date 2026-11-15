import { Pencil, Plus } from 'lucide-react';
import type { Area, SixItem, SixMoment, SixPeriod, Staff } from '@workspace/api-client-react';
import { StaffAvatar } from '@/components/ui-bits';
import { areaById, fmtDate } from '@/lib/format';
import { ITEM_STATUS, canCreateFor, summarize } from '@/lib/six-by-six';

export function SixGrid({ period, items, columns, areas, actor, onOpenItem, onAddItem, onEditMoment }: {
  period: SixPeriod; items: SixItem[]; columns: Staff[]; areas: Area[]; actor: Staff;
  onOpenItem: (item: SixItem, moment: SixMoment) => void;
  onAddItem: (moment: SixMoment, owner: Staff) => void;
  onEditMoment: (moment: SixMoment) => void;
}) {
  const moments = [...period.moments].sort((a, b) => a.position - b.position);
  const isAdmin = actor.role === 'admin';
  return (
    <div className="overflow-x-auto overscroll-x-contain" data-testid={`grid-period-${period.id}`}>
      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 w-52 min-w-[13rem] border-b border-border bg-card px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Major moment</th>
            {columns.map((s) => {
              const own = summarize(items.filter((i) => i.ownerId === s.id));
              return (
                <th key={s.id} className="min-w-[11rem] border-b border-border px-2.5 py-3 text-left font-medium" data-testid={`col-staff-${s.id}`}>
                  {actor.id === s.id && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#125F88]" data-testid="label-your-six-items">Your items · click to edit</span>}
                  <div className="flex items-center gap-2">
                    <StaffAvatar name={s.name} url={s.avatarUrl} color={areaById(areas, s.areaId)?.color} size="h-7 w-7" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-[#0A2540]">{s.name.split(' ')[0]}{!s.active && <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">inactive</span>}</div>
                      <div className="text-[11px] font-normal text-muted-foreground">{own.total ? `${own.done} of ${own.total} done` : 'No items'}</div>
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {moments.map((m) => (
            <tr key={m.id} className="group/row" data-testid={`row-moment-${m.id}`}>
              <td className="sticky left-0 z-10 border-b border-border bg-card px-4 py-3 align-top">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-display text-[13px] font-semibold tabular-nums text-[#1D8BC4]">{String(m.position).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold leading-snug ${m.title ? 'text-[#0A2540]' : 'italic text-muted-foreground'}`}>{m.title || `Moment ${m.position}`}</div>
                    {m.eventDate && <div className="text-[12px] text-muted-foreground">{fmtDate(m.eventDate)}</div>}
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => onEditMoment(m)} aria-label={`Edit moment ${m.position}`}
                      className="rounded-md p-1 text-[#3A4E63] opacity-60 hover:bg-[#0A2540]/[0.06] hover:opacity-100 focus-visible:opacity-100" data-testid={`button-edit-moment-${m.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </td>
              {columns.map((s) => {
                const cell = items.filter((i) => i.momentId === m.id && i.ownerId === s.id);
                const canAdd = canCreateFor(actor, s);
                return (
                  <td key={s.id} className="border-b border-l border-border/60 px-2 py-2 align-top" data-testid={`cell-${m.id}-${s.id}`}>
                    <div className="flex min-h-[2.5rem] flex-col gap-1">
                      {cell.map((it) => {
                        const st = ITEM_STATUS[it.status];
                        return (
                          <button key={it.id} type="button" onClick={() => onOpenItem(it, m)}
                            className={`group flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-[12.5px] leading-snug ring-1 ring-inset transition-colors hover:ring-[#0A2540]/30 ${st.chip}`}
                            title={`${st.label}${it.canEdit ? '' : ' · view only'}`} data-testid={`button-item-${it.id}`}>
                            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: st.dot }} />
                            <span className={`min-w-0 break-words ${it.status === 'done' ? 'line-through decoration-[#22702A]/40' : ''}`}>{it.title}</span>
                          </button>
                        );
                      })}
                      {canAdd && (
                        <button type="button" onClick={() => onAddItem(m, s)} aria-label={`Add item for ${s.name} on moment ${m.position}`}
                          className="flex h-7 items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] font-semibold text-muted-foreground opacity-70 transition hover:border-[#1D8BC4]/60 hover:text-[#125F88] hover:opacity-100 focus-visible:opacity-100"
                          data-testid={`button-add-item-${m.id}-${s.id}`}>
                          <Plus className="h-3 w-3" />{cell.length === 0 && 'Add'}
                        </button>
                      )}
                      {!canAdd && cell.length === 0 && <span className="h-7 rounded-md bg-[#0A2540]/[0.02]" aria-label="Empty cell" />}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {moments.length === 0 && (
            <tr><td colSpan={columns.length + 1} className="px-5 py-8 text-center text-muted-foreground">This period has no moment rows.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
