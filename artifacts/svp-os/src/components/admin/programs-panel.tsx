import { useMemo, useState } from 'react';
import { Layers, Settings2 } from 'lucide-react';
import { ErrorPanel, Panel } from '@/components/ui-bits';
import { ProgramManager } from '@/components/calendar/program-manager';
import { ProgramMark } from '@/components/calendar/program-mark';
import { useMasterCalendar, useProgramActions } from '@/lib/calendar-hooks';
import { errorMessage } from '@/lib/format';

/** Admin view of the single canonical program catalog (calendar_programs). Editing reuses ProgramManager. */
export function ProgramsPanel() {
  const q = useMasterCalendar();
  const actions = useProgramActions();
  const [open, setOpen] = useState(false);
  const programs = useMemo(() => q.data?.programs ?? [], [q.data?.programs]);
  const sorted = useMemo(() => [...programs].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)), [programs]);
  const activeCount = programs.filter((p) => p.active).length;

  if (q.isLoading) {
    return (
      <Panel data-testid="programs-loading">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-[#0A2540]/[0.07]" />
        {[0, 1, 2, 3].map((i) => <div key={i} className="mb-2 h-12 animate-pulse rounded-lg bg-[#0A2540]/[0.05]" />)}
      </Panel>
    );
  }
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold text-[#0A2540]">Programs</h2>
            <span className="rounded-full bg-[#1D8BC4]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1D8BC4]" data-testid="text-programs-shared">Shared across calendar and Brain</span>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            One list. Calendar events and Brain entries both pick from it, so a rename or new logo shows up in both. Retired programs stay on past records but are hidden from new choices. Operating areas are separate and managed under Areas.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2540] px-3.5 text-[13px] font-semibold text-[#FBFAF6]" data-testid="button-admin-manage-programs">
          <Settings2 className="h-4 w-4" /> Manage programs
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-8" data-testid="empty-programs">
          <Layers className="h-6 w-6 text-[#1D8BC4]" />
          <div className="font-semibold text-[#0A2540]">No programs yet.</div>
          <p className="text-[13px] text-muted-foreground">Add Think Tank, 100x, Fast Pitch and the rest so events and Brain entries can be tagged consistently.</p>
          <button type="button" onClick={() => setOpen(true)} className="mt-1 text-[13px] font-semibold text-[#1D8BC4] hover:underline" data-testid="button-add-first-program">Add the first program</button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-[12px] text-muted-foreground" data-testid="text-program-counts">{activeCount} active · {programs.length - activeCount} retired</div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {sorted.map((p) => (
              <li key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${p.active ? '' : 'opacity-60'}`} data-testid={`row-program-${p.id}`}>
                <ProgramMark name={p.name} logoUrl={p.logoUrl} size={28} />
                <span className="min-w-0 flex-1 truncate font-semibold text-[#0A2540]">{p.name}</span>
                <span className="hidden text-[12px] tabular-nums text-muted-foreground sm:inline">{p.eventCount} {p.eventCount === 1 ? 'event' : 'events'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.active ? 'bg-[#49B949]/14 text-[#22702A]' : 'bg-[#0A2540]/[0.06] text-[#3A4E63]'}`}>{p.active ? 'Active' : 'Retired'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <ProgramManager open={open} onClose={() => setOpen(false)} programs={programs} actions={actions} />
    </Panel>
  );
}
