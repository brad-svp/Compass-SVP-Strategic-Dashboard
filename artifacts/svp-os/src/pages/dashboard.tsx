import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, CalendarDays, Target } from 'lucide-react';
import type { Foundation, KeyResult } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel, StaffAvatar, StatusPill } from '@/components/ui-bits';
import { HealthDot, ProgressTrack } from '@/components/okr/bits';
import { CheckInDialog } from '@/components/okr/dialogs';
import { useStaffSession } from '@/lib/session-context';
import { avgProgress, bySort, krValueLabel, useOkrActions, useOkrWorkspace } from '@/lib/okr';
import { errorMessage, fmtDate, pickCurrentCycle } from '@/lib/format';

const ALL = 'all';

function DashboardBody({ data }: { data: Foundation }) {
  const me = useStaffSession();
  const q = useOkrWorkspace();
  const actions = useOkrActions();
  const [cycleId, setCycleId] = useState(() => pickCurrentCycle(data.cycles)?.id ?? '');
  const [areaId, setAreaId] = useState(ALL);
  const [personId, setPersonId] = useState(ALL);
  const [checkKr, setCheckKr] = useState<KeyResult | null>(null);

  const cycle = data.cycles.find((c) => c.id === cycleId);
  const staff = data.staff.filter((s) => s.active);
  const period = data.periods.find((p) => p.status === 'active') ?? data.periods[0];
  const first = me.name.split(' ')[0];

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const ws = q.data;

  const objs = ws.objectives.filter((o) => o.cycleId === cycleId && (areaId === ALL || o.areaId === areaId) && (personId === ALL || o.ownerId === personId));
  const company = ws.objectives.filter((o) => o.cycleId === cycleId && o.level === 'company' &&
    (objs.some(match => match.id === o.id) || objs.some(match => match.parentObjectiveId === o.id))).sort(bySort);
  const individual = objs.filter((o) => o.level === 'individual');
  const companyAvg = avgProgress(company, ws.keyResults);
  const cycleObjIds = new Set(ws.objectives.filter((o) => o.cycleId === cycleId).map((o) => o.id));
  const myKrs = ws.keyResults.filter((k) => k.ownerId === me.id && k.canEdit && cycleObjIds.has(k.objectiveId))
    .sort((a, b) => (a.lastCheckInAt ?? '').localeCompare(b.lastCheckInAt ?? ''));
  const people = staff.filter((s) => (areaId === ALL || s.areaId === areaId) && (personId === ALL || s.id === personId));
  const recent = [...ws.checkIns].filter((c) => { const k = ws.keyResults.find((x) => x.id === c.keyResultId); return k && objs.some((o) => o.id === k.objectiveId); })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const counts = { green: 0, yellow: 0, red: 0 } as Record<string, number>;
  company.forEach((o) => { if (ws.keyResults.some((k) => k.objectiveId === o.id) && o.health in counts) counts[o.health]++; });

  return (
    <>
      <PageHeader eyebrow={cycle ? `${cycle.name} · ${fmtDate(cycle.startDate, 'MMM d')} to ${fmtDate(cycle.endDate)}` : 'No cycle yet'} title={`Good to see you, ${first}.`}
        actions={<>
          {cycle && <StatusPill status={cycle.status} label={cycle.status} />}
          <Link href={`/okrs?owner=${me.id}&cycle=${cycleId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2540] px-3.5 text-[13px] font-semibold text-white hover:bg-[#0A2540]/90" data-testid="link-my-okrs">
            <Target className="h-4 w-4" /> My OKRs
          </Link>
        </>}>
        Where Sacramento's commitments stand today, and what is waiting on you.
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={cycleId} onValueChange={setCycleId}>
          <SelectTrigger className="bg-card" data-testid="filter-cycle"><SelectValue placeholder="Cycle" /></SelectTrigger>
          <SelectContent>{data.cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={areaId} onValueChange={setAreaId}>
          <SelectTrigger className="bg-card" data-testid="filter-area"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All areas</SelectItem>{data.areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={personId} onValueChange={setPersonId}>
          <SelectTrigger className="bg-card" data-testid="filter-person"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Everyone</SelectItem>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

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
              <h2 className="font-display text-2xl font-semibold text-[#0A2540]">Company objectives</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">Average includes objectives without key results as 0%.</p>
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
              <div className="font-display text-lg text-[#0A2540]">{ws.objectives.some(o => o.cycleId === cycleId && o.level === 'company') ? 'No objectives match these filters.' : 'Start by adding your company objectives.'}</div>
              <Link href={`/okrs?cycle=${cycleId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1D8BC4]" data-testid="link-okrs-empty">Open OKRs <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {company.map((o) => {
                const m = ws.keyResults.some((k) => k.objectiveId === o.id);
                const sup = ws.objectives.filter((c) => c.parentObjectiveId === o.id).length;
                return (
                  <li key={o.id}>
                    <Link href={`/okrs/${o.id}`} className="group block rounded-xl px-2 py-2 transition-colors hover:bg-[#0A2540]/[0.03]" data-testid={`dash-objective-${o.id}`}>
                      <div className="flex items-center gap-2">
                        <HealthDot health={m ? o.health : 'none'} />
                        <span className="flex-1 truncate text-[14px] font-semibold text-[#0A2540] group-hover:text-[#1D8BC4]">{o.title}</span>
                        <span className="font-mono text-[12px] tabular-nums">{m ? `${Math.round(o.progress)}%` : 'no KRs'}</span>
                      </div>
                      <ProgressTrack value={o.progress} expected={o.expectedProgress} health={o.health} measured={m} className="mt-2" />
                      <div className="mt-1 text-[11px] text-muted-foreground">{sup} supporting objective{sup === 1 ? '' : 's'}</div>
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
          <h2 className="font-display text-xl font-semibold text-[#0A2540]">Staff progress</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Individual objectives this cycle; objectives without key results count as 0%.</p>
          <ul className="mt-4 divide-y divide-border/70">
            {people.map((s) => {
              const mine = individual.filter((o) => o.ownerId === s.id);
              const p = avgProgress(mine, ws.keyResults);
              const area = data.areas.find((a) => a.id === s.areaId);
              const health = mine.some((o) => o.health === 'red') ? 'red' : mine.some((o) => o.health === 'yellow') ? 'yellow' : mine.some(o => o.health === 'green') ? 'green' : 'none';
              const lastCheckIn = ws.checkIns.filter(c => c.authorId === s.id && ws.keyResults.some(k => k.id === c.keyResultId && cycleObjIds.has(k.objectiveId)))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
              return (
                <li key={s.id}>
                  <Link href={`/okrs?owner=${s.id}&cycle=${cycleId}`} className="flex items-center gap-3 py-2.5 hover:bg-[#0A2540]/[0.02]" data-testid={`staff-progress-${s.id}`}>
                    <StaffAvatar name={s.name} url={s.avatarUrl} color={area?.color} size="h-8 w-8" />
                    <div className="w-32 min-w-0 shrink-0 sm:w-44">
                      <div className="truncate text-[14px] font-semibold text-[#0A2540]">{s.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{mine.length} objective{mine.length === 1 ? '' : 's'} · {area?.name}</div>
                      <div className="text-[11px] text-muted-foreground">{lastCheckIn ? `Last check-in ${fmtDate(lastCheckIn.createdAt, 'MMM d')}` : 'No check-ins yet'}</div>
                    </div>
                    <ProgressTrack value={p ?? 0} health={health} measured={p != null} className="flex-1" />
                    <span className="w-10 text-right font-mono text-[12px] tabular-nums">{p != null ? `${p}%` : '--'}</span>
                  </Link>
                </li>
              );
            })}
            {people.length === 0 && <li className="py-3 text-sm text-muted-foreground">No staff match these filters.</li>}
          </ul>
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
