import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import type { Area, SixItem, SixMoment, Staff } from '@workspace/api-client-react';
import { ErrorPanel, Panel } from '@/components/ui-bits';
import { PersonPlan, priorityLabel } from '@/components/six-by-six/person-plan';
import { ItemDialog, type ItemTarget } from '@/components/six-by-six/item-dialog';
import { todayIso, useSixActions, useSixWorkspace } from '@/lib/six-by-six';
import { errorMessage, fmtDate } from '@/lib/format';
import { myItemsIn, periodCovering } from './dashboard-helpers';


export function MySixPanel({ me, staff, areas }: { me: Staff; staff: Staff[]; areas: Area[] }) {
  const q = useSixWorkspace();
  const actions = useSixActions();
  const [target, setTarget] = useState<ItemTarget | null>(null);
  const today = todayIso();

  return (
    <Panel className="rise mb-5 border-[#1D8BC4]/25 !p-0" data-testid="panel-my-six">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[#ECA519]" />
          <h2 className="font-display text-2xl font-semibold text-[#0A2540]">My 6x6</h2>
        </div>
      </div>
      {q.isLoading ? (
        <div className="grid gap-2 p-5 md:grid-cols-2" data-testid="loading-my-six">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[#0A2540]/[0.05]" />)}</div>
      ) : q.isError || !q.data ? (
        <div className="p-4"><ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div>
      ) : (() => {
        const period = periodCovering(q.data.periods, today);
        if (!period) return (
          <div className="m-5 rounded-xl border border-dashed border-[#1D8BC4]/40 bg-[#1D8BC4]/[0.05] p-5" data-testid="empty-my-six">
            <div className="font-display text-lg text-[#0A2540]">No 6x6 period covers today.</div>
            <p className="mt-1 text-[13px] text-muted-foreground">Set up or adjust the current period on the 6x6 page.</p>
          </div>
        );
        const items = myItemsIn(q.data.items, period.id, me.id);
        const open = (item: SixItem | null, slot: SixMoment, ownerId: string) => setTarget({ item, momentId: slot.id, ownerId: item?.ownerId ?? ownerId, momentLabel: slot.position ? priorityLabel(slot.position) : 'Other item', periodName: period.name, nonce: Date.now() });
        return (
          <>
            <div className="px-4 pt-3 font-mono text-[11px] text-muted-foreground md:px-5" data-testid="text-six-period">{period.name} · {fmtDate(period.startDate, 'MMM d')} to {fmtDate(period.endDate, 'MMM d')}</div>
            <PersonPlan period={period} items={items} person={me} areas={areas} actor={me} onOpenItem={(it, s) => open(it, s, me.id)} onAddItem={(s) => open(null, s, me.id)} />
          </>
        );
      })()}
      <Link href="/six-by-six" className="flex h-11 w-full items-center justify-center gap-1.5 rounded-b-2xl border-t border-border/70 bg-[#0A2540]/[0.03] text-[13.5px] font-semibold text-[#0A2540] transition-colors hover:bg-[#1D8BC4]/10 hover:text-[#125F88]" data-testid="link-view-all-six">
        View all 6x6 priorities <ArrowUpRight className="h-4 w-4" />
      </Link>
      <ItemDialog target={target} staff={staff} actor={me} actions={actions} onClose={() => setTarget(null)}
        onReopen={() => setTarget((t) => { if (!t) return t; const fresh = t.item ? q.data?.items.find((i) => i.id === t.item!.id) ?? null : null; return { ...t, item: fresh, nonce: Date.now() }; })} />
    </Panel>
  );
}
