import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WithFoundation } from '@/components/with-foundation';
import { AccessDenied } from '@/components/access-denied';
import { PageHeader, Panel } from '@/components/ui-bits';
import { StaffPanel } from '@/components/admin/staff-panel';
import { AreasPanel } from '@/components/admin/areas-panel';
import { CyclesPanel } from '@/components/admin/cycles-panel';
import { useStaffSession } from '@/lib/session-context';
import { fmtDate } from '@/lib/format';

export default function Admin() {
  const me = useStaffSession();
  if (me.role !== 'admin') return <AccessDenied inline />;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Keep the foundation true.">Staff, areas and cycles everyone else builds on. Every change is recorded below.</PageHeader>
      <WithFoundation>
        {(data) => (
          <Tabs defaultValue="staff">
            <TabsList className="mb-5 bg-[#0A2540]/[0.06]">
              <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
              <TabsTrigger value="areas" data-testid="tab-areas">Areas</TabsTrigger>
              <TabsTrigger value="cycles" data-testid="tab-cycles">Cycles</TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="staff"><StaffPanel staff={data.staff} areas={data.areas} /></TabsContent>
            <TabsContent value="areas"><AreasPanel areas={data.areas} /></TabsContent>
            <TabsContent value="cycles"><CyclesPanel cycles={data.cycles} /></TabsContent>
            <TabsContent value="activity">
              <Panel>
                {data.activity.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded yet.</p> : (
                  <ol className="space-y-3">
                    {data.activity.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-[#1D8BC4]/40 pl-3 text-sm" data-testid={`row-activity-${a.id}`}>
                        <span className="font-semibold text-[#0A2540]">{a.actorName}</span>
                        <span>{a.action}</span>
                        <span className="text-muted-foreground">{a.entityType}</span>
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{fmtDate(a.createdAt, 'MMM d, h:mm a')} · {a.via}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            </TabsContent>
          </Tabs>
        )}
      </WithFoundation>
    </>
  );
}
