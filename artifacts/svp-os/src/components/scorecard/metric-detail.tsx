import { useState } from 'react';
import { Link } from 'wouter';
import { CalendarDays, RotateCw, Trash2 } from 'lucide-react';
import type { CalendarEvent, Foundation, ScorecardMetric, ScorecardMilestone } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { WideDialog } from '@/components/scorecard/wide-dialog';
import { TrendChart } from '@/components/scorecard/trend-chart';
import { LatestValueBox } from '@/components/scorecard/latest-value-box';
import { useFullTrend, type TrackerActions } from '@/lib/scorecard-tracker-hooks';
import { splitByUnit, authorLabel, dayLabel, eventWhen, fmtWithUnit, goalText, goalState, stampLabel } from '@/lib/scorecard-tracker';
import { calendarHref } from '@/lib/event-metric';

export function MetricDetail({ metric, milestones, today, foundation, event, actions, onClose }: {
  metric: ScorecardMetric; milestones: ScorecardMilestone[]; today: string; foundation: Foundation;
  event: CalendarEvent | undefined; actions: TrackerActions; onClose: () => void;
}) {
  const trend = useFullTrend(metric.id);
  const [confirm, setConfirm] = useState<string | null>(null);
  const entries = trend.data ?? trend.partial ?? [];
  const state = goalState(metric, milestones, today);
  const d = metric.decimals;
  const owner = authorLabel(foundation.staff, metric.ownerId).name;
  const newestFirst = [...entries].reverse();
  const units = splitByUnit(entries, metric.unit);

  return (
    <WideDialog open onOpenChange={(o) => { if (!o) onClose(); }} title={metric.title} testId="dialog-metric-detail"
      eyebrow={<>{owner} · {foundation.areas.find((a) => a.id === metric.areaId)?.name ?? 'No area'}{metric.unit ? ` · ${metric.unit}` : ''}</>}>
      <div className="mb-4 flex flex-wrap gap-2 text-[12px]">
        <span className="rounded-full bg-[#ECA519]/14 px-2.5 py-1 font-medium text-[#8A5A00]" data-testid="text-detail-goal">
          {state.mode === 'pending' ? `No goal due yet. Next: ${goalText({ direction: metric.direction, target: state.next.target, upperTarget: state.next.upperTarget }, d, metric.unit)} by ${dayLabel(state.next.dueDate)}`
            : state.mode === 'due' ? `Goal in force since ${dayLabel(state.dueDate)}: ${goalText(state.goal, d, metric.unit)}`
            : `Standing goal: ${goalText(state.goal, d, metric.unit)}`}
        </span>
        {event && (
          <Link href={calendarHref(event)} className="inline-flex items-center gap-1.5 rounded-full bg-[#1D8BC4]/10 px-2.5 py-1 font-medium text-[#14648F] hover:bg-[#1D8BC4]/18" data-testid="link-detail-event">
            <CalendarDays className="h-3.5 w-3.5" />{event.title} · {eventWhen(event)}
          </Link>
        )}
        {metric.calendarEventId && !event && <span className="rounded-full bg-[#0A2540]/6 px-2.5 py-1 text-[#3A4E63]">Linked event not visible on the calendar</span>}
      </div>

      {trend.isLoading && (
        <div className="space-y-2" data-testid="status-trend-loading">
          <div className="h-[300px] animate-pulse rounded-xl bg-[#0A2540]/[0.04]" />
          <p className="font-mono text-[11px] text-[#3A4E63]">Loading history: {trend.progress.loaded} entries across {trend.progress.pages} page{trend.progress.pages === 1 ? '' : 's'}</p>
        </div>
      )}
      {trend.isError && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#B03E71]/8 px-3 py-2 text-[13px] text-[#8E2D58]" data-testid="status-trend-partial">
          <span>{trend.partial && trend.partial.length > 0 ? `Partial history: only ${trend.partial.length} entries loaded before an error. The chart and list below are incomplete.` : 'History could not load.'}</span>
          <Button size="sm" variant="outline" className="bg-card" onClick={() => trend.refetch()} data-testid="button-trend-retry"><RotateCw className="mr-1 h-3.5 w-3.5" />Retry</Button>
        </div>
      )}

      {!trend.isLoading && (entries.length > 0 || milestones.length > 0) && (
        <div className="rounded-xl border border-[#0A2540]/8 bg-white/60 p-3">
          {units.other.length > 0 && (
            <p className="mb-2 rounded-md bg-[#ECA519]/12 px-2.5 py-1.5 text-[12px] text-[#6B4A00]" data-testid="text-mixed-units">
              {units.other.length} older entr{units.other.length === 1 ? 'y was' : 'ies were'} recorded in {units.otherUnits.join(', ')}, not {metric.unit || '(no unit)'}. They are listed below but not plotted; no conversion is applied.
            </p>
          )}
          <TrendChart metric={metric} entries={units.same} milestones={milestones} today={today} />
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-[#3A4E63]">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#1D8BC4]" />Recorded value, spaced by time</span>
            {milestones.length > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 bg-[#ECA519]" />Dated target{metric.direction === 'range' ? ' (hollow: upper bound)' : ''}</span>}
            {milestones.length === 0 && <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-[#ECA519]" />Standing goal</span>}
          </div>
        </div>
      )}
      {!trend.isLoading && !trend.isError && entries.length === 0 && milestones.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#1D8BC4]/35 bg-[#1D8BC4]/[0.04] px-5 py-8 text-center text-[14px] text-[#3A4E63]" data-testid="text-trend-empty">
          Nothing recorded yet. The first saved value starts the line.
        </div>
      )}

      {metric.canRecord && <div className="mt-4 max-w-md"><LatestValueBox metric={metric} actions={actions} /></div>}

      {milestones.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#3A4E63]">Dated targets ({milestones.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {milestones.map((m) => (
              <span key={m.id} className={`rounded-md border px-2 py-1 font-mono text-[11.5px] ${m.dueDate <= today ? 'border-[#0A2540]/15 text-[#0A2540]' : 'border-dashed border-[#ECA519]/60 text-[#8A5A00]'}`} data-testid={`milestone-${m.id}`}>
                {dayLabel(m.dueDate)}: {goalText({ direction: metric.direction, target: m.target, upperTarget: m.upperTarget }, d, '')}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#3A4E63]">History{trend.data ? ` · ${trend.data.length} entries, complete` : ''}</h3>
        {newestFirst.length === 0 ? <p className="text-[13px] text-muted-foreground">No entries.</p> : (
          <ol className="divide-y divide-[#0A2540]/8 rounded-xl border border-[#0A2540]/8 bg-white/50" data-testid="list-history">
            {newestFirst.map((e) => {
              const a = authorLabel(foundation.staff, e.authorId);
              return (
                <li key={e.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-3.5 py-2.5" data-testid={`row-entry-${e.id}`}>
                  <span title={a.name} className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#0A2540] font-mono text-[10px] font-semibold text-[#FBFAF6]">{a.initials}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[15px] font-semibold text-[#0A2540]">{e.value == null ? 'Cleared' : fmtWithUnit(e.value, d, e.unit)}</span>
                      <span className="text-[12px] text-[#3A4E63]">{a.name} · {stampLabel(e.recordedAt)}</span>
                    </div>
                    {e.note && <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-[#3A4E63]">{e.note}</p>}
                    {(e.sourceWeekStart || e.legacyReason) && (
                      <p className="mt-1 text-[11.5px] text-[#8A5A00]">
                        {e.sourceWeekStart ? `Imported from weekly scorecard, week of ${dayLabel(e.sourceWeekStart)}` : 'Imported'}{e.legacyReason ? `. Reason: ${e.legacyReason}` : ''}
                      </p>
                    )}
                  </div>
                  {e.canDelete && (confirm === e.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)} data-testid={`button-cancel-delete-${e.id}`}>Keep</Button>
                      <Button size="sm" disabled={actions.deleting} className="bg-[#B03E71] text-white hover:bg-[#B03E71]/90"
                        onClick={async () => { const r = await actions.remove(e.id); if (r.ok) setConfirm(null); }} data-testid={`button-confirm-delete-${e.id}`}>Delete</Button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirm(e.id)} aria-label="Delete entry" className="rounded p-1.5 text-[#3A4E63] hover:bg-[#B03E71]/10 hover:text-[#8E2D58]" data-testid={`button-delete-${e.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ))}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </WideDialog>
  );
}
