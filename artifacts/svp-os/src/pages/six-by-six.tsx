import { useMemo, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, LocateFixed } from 'lucide-react';
import type { Foundation, SixItem, SixPeriod, SixWorkspace } from '@workspace/api-client-react';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel } from '@/components/ui-bits';
import { useStaffSession } from '@/lib/session-context';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, fmtDate } from '@/lib/format';
import {
  actualPeriodIndex, adjacentDraft, resolveAnchor, sortPeriods, todayIso, useSixActions, useSixWorkspace,
} from '@/lib/six-by-six';
import { MissingPeriod, PeriodAccordion, type Slot } from '@/components/six-by-six/period-accordion';
import { PersonPlan, priorityLabel } from '@/components/six-by-six/person-plan';
import { EmptySelection, SixViewControls } from '@/components/six-by-six/view-controls';
import { selectPeople, useSixViewPreferences } from '@/lib/six-view-prefs';
import { ItemDialog, type ItemTarget } from '@/components/six-by-six/item-dialog';
import { PeriodDialog, type PeriodTarget } from '@/components/six-by-six/period-dialog';

const navBtn = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-[#0A2540] transition-colors hover:bg-[#0A2540]/[0.04] disabled:cursor-not-allowed disabled:opacity-40';

function Board({ foundation, ws }: { foundation: Foundation; ws: SixWorkspace }) {
  const actor = useStaffSession();
  const isAdmin = actor.role === 'admin';
  const actions = useSixActions();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const today = todayIso();

  const sorted = useMemo(() => sortPeriods(ws.periods), [ws.periods]);
  const requested = new URLSearchParams(search).get('period');
  const anchorIdx = resolveAnchor(sorted, requested, today);
  const actualIdx = actualPeriodIndex(sorted, today);
  const anchor = sorted[anchorIdx] ?? null;
  const prev = anchorIdx > 0 ? sorted[anchorIdx - 1] : null;
  const next = anchorIdx >= 0 && anchorIdx < sorted.length - 1 ? sorted[anchorIdx + 1] : null;
  const actual = sorted[actualIdx] ?? null;
  const anchorId = anchor?.id ?? '';

  // Middle expanded on each anchor change; independent toggles survive polling.
  const [openState, setOpenState] = useState<{ anchor: string; map: Record<string, boolean> }>({ anchor: '', map: {} });
  const openMap = openState.anchor === anchorId ? openState.map : { [anchorId]: true };
  const toggle = (id: string) => setOpenState({ anchor: anchorId, map: { ...openMap, [id]: !openMap[id] } });

  const [itemT, setItemT] = useState<ItemTarget | null>(null);
  const prefs = useSixViewPreferences(actor);
  const [periodT, setPeriodT] = useState<PeriodTarget | null>(null);

  const go = (p: SixPeriod | null) => { if (p) navigate(`${location}?period=${encodeURIComponent(p.id)}`); };

  function reopenItem() {
    if (!itemT) return;
    const latest = itemT.item ? ws.items.find((i) => i.id === itemT.item!.id) : null;
    if (itemT.item && !latest) { toast({ title: 'Item no longer exists', description: 'Someone removed it in the meantime.' }); setItemT(null); return; }
    setItemT({ ...itemT, item: latest ?? null, nonce: itemT.nonce + 1 });
  }
  function reopenPeriod() {
    if (!periodT?.period) { setPeriodT(null); return; }
    const p = ws.periods.find((x) => x.id === periodT.period!.id);
    if (p) setPeriodT({ ...periodT, period: p, nonce: periodT.nonce + 1 }); else setPeriodT(null);
  }
  const addPeriod = (dir: 'prev' | 'next', ref: SixPeriod | null) => setPeriodT({ period: null, draft: adjacentDraft(dir, ref, today), nonce: 0 });

  const momentLabel = (p: SixPeriod, momentId: string) => {
    const m = p.moments.find((x) => x.id === momentId);
    return m ? priorityLabel(m.position) : 'Other item';
  };
  const shownIds = [prev?.id, anchorId, next?.id].filter(Boolean) as string[];
  const people = prefs.pref ? selectPeople(prefs.pref, foundation.staff, ws.items, actor, shownIds) : [];

  function renderPeriod(slot: Slot, p: SixPeriod) {
    const items = ws.items.filter((i) => i.periodId === p.id);
    return (
      <PeriodAccordion key={p.id} slot={slot} period={p} items={items} open={!!openMap[p.id]} onToggle={() => toggle(p.id)}
        isActual={p.startDate.slice(0, 10) <= today && today <= p.endDate.slice(0, 10)}
        isAdmin={isAdmin} onEdit={() => setPeriodT({ period: p, draft: adjacentDraft('next', p, today), nonce: 0 })}>
        {!prefs.pref ? <div className="h-24 animate-pulse rounded-xl bg-[#0A2540]/[0.05] m-4" /> : people.length === 0 ? <div className="p-4"><EmptySelection /></div> : (
          <div className="divide-y divide-border/70">
            {people.map((person) => (
              <PersonPlan key={person.id} period={p} items={items} person={person} areas={foundation.areas} actor={actor}
                onOpenItem={(item: SixItem) => setItemT({ item, momentId: item.momentId, ownerId: item.ownerId, momentLabel: momentLabel(p, item.momentId), periodName: p.name, nonce: 0 })}
                onAddItem={(m) => setItemT({ item: null, momentId: m.id, ownerId: person.id, momentLabel: priorityLabel(m.position), periodName: p.name, nonce: 0 })} />
            ))}
          </div>
        )}
      </PeriodAccordion>
    );
  }

  const viewingActual = anchor && actual && anchor.id === actual.id;
  const actualContainsToday = actual ? actual.startDate.slice(0, 10) <= today && today <= actual.endDate.slice(0, 10) : false;
  let honesty = '';
  if (anchor) {
    if (viewingActual) honesty = actualContainsToday ? 'You are looking at the period running today.' : 'No period covers today; showing the closest one on record.';
    else honesty = anchor.endDate.slice(0, 10) < today ? 'You are looking back at a past period. Edits still save.' : 'You are looking ahead at a future period.';
  }

  return (
    <>
      <PageHeader eyebrow="6x6 · Six weeks, six priorities" title="Six weeks, six priorities."
        actions={isAdmin && sorted.length > 0 && (
          <button type="button" className={navBtn} onClick={() => addPeriod('next', sorted[sorted.length - 1])} data-testid="button-new-period">
            <CalendarPlus className="h-4 w-4" /> New period
          </button>
        )}>
        Each person names their own six priorities for the period. Everyone can view all plans. Any period, past or future, stays editable.
      </PageHeader>

      {!anchor ? (
        <Panel className="rise flex flex-col items-start gap-4 py-10" >
          <CalendarDays className="h-8 w-8 text-[#1D8BC4]" />
          <div className="font-display text-2xl font-semibold text-[#0A2540]">No 6x6 periods yet.</div>
          <p className="max-w-md text-sm text-muted-foreground">
            {isAdmin ? 'Start the first six-week period. Everyone gets six empty priority slots to fill.' : 'An admin will open the first six-week period. Check back soon.'}
          </p>
          {isAdmin && (
            <button type="button" onClick={() => addPeriod('next', null)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0A2540] px-4 text-sm font-semibold text-[#FBFAF6]" data-testid="button-create-first-period">
              <CalendarPlus className="h-4 w-4" /> Create first period
            </button>
          )}
        </Panel>
      ) : (
        <>
          <div className="rise mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border bg-[#F6F3EC]/70 px-4 py-3">
            <div className="text-[13px] text-[#3A4E63]" data-testid="text-date-context">
              <span className="font-semibold text-[#0A2540]">Today is {fmtDate(today)}.</span> {honesty}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={navBtn} disabled={!prev} onClick={() => go(prev)} data-testid="button-period-back"><ArrowLeft className="h-4 w-4" /> Back</button>
              <button type="button" className={navBtn} disabled={!!viewingActual} onClick={() => go(actual)} data-testid="button-period-current"><LocateFixed className="h-4 w-4" /> Current</button>
              <button type="button" className={navBtn} disabled={!next} onClick={() => go(next)} data-testid="button-period-next">Next <ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
          <SixViewControls prefs={prefs} staff={foundation.staff} actor={actor} shown={people} />
          <div className="space-y-3">
            {prev ? renderPeriod('previous', prev) : <MissingPeriod slot="previous" isAdmin={isAdmin} onAdd={() => addPeriod('prev', anchor)} />}
            {renderPeriod('viewing', anchor)}
            {next ? renderPeriod('next', next) : <MissingPeriod slot="next" isAdmin={isAdmin} onAdd={() => addPeriod('next', anchor)} />}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">Period {anchorIdx + 1} of {sorted.length}.</p>
        </>
      )}

      <ItemDialog target={itemT} staff={foundation.staff} actor={actor} actions={actions} onClose={() => setItemT(null)} onReopen={reopenItem} />
      <PeriodDialog target={periodT} all={ws.periods} actions={actions} onClose={() => setPeriodT(null)} onReopen={reopenPeriod}
        onCreated={(id) => { if (sorted.length === 0) navigate(`${location}?period=${encodeURIComponent(id)}`); }} />
    </>
  );
}

function SixBySixData({ foundation }: { foundation: Foundation }) {
  const q = useSixWorkspace();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <Board foundation={foundation} ws={q.data} />;
}

export default function SixBySix() {
  return <WithFoundation>{(data) => <SixBySixData foundation={data} />}</WithFoundation>;
}
