import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, BarChart3, Target } from 'lucide-react';
import type { Foundation, KeyResult } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { currentQuarter, isQbo, qboHref } from '@/lib/qbo';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel, StatusPill } from '@/components/ui-bits';
import { HealthDot, ProgressTrack } from '@/components/okr/bits';
import { CheckInDialog } from '@/components/okr/dialogs';
import { useStaffSession } from '@/lib/session-context';
import { avgProgress, bySort, krValueLabel, useOkrActions, useOkrWorkspace } from '@/lib/okr';
import { errorMessage, fmtDate, pickCurrentCycle } from '@/lib/format';
import { QuarterNarrativePanel } from '@/components/okr/quarter-narrative';
import { MissionPanel } from '@/components/home/mission-panel';
import { useDocumentTitle } from '@/components/home/community';
import { MySixPanel } from '@/components/home/my-six-panel';
import { UpcomingEventsPanel } from '@/components/home/upcoming-events';

function DashboardBody({ data }: { data: Foundation }) {
  useDocumentTitle('Dashboard · SVP Compass');
  const me = useStaffSession();
  const q = useOkrWorkspace();
  const actions = useOkrActions();
  const cycleId = pickCurrentCycle(data.cycles)?.id ?? '';
  const [checkKr, setCheckKr] = useState<KeyResult | null>(null);

  const cycle = data.cycles.find((c) => c.id === cycleId);
  const first = me.name.split(' ')[0];
  const quarter = currentQuarter(cycle);

  const header = (
    <PageHeader eyebrow={cycle ? `${cycle.name} · ${quarter} · ${fmtDate(cycle.startDate, 'MMM d')} to ${fmtDate(cycle.endDate)}` : 'No cycle yet'} title={`Good to see you, ${first}.`}
      actions={<>
        {cycle && <StatusPill status={cycle.status} label={cycle.status} />}
        <Link href={qboHref({ cycle: cycleId, q: quarter })} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2540] px-3.5 text-[13px] font-semibold text-white hover:bg-[#0A2540]/90" data-testid="link-qbos">
          <Target className="h-4 w-4" /> {quarter} QBOs
        </Link>
        <Link href="/scorecard" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[13px] font-semibold text-[#0A2540] hover:border-[#1D8BC4]/50" data-testid="link-scorecard">
          <BarChart3 className="h-4 w-4" /> Scorecard
        </Link>
      </>}>
      Your six for this period, the quarter's commitments, and what is coming up.
    </PageHeader>
  );
  const six = <MySixPanel me={me} staff={data.staff} areas={data.areas} />;

  if (q.isLoading || q.isError || !q.data) return (
    <>
      {header}{six}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {q.isLoading ? <PageSkeleton /> : <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
        <UpcomingEventsPanel />
      </div>
      <div className="mt-5"><MissionPanel /></div>
    </>
  );
  const ws = q.data;

  const company = ws.objectives.filter((o) => o.cycleId === cycleId && isQbo(o) && o.timeScope === quarter).sort(bySort);
  const companyAvg = avgProgress(company, ws.keyResults);
  const qboIds = new Set(company.map((o) => o.id));
  const myKrs = ws.keyResults.filter((k) => k.ownerId === me.id && k.canEdit && qboIds.has(k.objectiveId))
    .sort((a, b) => (a.lastCheckInAt ?? '').localeCompare(b.lastCheckInAt ?? ''));
  const counts = { green: 0, yellow: 0, red: 0 } as Record<string, number>;
  company.forEach((o) => { if (ws.keyResults.some((k) => k.objectiveId === o.id) && o.health in counts) counts[o.health]++; });

  return (
    <>
      {header}
      {six}

      {myKrs.length > 0 && (
        <Panel className="rise mb-5 border-[#1D8BC4]/30 bg-[#1D8BC4]/[0.04]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-[#0A2540]">Your check-ins</h2>
            <span className="font-mono text-[11px] text-muted-foreground">oldest first</span>
          </div>
          <ul className="space-y-2">
            {myKrs.slice(0, 5).map((k) => (
              <li key={k.id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5" data-testid={`due-kr-${k.id}`}>
                <HealthDot health={k.lastCheckInAt ? k.health : 'none'} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-[#0A2540]">{k.title}</div>
                  <div className="text-[12px] text-muted-foreground">{krValueLabel(k)}{k.lastCheckInAt ? ` · ${fmtDate(k.lastCheckInAt, 'MMM d')}` : ''}</div>
                </div>
                <Button size="sm" onClick={() => setCheckKr(k)} className="h-9 shrink-0 bg-[#1D8BC4] text-white hover:bg-[#177AAE]" data-testid={`button-dash-checkin-${k.id}`}>Check in</Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel className="rise">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#0A2540]">{quarter} QBOs</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">Average counts QBOs without key results as 0%.</p>
            </div>
            <div className="text-right">
              <div className="font-display text-4xl font-semibold tabular-nums text-[#0A2540]" data-testid="text-company-avg">{companyAvg != null ? `${companyAvg}%` : '--'}</div>
              <div className="mt-1 flex justify-end gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="text-[#22702A]">{counts.green} on</span><span className="text-[#8A5A00]">{counts.yellow} watch</span><span className="text-[#B03E71]">{counts.red} behind</span>
              </div>
            </div>
          </div>
          <QuarterNarrativePanel cycleId={cycleId} quarter={quarter} compact className="mt-4" />
          {company.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#1D8BC4]/40 bg-[#1D8BC4]/[0.05] p-6" data-testid="empty-objectives">
              <div className="font-display text-lg text-[#0A2540]">{`No QBOs for ${quarter} yet.`}</div>
              <Link href={qboHref({ cycle: cycleId, q: quarter })} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1D8BC4]" data-testid="link-qbos-empty">Open QBOs <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {company.map((o) => {
                const m = ws.keyResults.some((k) => k.objectiveId === o.id);
                const own = data.staff.find((x) => x.id === o.ownerId);
                return (
                  <li key={o.id}>
                    <Link href={`/qbos/${o.id}`} className="group block rounded-xl px-2 py-2 transition-colors hover:bg-[#0A2540]/[0.03]" data-testid={`dash-objective-${o.id}`}>
                      <div className="flex items-center gap-2">
                        <HealthDot health={m ? o.health : 'none'} />
                        <span className="flex-1 truncate text-[14px] font-semibold text-[#0A2540] group-hover:text-[#1D8BC4]">{o.title}</span>
                        <span className="font-mono text-[12px] tabular-nums">{m ? `${Math.round(o.progress)}%` : 'no KRs'}</span>
                      </div>
                      <ProgressTrack value={o.progress} expected={o.expectedProgress} health={o.health} measured={m} className="mt-2" />
                      <div className="mt-1 text-[11px] text-muted-foreground">Accountable: {own?.name ?? 'Unassigned'}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <UpcomingEventsPanel />
      </div>

      {checkKr && <CheckInDialog open={!!checkKr} onOpenChange={(o) => { if (!o) setCheckKr(null); }} kr={checkKr} actions={actions}
        lastCheckIn={[...ws.checkIns].filter((c) => c.keyResultId === checkKr.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]} />}

      <div className="mt-5"><MissionPanel /></div>
    </>
  );
}

export default function Dashboard() {
  return <WithFoundation>{(data) => <DashboardBody data={data} />}</WithFoundation>;
}
