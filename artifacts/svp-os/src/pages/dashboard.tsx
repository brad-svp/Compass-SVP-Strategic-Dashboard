import { Link } from 'wouter';
import { ArrowUpRight, Target, CalendarDays } from 'lucide-react';
import type { Foundation } from '@workspace/api-client-react';
import { WithFoundation } from '@/components/with-foundation';
import { NextPhaseTag, PageHeader, Panel, StaffAvatar, StatusPill } from '@/components/ui-bits';
import { useStaffSession } from '@/lib/session-context';
import { areaById, fmtDate, pickCurrentCycle } from '@/lib/format';

function DashboardBody({ data }: { data: Foundation }) {
  const me = useStaffSession();
  const cycle = pickCurrentCycle(data.cycles);
  const staff = data.staff.filter((s) => s.active);
  const period = data.periods[0];
  const first = me.name.split(' ')[0];

  return (
    <>
      <PageHeader eyebrow={cycle ? `Cycle · ${fmtDate(cycle.startDate, 'MMM d')} to ${fmtDate(cycle.endDate)}` : 'No cycle yet'} title={`Good to see you, ${first}.`}
        actions={cycle && <StatusPill status={cycle.status} label={`${cycle.name} · ${cycle.status}`} />}>
        Here is where the team stands in the foundation phase. Objectives arrive next; ownership and rhythm are ready now.
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel className="rise relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#0A2540]">Company objectives</h2>
              <p className="mt-1 text-sm text-muted-foreground">{cycle ? cycle.name : 'Selected cycle'}</p>
            </div>
            <NextPhaseTag />
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-[#1D8BC4]/40 bg-[#1D8BC4]/[0.05] p-6" data-testid="empty-objectives">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-[#1D8BC4] text-white"><Target className="h-5 w-5" /></div>
            <div className="font-display text-lg text-[#0A2540]">No objectives have been set for this cycle.</div>
            <ol className="mt-3 space-y-1.5 text-[14px] text-[#3A4E63]">
              <li><span className="font-semibold text-[#1D8BC4]">1.</span> Confirm staff, areas and the active cycle in Admin.</li>
              <li><span className="font-semibold text-[#1D8BC4]">2.</span> Draft three to five company objectives together.</li>
              <li><span className="font-semibold text-[#1D8BC4]">3.</span> Add key results and weekly check-ins once OKR tools open.</li>
            </ol>
            <button disabled className="mt-5 cursor-not-allowed rounded-lg border border-border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground" data-testid="button-add-objective-disabled">
              Add objective · coming next phase
            </button>
          </div>
        </Panel>

        <Panel className="rise" >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-[#0A2540]">Current 6x6</h2>
            <CalendarDays className="h-5 w-5 text-[#ECA519]" />
          </div>
          {period ? (
            <>
              <div className="mt-1 text-sm text-muted-foreground">{period.name} · {fmtDate(period.startDate, 'MMM d')} to {fmtDate(period.endDate, 'MMM d')}</div>
              <ul className="mt-4 space-y-2">
                {[...period.moments].sort((a, b) => a.position - b.position).map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-[14px]" data-testid={`moment-${m.id}`}>
                    <span className="font-mono text-[11px] text-[#B03E71]">{String(m.position).padStart(2, '0')}</span>
                    <span className="flex-1 font-medium text-[#0A2540]">{m.title}</span>
                    {m.eventDate && <span className="text-[12px] text-muted-foreground">{fmtDate(m.eventDate, 'MMM d')}</span>}
                  </li>
                ))}
                {period.moments.length === 0 && <li className="text-sm text-muted-foreground">No major moments recorded yet.</li>}
              </ul>
              <Link href="/six-by-six" className="group mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1D8BC4]" data-testid="link-six-by-six">
                Open period preview <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No 6x6 periods have been set up yet.</p>
          )}
        </Panel>
      </div>

      <Panel className="rise mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-[#0A2540]">Team overview</h2>
          <Link href="/team" className="text-sm font-semibold text-[#1D8BC4] hover:underline" data-testid="link-team">See roles</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => {
            const area = areaById(data.areas, s.areaId);
            return (
              <div key={s.id} className="lift flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3" data-testid={`card-staff-${s.id}`}>
                <StaffAvatar name={s.name} url={s.avatarUrl} color={area?.color} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#0A2540]">{s.name}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{area?.name ?? 'No area'}</div>
                </div>
                <span className="ml-auto text-[11px] text-muted-foreground">0 objectives</span>
              </div>
            );
          })}
          {staff.length === 0 && <p className="text-sm text-muted-foreground">No active staff yet. An admin can add teammates in Admin.</p>}
        </div>
      </Panel>
    </>
  );
}

export default function Dashboard() {
  return <WithFoundation>{(data) => <DashboardBody data={data} />}</WithFoundation>;
}
