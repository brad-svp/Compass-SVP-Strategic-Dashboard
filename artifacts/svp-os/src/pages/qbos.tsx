import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { Plus } from 'lucide-react';
import type { Foundation } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel, StaffAvatar } from '@/components/ui-bits';
import { NativeSelect } from '@/components/native-select';
import { QuarterNarrativePanel } from '@/components/okr/quarter-narrative';
import { ObjectiveDialog } from '@/components/okr/dialogs';
import { ObjectiveRow, type Ctx } from '@/components/okr/objective-row';
import { useStaffSession } from '@/lib/session-context';
import { avgProgress, bySort, useOkrActions, useOkrWorkspace } from '@/lib/okr';
import { QUARTERS, currentQuarter, isQbo, isQuarter, qboHref } from '@/lib/qbo';
import { errorMessage, pickCurrentCycle } from '@/lib/format';
import { cn } from '@/lib/utils';

function QbosBody({ foundation }: { foundation: Foundation }) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const q = useOkrWorkspace();
  const actions = useOkrActions();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const sp = new URLSearchParams(search);
  const ownerId = sp.get('owner');
  const legacyView = sp.get('view') === 'legacy' || !!ownerId;
  const requestedCycle = sp.get('cycle');
  const defaultCycle = foundation.cycles.find(c => c.id === requestedCycle) ?? pickCurrentCycle(foundation.cycles);
  const calendarYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Los_Angeles' }).format(new Date()));
  const requestedYear = sp.get('year');
  const year = requestedYear && /^\d{4}$/.test(requestedYear) ? Number(requestedYear) : Number(defaultCycle?.startDate.slice(0, 4) ?? calendarYear);
  const cyclesInYear = foundation.cycles.filter(c => Number(c.startDate.slice(0, 4)) === year).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const cycle = cyclesInYear.find(c => c.id === requestedCycle) ?? pickCurrentCycle(cyclesInYear);
  const cycleId = cycle?.id ?? '';
  const years = [...new Set([
    ...Array.from({ length: 7 }, (_, i) => calendarYear + 1 - i),
    ...foundation.cycles.map(c => Number(c.startDate.slice(0, 4))), year,
  ])].sort((a, b) => b - a);
  const rq = sp.get('q');
  const quarter = isQuarter(rq) ? rq : currentQuarter(cycle);
  const [newOpen, setNewOpen] = useState(false);
  const staff = foundation.staff.filter((s) => s.active);

  const ws = q.data;
  const inCycle = useMemo(() => (ws ? ws.objectives.filter((o) => o.cycleId === cycleId) : []), [ws, cycleId]);
  const nav = (p: { cycle?: string; year?: string; q?: string; view?: string; owner?: string | null }) =>
    setLocation(qboHref({ cycle: cycleId, year: String(year), q: quarter, ...p }));

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !ws) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;

  const ctx: Ctx = { foundation, ws, actions, cycleId };
  const qbos = inCycle.filter(isQbo);
  const inQuarter = qbos.filter((o) => o.timeScope === quarter).sort(bySort);
  const legacy = inCycle.filter((o) => !isQbo(o));
  const legacyCompany = legacy.filter((o) => o.level === 'company').sort(bySort);
  const legacyIndividual = legacy.filter((o) => o.level === 'individual' && (!ownerId || o.ownerId === ownerId)).sort(bySort);
  const orphanIndividual = legacyIndividual.filter((o) => !legacyCompany.some((c) => c.id === o.parentObjectiveId));
  const selected = ownerId ? foundation.staff.find((s) => s.id === ownerId) : undefined;

  return (
    <>
      <PageHeader eyebrow={`${cycle?.name ?? year} · ${legacyView ? 'legacy objectives' : `${quarter} QBOs`}`}
        title={legacyView ? 'Legacy objectives.' : 'This quarter, together.'}
        actions={<>
          {cyclesInYear.length > 1 && (
            <NativeSelect value={cycleId} onChange={(e) => nav({ cycle: e.target.value, view: legacyView ? 'legacy' : undefined, owner: ownerId })} wrapClassName="w-40" aria-label="Cycle" data-testid="select-cycle">
              {cyclesInYear.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          )}
          {isAdmin && cycle && !legacyView && <Button onClick={() => setNewOpen(true)} className="bg-[#0A2540] text-white" data-testid="button-new-qbo"><Plus className="mr-1.5 h-4 w-4" />QBO</Button>}
        </>}>
        {legacyView
          ? 'Annual and individual objectives from before QBOs. Kept intact with their key results, check-ins and comments; edits are still allowed.'
          : 'Organization-wide objectives for the quarter, each with one accountable owner and measurable key results.'}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <NativeSelect value={String(year)} onChange={e => nav({ year: e.target.value, cycle: undefined, view: legacyView ? 'legacy' : undefined, owner: ownerId })}
          wrapClassName="w-36 shrink-0" aria-label="Year" data-testid="select-qbo-year">
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </NativeSelect>
        <div className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex min-w-max items-center gap-2" role="tablist">
          {QUARTERS.map((qq) => {
            const n = qbos.filter((o) => o.timeScope === qq).length;
            const active = !legacyView && qq === quarter;
            return (
              <button key={qq} role="tab" aria-selected={active} onClick={() => nav({ q: qq })} data-testid={`tab-quarter-${qq}`}
                className={cn('rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-all', active ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-border bg-card text-[#3A4E63] hover:border-[#0A2540]/40')}>
                {qq} <span className={cn('ml-1 font-mono text-[11px] font-normal', active ? 'text-white/70' : 'text-muted-foreground')}>{n}</span>
              </button>
            );
          })}
          <span className="mx-1 h-5 w-px bg-border" />
          <button role="tab" aria-selected={legacyView} onClick={() => nav({ view: 'legacy' })} data-testid="tab-legacy"
            className={cn('rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-all', legacyView ? 'border-[#ECA519] bg-[#ECA519]/15 text-[#72500A]' : 'border-dashed border-border bg-card text-[#3A4E63] hover:border-[#ECA519]/60')}>
            Legacy <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{legacy.length}</span>
          </button>
        </div>
        </div>
      </div>

      {!legacyView && <QuarterNarrativePanel cycleId={cycleId} quarter={quarter} cycleName={cycle?.name} className="rise mb-4" />}

      {!legacyView ? (
        inQuarter.length === 0 ? (
          <Panel className="rise flex flex-col items-start gap-4 border-dashed border-[#1D8BC4]/40 bg-[#1D8BC4]/[0.04] py-10">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1D8BC4]">{cycle?.name ?? year} · {quarter}</div>
            <p className="font-display text-2xl text-[#0A2540] md:text-3xl" data-testid="text-empty-qbos">No QBOs for {quarter} yet.</p>
            <p className="max-w-lg text-[14px] text-muted-foreground">
              {!cycle ? `No planning cycle has been set up for ${year}. An admin can add one under Admin → Cycles.` : isAdmin ? 'Three to seven organization-wide objectives keep a six-person team pointed the same way.' : 'An admin sets the QBOs for each quarter. Legacy objectives are still available in the legacy view.'}
            </p>
            {isAdmin && cycle && <Button onClick={() => setNewOpen(true)} className="bg-[#0A2540] text-white" data-testid="button-empty-new-qbo"><Plus className="mr-1.5 h-4 w-4" />Add a {quarter} QBO</Button>}
          </Panel>
        ) : (
          <div className="space-y-3">{inQuarter.map((o, i) => <ObjectiveRow key={o.id} o={o} ctx={ctx} siblings={inQuarter} index={i} />)}</div>
        )
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#3A4E63]">Individual owner</span>
            <NativeSelect value={ownerId ?? ''} onChange={(e) => nav({ view: 'legacy', owner: e.target.value || null })} wrapClassName="w-48" aria-label="Owner" data-testid="select-legacy-owner">
              <option value="">Everyone</option>
              {staff.map((s) => {
                const objs = legacy.filter((o) => o.level === 'individual' && o.ownerId === s.id);
                const p = avgProgress(objs, ws.keyResults);
                return <option key={s.id} value={s.id}>{s.name} ({objs.length}{p != null ? `, ${p}%` : ''})</option>;
              })}
            </NativeSelect>
            {selected && <span className="flex items-center gap-2 text-[13px] text-[#0A2540]"><StaffAvatar name={selected.name} url={selected.avatarUrl} size="h-6 w-6" />{selected.name}</span>}
          </div>
          {legacy.length === 0 && (
            <Panel className="border-dashed text-[14px] text-muted-foreground" data-testid="text-empty-legacy">No legacy objectives in this cycle.</Panel>
          )}
          {!ownerId && legacyCompany.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-semibold text-[#0A2540]">Annual company objectives</h2>
              <div className="space-y-3">{legacyCompany.map((o, i) => <ObjectiveRow key={o.id} o={o} ctx={ctx} siblings={legacyCompany} index={i} />)}</div>
            </section>
          )}
          {legacyIndividual.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-semibold text-[#0A2540]">Individual objectives</h2>
              <div className="space-y-6">
                {inCycle.filter((c) => c.level === 'company').sort(bySort).map((c) => {
                  const mine = legacyIndividual.filter((o) => o.parentObjectiveId === c.id);
                  if (!mine.length) return null;
                  return (
                    <div key={c.id}>
                      <Link href={`/qbos/${c.id}`} className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#3A4E63] hover:text-[#1D8BC4]" data-testid={`link-parent-${c.id}`}>
                        <span className="h-px w-6 bg-[#ECA519]" /> Supports: <span className="normal-case tracking-normal text-[#0A2540]">{c.title}</span>
                      </Link>
                      <div className="space-y-3">{mine.map((o, i) => <ObjectiveRow key={o.id} o={o} ctx={ctx} siblings={mine} index={i} showOwner={!ownerId} />)}</div>
                    </div>
                  );
                })}
                {orphanIndividual.filter((o) => !inCycle.some((c) => c.id === o.parentObjectiveId)).map((o, i, arr) => <ObjectiveRow key={o.id} o={o} ctx={ctx} siblings={arr} index={i} showOwner={!ownerId} />)}
              </div>
            </section>
          )}
          {ownerId && legacyIndividual.length === 0 && (
            <Panel className="border-dashed text-[14px] text-muted-foreground">No legacy individual objectives for {selected?.name ?? 'this person'} in this cycle.</Panel>
          )}
        </div>
      )}

      {isAdmin && <ObjectiveDialog open={newOpen} onOpenChange={setNewOpen} foundation={foundation} objectives={ws.objectives} cycleId={cycleId} actions={actions} quarter={quarter} />}
    </>
  );
}

export default function Qbos() {
  return <WithFoundation>{(data) => <QbosBody foundation={data} />}</WithFoundation>;
}
