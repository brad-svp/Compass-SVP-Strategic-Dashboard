import { useClerk } from '@clerk/react';
import { LogOut, Plug } from 'lucide-react';
import { useHealthCheck } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { PageHeader, Panel, StaffAvatar, StatusPill } from '@/components/ui-bits';
import { useStaffSession } from '@/lib/session-context';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function Row({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-3 sm:flex-row sm:items-center">
      <dt className="w-40 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-[15px] text-[#0A2540]" data-testid={testId}>{value}</dd>
    </div>
  );
}

export default function Settings() {
  const me = useStaffSession();
  const { signOut } = useClerk();
  const health = useHealthCheck();
  const ok = health.data?.status === 'ok';

  return (
    <>
      <PageHeader eyebrow="Settings" title="Your account." />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel className="rise">
          <div className="mb-4 flex items-center gap-4">
            <StaffAvatar name={me.name} url={me.avatarUrl} color="#1D8BC4" size="h-14 w-14" />
            <div>
              <div className="font-display text-xl font-semibold text-[#0A2540]">{me.name}</div>
              <div className="text-sm text-muted-foreground">Signed in with Google</div>
            </div>
          </div>
          <dl>
            <Row label="Email" value={me.email ?? 'Not set'} testId="text-email" />
            <Row label="Access" value={me.role === 'admin' ? 'Administrator' : 'Staff'} testId="text-role" />
            <Row label="Role" value={me.roleDescription || 'Not written yet'} testId="text-role-description" />
            <Row label="6x6 permissions" value={me.role === 'admin' ? 'Manage periods, major moments and everyone’s items.' : 'Add, edit and remove your own items in any period. Other teammates’ items are read-only.'} testId="text-six-permissions" />
          </dl>
          <Button variant="outline" className="mt-5 border-[#B03E71]/40 text-[#8C2F59] hover:bg-[#B03E71]/5" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-signout">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </Panel>
        <div className="space-y-5">
          <Panel className="rise">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#0A2540]">Integrations</h2>
              <Plug className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-border p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#0A2540]">Slack and calendar</span>
                <StatusPill status="closed" label="Not connected" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">No integrations are connected. They are planned for a later phase.</p>
            </div>
          </Panel>
          <Panel className="rise">
            <h2 className="font-display text-lg font-semibold text-[#0A2540]">System status</h2>
            <div className="mt-3 flex items-center gap-2 text-sm" data-testid="status-health">
              {health.isLoading ? <span className="text-muted-foreground">Checking...</span> : (
                <StatusPill status={ok ? 'active' : 'planning'} label={ok ? 'API reachable' : 'API not responding'} />
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
