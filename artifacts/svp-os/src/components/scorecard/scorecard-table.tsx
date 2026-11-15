import { Link } from 'wouter';
import { Archive, ArrowDown, ArrowUp, Link2, Pencil, RotateCcw } from 'lucide-react';
import type { Foundation, ScorecardEntry, ScorecardMetric } from '@workspace/api-client-react';
import { StaffAvatar } from '@/components/ui-bits';
import { STATUS_META, currentMonday, fmtValue, goalLabel, metricStats, sameGoal, weekShort } from '@/lib/scorecard';
import { cn } from '@/lib/utils';

export type KrLink = { objectiveId: string; label: string };

export function ScorecardTable({ metrics, weeks, entries, foundation, krLinks, onCell, onEdit, onMove, onToggleActive }: {
  metrics: ScorecardMetric[]; weeks: string[]; entries: ScorecardEntry[]; foundation: Foundation; krLinks: Record<string, KrLink>;
  onCell: (m: ScorecardMetric, week: string) => void; onEdit: (m: ScorecardMetric) => void;
  onMove: (index: number, dir: -1 | 1) => void; onToggleActive: (m: ScorecardMetric) => void;
}) {
  const today = currentMonday();
  return (
    <div className="-mx-4 overflow-x-auto md:mx-0 md:rounded-2xl md:border md:border-card-border md:bg-card" data-testid="table-scorecard">
      <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left">
            <th className="sticky left-0 z-10 w-[300px] border-b border-border bg-[#F4F1E8] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3A4E63]">Metric · goal</th>
            {weeks.map((w) => (
              <th key={w} className={cn('border-b border-border bg-[#F4F1E8] px-1 py-3 text-center font-mono text-[10.5px] font-medium text-[#3A4E63]', w === today && 'text-[#1D8BC4]')} title={`Mon ${w}`}>
                {weekShort(w)}{w === today && <div className="text-[9px] uppercase tracking-wider">this wk</div>}
              </th>
            ))}
            <th className="border-b border-border bg-[#F4F1E8] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3A4E63]">Window</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => {
            const owner = foundation.staff.find((s) => s.id === m.ownerId);
            const area = foundation.areas.find((a) => a.id === m.areaId);
            const mine = entries.filter((e) => e.metricId === m.id);
            const st = metricStats(mine);
            const link = m.linkedKeyResultId ? krLinks[m.linkedKeyResultId] : undefined;
            return (
              <tr key={m.id} className={cn('group', !m.active && 'opacity-70')} data-testid={`row-metric-${m.id}`}>
                <td className="sticky left-0 z-10 border-b border-border/70 bg-card px-4 py-3 align-top">
                  <div className="flex items-start gap-2.5">
                    <StaffAvatar name={owner?.name ?? '?'} url={owner?.avatarUrl} color={area?.color} size="h-7 w-7" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-snug text-[#0A2540]" data-testid={`text-metric-title-${m.id}`}>
                        {m.title}{!m.active && <span className="ml-1.5 rounded bg-[#0A2540]/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#3A4E63]">Archived</span>}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-[#1D8BC4]" data-testid={`text-metric-goal-${m.id}`}>{goalLabel(m, m.decimals)}</div>
                      <div className="text-[11px] text-muted-foreground">{owner?.name ?? 'Unassigned'} · {area?.name ?? 'No area'}</div>
                      {link && (
                        <Link href={`/qbos/${link.objectiveId}`} className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-[#3A4E63] hover:text-[#1D8BC4]" data-testid={`link-metric-qbo-${m.id}`}>
                          <Link2 className="h-3 w-3 shrink-0" /> <span className="truncate">QBO: {link.label}</span>
                        </Link>
                      )}
                      {m.linkedKeyResultId && !link && <div className="mt-1 text-[11px] text-muted-foreground">Linked key result no longer available</div>}
                    </div>
                    {m.canEdit && (
                      <div className="flex shrink-0 flex-col items-center opacity-60 transition-opacity group-hover:opacity-100">
                        <button onClick={() => onEdit(m)} aria-label="Configure metric" className="rounded p-1 text-[#3A4E63] hover:bg-[#0A2540]/6" data-testid={`button-edit-metric-${m.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                        <button disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="Move up" className="rounded p-1 text-[#3A4E63] hover:bg-[#0A2540]/6 disabled:opacity-20" data-testid={`button-up-metric-${m.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button disabled={i === metrics.length - 1} onClick={() => onMove(i, 1)} aria-label="Move down" className="rounded p-1 text-[#3A4E63] hover:bg-[#0A2540]/6 disabled:opacity-20" data-testid={`button-down-metric-${m.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button onClick={() => onToggleActive(m)} aria-label={m.active ? 'Archive metric' : 'Restore metric'} className="rounded p-1 text-[#3A4E63] hover:bg-[#0A2540]/6" data-testid={`button-${m.active ? 'archive' : 'restore'}-metric-${m.id}`}>
                          {m.active ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                {weeks.map((w) => {
                  const e = mine.find((x) => x.weekStart === w);
                  const meta = e ? STATUS_META[e.status] : null;
                  const future = w > today;
                  const drift = e && !sameGoal(e, m);
                  return (
                    <td key={w} className="border-b border-border/70 p-1 align-middle">
                      <button onClick={() => onCell(m, w)} disabled={future && !e}
                        title={e ? `${meta?.label}${e.note ? ` · ${e.note}` : ''}${drift ? ` · goal then: ${goalLabel(e, m.decimals)}` : ''}` : future ? 'Future week' : 'No entry'}
                        className={cn('relative flex h-11 w-full min-w-[58px] flex-col items-center justify-center rounded-lg font-mono tabular-nums transition-transform hover:scale-[1.04] disabled:cursor-default disabled:hover:scale-100',
                          meta ? `${meta.bg} ${meta.text}` : future ? 'bg-transparent text-[#C9D2DB]' : 'border border-dashed border-[#0A2540]/12 text-[#9AA8B6]')}
                        data-testid={`cell-${m.id}-${w}`}>
                        <span className="text-[12.5px] font-medium">{e ? (e.value == null ? 'missing' : fmtValue(e.value, m.decimals)) : future ? '' : '--'}</span>
                        {(e?.note || drift) && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: drift ? '#ECA519' : '#1D8BC4' }} />}
                      </button>
                    </td>
                  );
                })}
                <td className="border-b border-border/70 px-3 py-2 align-middle text-[12px]" data-testid={`text-metric-stats-${m.id}`}>
                  <div className="whitespace-nowrap font-semibold text-[#0A2540]">{st.onTrack}/{st.recorded} on track</div>
                  <div className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {st.change == null ? 'no trend yet' : `${st.change > 0 ? '+' : ''}${fmtValue(st.change, m.decimals)} vs prior`}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
