import { Link } from 'wouter';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, CalendarDays, LineChart, Pencil } from 'lucide-react';
import type { CalendarEvent, Foundation, ScorecardMeasurement, ScorecardMetric, ScorecardMilestone } from '@workspace/api-client-react';
import { LatestValueBox } from '@/components/scorecard/latest-value-box';
import type { TrackerActions } from '@/lib/scorecard-tracker-hooks';
import { authorLabel, dayLabel, eventWhen, fmtNum, goalState, goalText, judge, stampLabel } from '@/lib/scorecard-tracker';
import { calendarHref } from '@/lib/event-metric';

export type KrLink = { objectiveId: string; label: string };

const TONE = {
  on_track: { bar: 'bg-[#49B949]', chip: 'bg-[#49B949]/14 text-[#22702A]', label: 'On track' },
  off_track: { bar: 'bg-[#B03E71]', chip: 'bg-[#B03E71]/12 text-[#8E2D58]', label: 'Off track' },
  missing: { bar: 'bg-[#9AA8B6]', chip: 'bg-[#0A2540]/6 text-[#3A4E63]', label: 'No value' },
  not_due: { bar: 'bg-[#ECA519]/60', chip: 'bg-[#ECA519]/14 text-[#8A5A00]', label: 'Not due yet' },
} as const;

export function TrackerRow({ metric, milestones, latest, today, foundation, event, krLink, isAdmin, canUp, canDown, actions, onOpen, onEdit, onMove, onToggleActive }: {
  metric: ScorecardMetric; milestones: ScorecardMilestone[]; latest: ScorecardMeasurement | undefined; today: string; foundation: Foundation;
  event: CalendarEvent | undefined; krLink: KrLink | undefined; isAdmin: boolean; canUp: boolean; canDown: boolean; actions: TrackerActions;
  onOpen: () => void; onEdit: () => void; onMove: (dir: -1 | 1) => void; onToggleActive: () => void;
}) {
  const value = latest && typeof latest.value === 'number' ? latest.value : null;
  const state = goalState(metric, milestones, today);
  const j = judge(value, state);
  const tone = TONE[j];
  const owner = authorLabel(foundation.staff, metric.ownerId);
  const area = foundation.areas.find((a) => a.id === metric.areaId)?.name;
  const d = metric.decimals;

  return (
    <article className={`group relative grid grid-cols-1 gap-4 overflow-hidden rounded-xl border border-[#0A2540]/10 bg-card py-4 pl-5 pr-4 transition-shadow hover:shadow-[0_6px_24px_-12px_rgba(10,37,64,0.35)] md:grid-cols-[minmax(0,1.35fr)_minmax(150px,0.7fr)_minmax(240px,1fr)] md:items-center ${metric.active ? '' : 'opacity-60'}`}
      data-testid={`row-metric-${metric.id}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
      <div className="min-w-0">
        <button type="button" onClick={onOpen} className="group/t flex items-start gap-2 text-left" data-testid={`button-open-metric-${metric.id}`}>
          <span className="font-display text-[19px] font-semibold leading-snug text-[#0A2540] group-hover/t:underline group-hover/t:decoration-[#1D8BC4]/50 group-hover/t:underline-offset-4">{metric.title}</span>
          <LineChart className="mt-1 h-4 w-4 shrink-0 text-[#1D8BC4] opacity-60 group-hover/t:opacity-100" />
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#3A4E63]">
          <span className="flex items-center gap-1.5" title={owner.name}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0A2540]/8 font-mono text-[9px] font-semibold text-[#0A2540]">{owner.initials}</span>{owner.name}</span>
          {area && <span>· {area}</span>}
          {!metric.active && <span className="rounded bg-[#0A2540]/8 px-1.5 font-mono text-[10px] uppercase tracking-wider">Archived</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
          <span className="rounded-md bg-[#ECA519]/12 px-2 py-0.5 text-[#8A5A00]" data-testid={`text-goal-${metric.id}`}>
            {state.mode === 'pending' ? `Next: ${goalText({ direction: metric.direction, target: state.next.target, upperTarget: state.next.upperTarget }, d, metric.unit)} by ${dayLabel(state.next.dueDate)}`
              : state.mode === 'due' ? `${goalText(state.goal, d, metric.unit)} (due ${dayLabel(state.dueDate)})${state.next ? `, next ${dayLabel(state.next.dueDate)}` : ''}`
              : goalText(state.goal, d, metric.unit)}
          </span>
          {event && (
            <Link href={calendarHref(event)} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md bg-[#1D8BC4]/10 px-2 py-0.5 text-[#14648F] hover:bg-[#1D8BC4]/18" data-testid={`link-event-${metric.id}`}>
              <CalendarDays className="h-3 w-3" />{event.title.length > 42 ? event.title.slice(0, 41) + '…' : event.title} · {eventWhen(event)}
            </Link>
          )}
          {krLink && (
            <Link href={`/qbos/${krLink.objectiveId}`} className="rounded-md bg-[#0A2540]/6 px-2 py-0.5 text-[#3A4E63] hover:bg-[#0A2540]/10" title="Context only; never updates key result progress" data-testid={`link-kr-${metric.id}`}>
              KR {krLink.label.length > 40 ? krLink.label.slice(0, 39) + '…' : krLink.label}
            </Link>
          )}
        </div>
      </div>

      <button type="button" onClick={onOpen} className="flex flex-col items-start rounded-lg px-1 text-left md:items-end md:text-right" data-testid={`button-open-value-${metric.id}`}>
        <span className="font-mono text-[28px] font-semibold leading-none tracking-tight text-[#0A2540]" data-testid={`text-current-${metric.id}`}>
          {value == null ? '--' : fmtNum(value, d)}<span className="ml-1 text-[12px] font-normal text-[#3A4E63]">{value == null ? '' : metric.unit}</span>
        </span>
        <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.chip}`} data-testid={`status-${metric.id}`}>{tone.label}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">{latest ? `${authorLabel(foundation.staff, latest.authorId).initials} · ${stampLabel(latest.recordedAt)}` : 'Never recorded'}</span>
      </button>

      <div className="flex flex-col gap-2">
        <LatestValueBox metric={metric} actions={actions} />
        {isAdmin && (
          <div className="flex items-center justify-end gap-0.5 text-[#3A4E63]">
            <IconBtn label="Move up" disabled={!canUp} onClick={() => onMove(-1)} testId={`button-up-${metric.id}`}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="Move down" disabled={!canDown} onClick={() => onMove(1)} testId={`button-down-${metric.id}`}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="Configure" onClick={onEdit} testId={`button-edit-${metric.id}`}><Pencil className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label={metric.active ? 'Archive' : 'Restore'} onClick={onToggleActive} testId={`button-archive-${metric.id}`}>
              {metric.active ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
            </IconBtn>
          </div>
        )}
      </div>
    </article>
  );
}

function IconBtn({ label, onClick, disabled, testId, children }: { label: string; onClick: () => void; disabled?: boolean; testId: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} data-testid={testId}
      className="rounded-md p-1.5 hover:bg-[#0A2540]/6 disabled:opacity-30">{children}</button>
  );
}
