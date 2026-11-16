import { useState } from 'react';
import { Link } from 'wouter';
import { useGetBrainConnections, getGetBrainConnectionsQueryKey, useRevokeBrainConnection } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Download, KeyRound, Loader2, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorPanel, PageHeader } from '@/components/ui-bits';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, fmtDate } from '@/lib/format';
import { downloadSkill, useBrainToastError } from '@/lib/brain';

export default function BrainConnectionsPage() {
  const q = useGetBrainConnections({ query: { queryKey: getGetBrainConnectionsQueryKey() } });
  const revoke = useRevokeBrainConnection();
  const qc = useQueryClient();
  const fail = useBrainToastError();
  const { toast } = useToast();
  const [skillBusy, setSkillBusy] = useState(false);

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast({ title: 'Copied' }); } catch { toast({ title: 'Copy failed', variant: 'destructive' }); }
  }
  async function getSkill() {
    setSkillBusy(true);
    try { await downloadSkill(); } catch (e) { toast({ title: 'Download failed', description: errorMessage(e), variant: 'destructive' }); }
    setSkillBusy(false);
  }

  return (
    <div>
      <Link href="/brain" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#0A2540]" data-testid="link-brain-back"><ArrowLeft className="h-4 w-4" />Brain</Link>
      <PageHeader eyebrow="Organizational Brain" title="Connect Claude.">
        Let your own Claude read and contribute to the Brain as you. Each connection is personal, scoped and revocable.
      </PageHeader>
      {q.isLoading ? <div className="space-y-3" data-testid="loading-brain-connections"><Skeleton className="h-40 rounded-xl bg-[#0A2540]/6" /><Skeleton className="h-28 rounded-xl bg-[#0A2540]/6" /></div>
        : q.isError || !q.data ? <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        : (() => {
          const c = q.data;
          const active = c.grants.filter((g) => !g.revokedAt);
          const revoked = c.grants.filter((g) => g.revokedAt);
          return (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-xl border border-card-border bg-card p-5" data-testid="panel-brain-setup">
                <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-[#0A2540]"><Plug className="h-5 w-5 text-[#1D8BC4]" />Setup</h2>
                {c.message && <p className="mb-3 rounded-lg border border-[#ECA519]/40 bg-[#ECA519]/10 px-3 py-2 text-xs text-[#72500A]" data-testid="text-brain-connections-message">{c.message}</p>}
                <ol className="space-y-4 text-sm">
                  <li><div className="font-semibold text-[#0A2540]">1. Add a custom connector in Claude</div>
                    <p className="text-muted-foreground">Settings, then Connectors, then Add custom connector. Paste this server URL:</p>
                    {c.mcpUrl ? (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                        <code className="min-w-0 flex-1 truncate font-mono text-[12px]" data-testid="text-brain-mcp-url">{c.mcpUrl}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copy URL" onClick={() => copy(c.mcpUrl)} data-testid="button-brain-copy-url"><Copy className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground" data-testid="text-brain-mcp-unavailable">The connector address is not configured yet{c.published ? '' : ' (the app has not been published)'}. Ask an admin.</p>}
                    {c.clientId && <p className="mt-1 font-mono text-[10px] text-muted-foreground">client {c.clientId}</p>}
                  </li>
                  <li><div className="font-semibold text-[#0A2540]">2. Approve access</div>
                    <p className="text-muted-foreground">Claude opens a consent page here. Review the scopes and grant access.</p>
                    <div className="mt-2 flex flex-wrap gap-1">{c.scopes.map((s) => <span key={s} className="rounded bg-[#1D8BC4]/10 px-1.5 py-0.5 font-mono text-[10px]">{s}</span>)}</div></li>
                  <li><div className="font-semibold text-[#0A2540]">3. Install the skill (optional)</div>
                    <p className="text-muted-foreground">Teaches Claude how SVP uses the Brain: cite entries, flag Unreviewed material.</p>
                    <Button size="sm" variant="outline" className="mt-2" disabled={skillBusy || !c.skillUrl} onClick={getSkill} data-testid="button-brain-download-skill">
                      {skillBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}Download skill</Button></li>
                </ol>
              </section>
              <section className="rounded-xl border border-card-border bg-card" data-testid="panel-brain-grants">
                <h2 className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]"><KeyRound className="h-3.5 w-3.5" />Your connections <span className="font-mono">{active.length}</span></h2>
                {active.length === 0 ? <p className="px-4 py-6 text-center text-xs text-muted-foreground" data-testid="text-brain-no-grants">No active connections.</p> : (
                  <ul className="divide-y divide-border">{active.map((g) => (
                    <li key={g.id} className="px-4 py-3" data-testid={`row-brain-grant-${g.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0A2540]">{g.clientName}</span>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-[#8C2F59]" disabled={revoke.isPending}
                          onClick={() => { if (window.confirm(`Revoke ${g.clientName}? It will lose access immediately.`)) revoke.mutate({ id: g.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetBrainConnectionsQueryKey() }); toast({ title: 'Connection revoked' }); }, onError: (e) => fail(e, 'Revoke failed') }); }}
                          data-testid={`button-brain-revoke-${g.id}`}>Revoke</Button>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">{g.scopes.map((s) => <span key={s} className="rounded bg-muted px-1.5 font-mono text-[10px]">{s}</span>)}</div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">granted {fmtDate(g.createdAt)} · last used {g.lastUsedAt ? fmtDate(g.lastUsedAt) : 'never'}</div>
                    </li>))}</ul>)}
                {revoked.length > 0 && <details className="border-t border-border px-4 py-2 text-xs text-muted-foreground"><summary className="cursor-pointer">{revoked.length} revoked</summary>
                  <ul className="mt-1 space-y-0.5">{revoked.map((g) => <li key={g.id}>{g.clientName} · revoked {fmtDate(g.revokedAt)}</li>)}</ul></details>}
              </section>
            </div>
          );
        })()}
    </div>
  );
}
