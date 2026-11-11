import type { Foundation } from '@workspace/api-client-react';
import { WithFoundation } from '@/components/with-foundation';
import { PageHeader, Panel, StaffAvatar } from '@/components/ui-bits';
import { useStaffSession } from '@/lib/session-context';

function TeamBody({ data }: { data: Foundation }) {
  const me = useStaffSession();
  const areas = [...data.areas].sort((a, b) => a.sortOrder - b.sortOrder);
  const visible = data.staff.filter((s) => s.active || me.role === 'admin');

  return (
    <>
      <PageHeader eyebrow="Team & Ownership" title="Who carries what.">
        Each teammate's area and role, as written by the team. Admins keep this current.
      </PageHeader>
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
    </>
  );
}

export default function Team() {
  return <WithFoundation>{(data) => <TeamBody data={data} />}</WithFoundation>;
}
