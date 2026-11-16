import { CopyPlus, Plus } from 'lucide-react';
import type { Area, SixItem, SixMoment, SixPeriod, Staff } from '@workspace/api-client-react';
import { StaffAvatar } from '@/components/ui-bits';
import { areaById } from '@/lib/format';
import { ITEM_STATUS, canCreateFor, summarize } from '@/lib/six-by-six';

export const priorityLabel = (position: number) => `Priority ${position}`;

/** One person's six independent priority slots. Slots map to internal moment ids; shared titles are never shown. */
export function PersonPlan({ period, items, person, areas, actor, onOpenItem, onAddItem, onCopyItem, copyDisabledReason }: {
  period: SixPeriod; items: SixItem[]; person: Staff; areas: Area[]; actor: Staff;
  onOpenItem: (item: SixItem, slot: SixMoment) => void;
  onAddItem: (slot: SixMoment) => void;
  onCopyItem?: (item: SixItem, slot: SixMoment) => void;
  copyDisabledReason?: (item: SixItem, slot: SixMoment) => string | undefined;
}) {
  const slots = [...period.moments].sort((a, b) => a.position - b.position);
  const mine = items.filter((i) => i.ownerId === person.id);
  // Retain access to older extra items without putting multiple priorities in a box.
  const orphans = mine.filter((i) => !slots.some((s) => s.id === i.momentId) ||
    mine.find((candidate) => candidate.momentId === i.momentId)?.id !== i.id);
  const canAdd = canCreateFor(actor, person);
  const own = summarize(mine);
  const isSelf = actor.id === person.id;

  return (
    <div className="px-4 py-4 md:px-5" data-testid={`plan-${period.id}-${person.id}`}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <StaffAvatar name={person.name} url={person.avatarUrl} color={areaById(areas, person.areaId)?.color} size="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-[#0A2540]" data-testid="text-plan-owner">{isSelf ? 'Your six priorities' : `${person.name}'s six priorities`}{!person.active && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">inactive</span>}</div>
          <div className="text-[12px] text-muted-foreground" data-testid="text-plan-summary">{own.total ? `${own.done} of ${own.total} done${own.blocked ? ` · ${own.blocked} blocked` : ''}` : 'Nothing committed yet'}{!canAdd && ' · view only'}</div>
        </div>
      </div>
      <ol className="grid gap-2 md:grid-cols-2">
        {slots.map((s) => {
          const cell = mine.filter((i) => i.momentId === s.id).slice(0, 1);
          return (
            <li key={s.id} className="flex gap-3 rounded-xl border border-border bg-card px-3 py-2.5" data-testid={`slot-priority-${s.position}`}>
              <span className="mt-0.5 font-display text-[22px] font-semibold leading-none tabular-nums text-[#1D8BC4]/80">{s.position}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{priorityLabel(s.position)}{cell.length > 1 && <span className="ml-1 normal-case tracking-normal">· {cell.length} items</span>}</span>
                {cell.map((it) => {
                  const disabledReason = copyDisabledReason?.(it, s);
                  return (
                  <div key={it.id} className="flex items-start gap-1">
                    <ItemChip it={it} onClick={() => onOpenItem(it, s)} />
                    {onCopyItem && it.canEdit && canAdd && (
                      <button type="button" onClick={() => onCopyItem(it, s)} disabled={!!disabledReason}
                        aria-label={`Copy ${it.title} to next 6x6`} title={disabledReason ?? 'Copy to next 6x6'}
                        data-testid={`button-copy-item-${it.id}`}
                        className="shrink-0 rounded-md p-2 text-[#125F88] hover:bg-[#1D8BC4]/10 disabled:cursor-not-allowed disabled:opacity-40">
                        <CopyPlus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ); })}
                {canAdd && cell.length === 0 && (
                  <button type="button" onClick={() => onAddItem(s)} aria-label={`Add to ${priorityLabel(s.position)}`}
                    className="flex h-8 items-center gap-1 rounded-md border border-dashed border-border px-2 text-[12px] font-semibold text-muted-foreground transition hover:border-[#1D8BC4]/60 hover:text-[#125F88]"
                    data-testid={`button-add-priority-${s.position}`}>
                    <Plus className="h-3.5 w-3.5" />Set this priority
                  </button>
                )}
                {!canAdd && cell.length === 0 && <span className="text-[12.5px] italic text-muted-foreground">Open</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {slots.length === 0 && <p className="text-sm text-muted-foreground">This period has no priority slots.</p>}
      {orphans.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-[#ECA519]/50 bg-[#ECA519]/[0.05] px-3 py-2.5" data-testid="section-unslotted">
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#8A5A00]">Other saved items</div>
          <p className="mb-2 text-xs text-muted-foreground">Previously saved extras are kept here so nothing is lost. Each priority box now holds one item.</p>
          <div className="flex flex-col gap-1">{orphans.map((it) => <ItemChip key={it.id} it={it} onClick={() => onOpenItem(it, { id: it.momentId, periodId: period.id, position: 0, title: '', eventDate: null, version: 0 })} />)}</div>
        </div>
      )}
    </div>
  );
}

function ItemChip({ it, onClick }: { it: SixItem; onClick: () => void }) {
  const st = ITEM_STATUS[it.status];
  const detail = it.description.trim();
  const characters = Array.from(detail);
  const preview = characters.length > 100 ? `${characters.slice(0, 100).join('')}…` : detail;
  return (
    <button type="button" onClick={onClick} title={`${st.label}${it.canEdit ? '' : ' · view only'}${detail ? `\n\n${detail}` : ''}`}
      className={`flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug ring-1 ring-inset transition-colors hover:ring-[#0A2540]/30 ${st.chip}`}
      data-testid={`button-item-${it.id}`}>
      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: st.dot }} />
      <span className="min-w-0 flex-1 break-words">
        <span className={`block ${it.status === 'done' ? 'line-through decoration-[#22702A]/40' : ''}`}>{it.title}</span>
        {detail && <span className="mt-1 block whitespace-pre-wrap text-[12px] font-normal leading-relaxed text-muted-foreground" data-testid={`text-item-detail-${it.id}`}>{preview}</span>}
      </span>
      <span className="shrink-0 text-[10.5px] font-semibold opacity-70">{st.label}</span>
    </button>
  );
}
