import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, BarChart3, CalendarDays, Target } from 'lucide-react';
import type { Foundation, KeyResult } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/native-select';
import { QUARTERS, currentQuarter, isQbo, qboHref, type Quarter } from '@/lib/qbo';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel, StaffAvatar, StatusPill } from '@/components/ui-bits';
import { HealthDot, ProgressTrack } from '@/components/okr/bits';
import { CheckInDialog } from '@/components/okr/dialogs';
import { useStaffSession } from '@/lib/session-context';
import { avgProgress, bySort, krValueLabel, useOkrActions, useOkrWorkspace } from '@/lib/okr';
import { errorMessage, fmtDate, pickCurrentCycle } from '@/lib/format';
import { MissionPanel } from '@/components/home/mission-panel';
import { useDocumentTitle } from '@/components/home/community';

function DashboardBody({ data }: { data: Foundation }) {
  useDocumentTitle('Dashboard · SVP Compass');
  const me = useStaffSession();
  const q = useOkrWorkspace();
  const actions = useOkrActions();
  const [cycleId, setCycleId] = useState(() => pickCurrentCycle(data.cycles)?.id ?? '');
  const [quarterSel, setQuarterSel] = useState<Quarter | null>(null);
  const [checkKr, setCheckKr] = useState<KeyResult | null>(null);

  const cycle = data.cycles.find((c) => c.id === cycleId);
  const staff = data.staff.filter((s) => s.active);
  const period = data.periods.find((p) => p.status === 'active') ?? data.periods[0];
  const first = me.name.split(' ')[0];
  const quarter = quarterSel ?? currentQuarter(cycle);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const ws = q.data;

  const company = ws.objectives.filter((o) => o.cycleId === cycleId && isQbo(o) && o.timeScope === quarter).sort(bySort);
  const companyAvg = avgProgress(company, ws.keyResults);
  const qboIds = new Set(company.map((o) => o.id));
  const myKrs = ws.keyResults.filter((k) => k.ownerId === me.id && k.canEdit && qboIds.has(k.objectiveId))
    .sort((a, b) => (a.lastCheckInAt ?? '').localeCompare(b.lastCheckInAt ?? ''));
  const recent = [...ws.checkIns].filter((c) => { const k = ws.keyResults.find((x) => x.id === c.keyResultId); return k && qboIds.has(k.objectiveId); })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const counts = { green: 0, yellow: 0, red: 0 } as Record<string, number>;
  company.forEach((o) => { if (ws.keyResults.some((k) => k.objectiveId === o.id) && o.health in counts) counts[o.health]++; });
  const owners = staff.map((s) => ({ s, objs: company.filter((o) => o.ownerId === s.id), krs: ws.keyResults.filter((k) => k.ownerId === s.id && qboIds.has(k.objectiveId)) }))
    .filter((x) => x.objs.length || x.krs.length);
  const legacyCount = ws.objectives.filter((o) => o.cycleId === cycleId && !isQbo(o)).length;

  return (
    <>
      <PageHeader eyebrow={cycle ? `${cycle.name} · ${fmtDate(cycle.startDate, 'MMM d')} to ${fmtDate(cycle.endDate)}` : 'No cycle yet'} title={`Good to see you, ${first}.`}
        actions={<>
          {cycle && <StatusPill status={cycle.status} label={cycle.status} />}
          <Link href={qboHref({ cycle: cycleId, q: quarter })} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2540] px-3.5 text-[13px] font-semibold text-white hover:bg-[#0A2540]/90" data-testid="link-qbos">
            <Target className="h-4 w-4" /> {quarter} QBOs
          </Link>
          <Link href="/scorecard" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[13px] font-semibold text-[#0A2540] hover:border-[#1D8BC4]/50" data-testid="link-scorecard">
            <BarChart3 className="h-4 w-4" /> Scorecard
          </Link>
        </>}>
        Where Sacramento's commitments stand today, and what is waiting on you this quarter.
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[220px_140px]">
        <NativeSelect value={cycleId} onChange={(e) => setCycleId(e.target.value)} aria-label="Cycle" data-testid="filter-cycle">
          {data.cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
        <NativeSelect value={quarter} onChange={(e) => setQuarterSel(e.target.value as Quarter)} aria-label="Quarter" data-testid="filter-quarter">
          {QUARTERS.map((qq) => <option key={qq} value={qq}>{qq}</option>)}
        </NativeSelect>
      </div>

      <MissionPanel />

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

        <Panel className="rise">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-[#0A2540]">Current 6x6</h2>
            <CalendarDays className="h-5 w-5 text-[#ECA519]" />
          </div>
          {period ? (
            <>
              <div className="mt-1 text-sm text-muted-foreground">{period.name} · {fmtDate(period.startDate, 'MMM d')} to {fmtDate(period.endDate, 'MMM d')}</div>
              <ul className="mt-3 space-y-1">
                {[...period.moments].sort((a, b) => a.position - b.position).map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-[13px] odd:bg-muted/50" data-testid={`moment-${m.id}`}>
                    <span className="font-mono text-[11px] text-[#B03E71]">{String(m.position).padStart(2, '0')}</span>
                    <span className="flex-1 truncate font-medium text-[#0A2540]">{m.title}</span>
                    {m.eventDate && <span className="text-[11px] text-muted-foreground">{fmtDate(m.eventDate, 'MMM d')}</span>}
                  </li>
                ))}
                {period.moments.length === 0 && <li className="text-sm text-muted-foreground">No major moments recorded yet.</li>}
              </ul>
              <Link href="/six-by-six" className="group mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1D8BC4]" data-testid="link-six-by-six">
                Open 6x6 <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </>
          ) : <p className="mt-3 text-sm text-muted-foreground">No 6x6 periods have been set up yet.</p>}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel className="rise">
          <h2 className="font-display text-xl font-semibold text-[#0A2540]">Who carries {quarter}</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Accountable QBOs and key results owned this quarter.</p>
          <ul className="mt-4 divide-y divide-border/70">
            {owners.map(({ s, objs, krs }) => {
              const area = data.areas.find((a) => a.id === s.areaId);
              const lastCheckIn = ws.checkIns.filter((c) => c.authorId === s.id && krs.some((k) => k.id === c.keyResultId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
              return (
                <li key={s.id} className="flex items-center gap-3 py-2.5" data-testid={`owner-load-${s.id}`}>
                  <StaffAvatar name={s.name} url={s.avatarUrl} color={area?.color} size="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-[#0A2540]">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{lastCheckIn ? `Last check-in ${fmtDate(lastCheckIn.createdAt, 'MMM d')}` : 'No check-ins yet'}</div>
                  </div>
                  <span className="font-mono text-[12px] text-[#3A4E63]">{objs.length} QBO{objs.length === 1 ? '' : 's'} · {krs.length} KR{krs.length === 1 ? '' : 's'}</span>
                </li>
              );
            })}
            {owners.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nobody owns a {quarter} QBO or key result yet.</li>}
          </ul>
          {legacyCount > 0 && (
            <Link href={qboHref({ cycle: cycleId, view: 'legacy' })} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#8A5A00]" data-testid="link-legacy">
              {legacyCount} legacy objective{legacyCount === 1 ? '' : 's'} in this cycle <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </Panel>

        <Panel className="rise">
          <h2 className="font-display text-xl font-semibold text-[#0A2540]">Recent check-ins</h2>
          {recent.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No check-ins recorded for this view yet.</p> : (
            <ul className="mt-3 space-y-3">
              {recent.map((c) => {
                const k = ws.keyResults.find((x) => x.id === c.keyResultId);
                const a = data.staff.find((s) => s.id === c.authorId);
                return (
                  <li key={c.id} className="text-[13px]" data-testid={`recent-checkin-${c.id}`}>
                    <div className="flex items-baseline justify-between gap-2"><span className="font-semibold text-[#0A2540]">{a?.name ?? 'Former staff'}</span><span className="font-mono text-[11px] text-muted-foreground">{fmtDate(c.createdAt, 'MMM d')}</span></div>
                    <div className="truncate text-muted-foreground">{k?.title}</div>
                    <div className="line-clamp-2 text-[#1E3349]">{c.note}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {checkKr && <CheckInDialog open={!!checkKr} onOpenChange={(o) => { if (!o) setCheckKr(null); }} kr={checkKr} actions={actions}
        lastCheckIn={[...ws.checkIns].filter((c) => c.keyResultId === checkKr.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]} />}
    </>
  );
}

export default function Dashboard() {
  return <WithFoundation>{(data) => <DashboardBody data={data} />}</WithFoundation>;
}
