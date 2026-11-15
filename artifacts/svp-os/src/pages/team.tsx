import { useState } from 'react';
import {
  getGetAccountabilityQueryKey,
  useGetAccountability,
  type AccountabilitySeat,
  type Foundation,
} from '@workspace/api-client-react';
import { Plus } from 'lucide-react';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, Panel, StaffAvatar } from '@/components/ui-bits';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountabilityChart, DeleteSeatDialog, SeatEditor, useSeatActions } from '@/components/accountability-chart';
import { useStaffSession } from '@/lib/session-context';
import { errorMessage } from '@/lib/format';
import { cn } from '@/lib/utils';

function ChartSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-card-border bg-card p-6" data-testid="loading-chart">
      <Skeleton className="mx-auto h-10 w-64 bg-[#0A2540]/8" />
      <div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-40 bg-[#0A2540]/6" /><Skeleton className="h-40 bg-[#0A2540]/6" /></div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 bg-[#0A2540]/6" />)}</div>
    </div>
  );
}

function Directory({ data, isAdmin }: { data: Foundation; isAdmin: boolean }) {
  const areas = [...data.areas].sort((a, b) => a.sortOrder - b.sortOrder);
  const visible = data.staff.filter((s) => s.active || isAdmin);
  return (
    <div className="space-y-8">
      {areas.map((area) => {
        const people = visible.filter((s) => s.areaId === area.id);
        return (
          <section key={area.id} className="rise" data-testid={`section-area-${area.id}`}>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: area.color }} />
              <h2 className="font-display text-xl font-semibold text-[#0A2540]">{area.name}</h2>
              <span className="text-sm text-muted-foreground">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
            </div>
            {people.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No one is assigned to this area yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {people.map((s) => (
                  <Panel key={s.id} className="lift relative overflow-hidden">
                    <span className="absolute inset-y-0 left-0 w-1" style={{ background: area.color }} />
                    <div className="flex items-start gap-4">
                      <StaffAvatar name={s.name} url={s.avatarUrl} color={area.color} size="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#0A2540]" data-testid={`text-staff-name-${s.id}`}>{s.name}</span>
                          {s.role === 'admin' && <span className="rounded bg-[#0A2540] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Admin</span>}
                          {!s.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Inactive</span>}
                        </div>
                        <p className="mt-2 text-[14px] leading-relaxed text-[#3A4E63]">
                          {s.roleDescription || <span className="italic text-muted-foreground">Role description not written yet.</span>}
                        </p>
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TeamBody({ data }: { data: Foundation }) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const [view, setView] = useState<'chart' | 'directory'>('chart');
  const q = useGetAccountability({ query: { queryKey: getGetAccountabilityQueryKey(), refetchInterval: 30_000, refetchOnWindowFocus: true } });
  const actions = useSeatActions();
  const [editing, setEditing] = useState<{ seat: AccountabilitySeat | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<AccountabilitySeat | null>(null);
  const seats = q.data ?? [];

  const openNew = () => setEditing({ seat: null, key: Date.now() });

  return (
    <>
      <PageHeader
        eyebrow="Team & Ownership"
        title="Who carries what."
        actions={isAdmin && view === 'chart' ? (
          <Button onClick={openNew} className="bg-[#0A2540] hover:bg-[#0A2540]/90" data-testid="button-add-seat"><Plus className="mr-1.5 h-4 w-4" />Add seat</Button>
        ) : undefined}
      >
        The 2027 accountability chart: every seat, who sits in it, and what they own. {isAdmin ? 'You can edit any seat.' : 'Admins keep this current.'}
      </PageHeader>

      <div className="mb-5 inline-flex rounded-lg border border-border bg-card p-1" role="tablist">
        {(['chart', 'directory'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} data-testid={`tab-${v}`}
            className={cn('rounded-md px-4 py-1.5 text-sm font-semibold transition-colors', view === v ? 'bg-[#0A2540] text-white' : 'text-[#3A4E63] hover:text-[#0A2540]')}>
            {v === 'chart' ? 'Accountability chart' : 'Team directory'}
          </button>
        ))}
      </div>

      {view === 'directory' ? <Directory data={data} isAdmin={isAdmin} /> : q.isLoading ? <ChartSkeleton /> : q.isError ? (
        <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : seats.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 border-dashed py-14 text-center" >
          <div className="font-display text-2xl text-[#0A2540]">No seats on the chart yet.</div>
          <p className="max-w-md text-sm text-muted-foreground">Start with the Board, then the Visionary and Integrator, then the functions that report to them.</p>
          {isAdmin && <Button onClick={openNew} data-testid="button-add-first-seat"><Plus className="mr-1.5 h-4 w-4" />Add the first seat</Button>}
        </Panel>
      ) : (
        <>
          {q.isRefetching && <div className="sr-only">Refreshing</div>}
          <AccountabilityChart seats={seats} staff={data.staff} isAdmin={isAdmin}
            onEdit={(s) => setEditing({ seat: s, key: Date.now() })} onDelete={setDeleting} />
        </>
      )}

      {editing && isAdmin && (
        <SeatEditor key={editing.key} seat={editing.seat} seats={seats} staff={data.staff} open onClose={() => setEditing(null)} actions={actions} />
      )}
      {isAdmin && <DeleteSeatDialog seat={deleting} seats={seats} onClose={() => setDeleting(null)} actions={actions} />}
    </>
  );
}

export default function Team() {
  return <WithFoundation>{(data) => <TeamBody data={data} />}</WithFoundation>;
}
