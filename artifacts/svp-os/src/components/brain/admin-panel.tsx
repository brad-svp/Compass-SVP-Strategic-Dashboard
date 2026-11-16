import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useGetBrainAdmin, getGetBrainAdminQueryKey, useUpdateBrainSettings, useRetryBrainJob, useReindexBrain } from '@workspace/api-client-react';
import { RefreshCw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorPanel } from '@/components/ui-bits';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBrainInvalidate, useBrainToastError } from '@/lib/brain';

export function BrainAdminPanel({ onFilter }: { onFilter: (status: string) => void }) {
  const q = useGetBrainAdmin({ query: { queryKey: getGetBrainAdminQueryKey(), refetchInterval: 20_000 } });
  const settings = useUpdateBrainSettings();
  const retry = useRetryBrainJob();
  const reindex = useReindexBrain();
  const invalidate = useBrainInvalidate();
  const fail = useBrainToastError();
  const { toast } = useToast();
  const [days, setDays] = useState('');
  useEffect(() => { if (q.data) setDays(String(q.data.reviewIntervalDays)); }, [q.data?.settingsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <div className="grid gap-3 md:grid-cols-4" data-testid="loading-brain-admin">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-[#0A2540]/6" />)}</div>;
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const a = q.data;
  const stats = [
    { label: 'Unreviewed', value: a.unreviewed, status: 'unreviewed' },
    { label: 'Overdue review', value: a.overdue, status: 'overdue' },
    { label: 'Conflicts', value: a.conflicts, status: 'conflicts' },
    { label: 'Failed jobs', value: a.failed, status: '' },
  ];
  const modelOk = a.modelState === 'ready';

  return (
    <div className="space-y-4" data-testid="panel-brain-admin">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {stats.map((s) => (
          <button key={s.label} type="button" disabled={!s.status} onClick={() => s.status && onFilter(s.status)}
            className="rounded-xl border border-card-border bg-card px-4 py-3 text-left transition enabled:hover:border-[#1D8BC4]/50" data-testid={`stat-brain-${s.label.toLowerCase().replace(/\s/g, '-')}`}>
            <div className={cn('font-display text-3xl', s.value > 0 && s.label !== 'Unreviewed' ? 'text-[#B03E71]' : 'text-[#0A2540]')}>{s.value}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-card-border bg-card p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]">Search model</h3>
          <div className="flex items-center gap-2 text-sm" data-testid="text-brain-model">
            <span className={cn('h-2 w-2 rounded-full', modelOk ? 'bg-[#22702A]' : 'bg-[#ECA519]')} />
            <span className="font-mono text-[12px]">{a.model || 'not configured'}</span>
            <span className="text-muted-foreground">{a.modelState}</span>
          </div>
          {a.modelMessage && <p className="mt-1 text-xs text-muted-foreground">{a.modelMessage}</p>}
          <Button size="sm" variant="outline" className="mt-3" disabled={reindex.isPending}
            onClick={() => { if (window.confirm('Rebuild the search index for every entry?')) reindex.mutate(undefined, { onSuccess: () => { invalidate(); toast({ title: 'Reindex queued' }); }, onError: (e) => fail(e, 'Reindex failed') }); }}
            data-testid="button-brain-reindex"><RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', reindex.isPending && 'animate-spin')} />Reindex all</Button>
        </section>
        <section className="rounded-xl border border-card-border bg-card p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]">Default review interval</h3>
          <form className="flex items-end gap-2" onSubmit={(e) => {
            e.preventDefault();
            settings.mutate({ data: { reviewIntervalDays: Number(days), expectedVersion: a.settingsVersion } }, {
              onSuccess: () => { invalidate(); toast({ title: 'Review default saved' }); }, onError: (err) => fail(err),
            });
          }}>
            <div className="flex-1"><Input type="number" min={7} max={730} required value={days} onChange={(e) => setDays(e.target.value)} aria-label="Default review days" data-testid="input-brain-default-days" /></div>
            <span className="pb-2 text-xs text-muted-foreground">days</span>
            <Button size="sm" type="submit" disabled={settings.isPending || Number(days) === a.reviewIntervalDays} data-testid="button-brain-save-settings">Save</Button>
          </form>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">settings v{a.settingsVersion}. Applies to new entries.</p>
        </section>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-card-border bg-card">
          <h3 className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]">Index jobs <span className="font-mono">{a.jobs.length}</span></h3>
          {a.jobs.length === 0 ? <p className="px-4 py-5 text-center text-xs text-muted-foreground">Queue is clear.</p> : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto">{a.jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-2 px-4 py-2 text-[12px]" data-testid={`row-brain-job-${j.id}`}>
                <div className="min-w-0 flex-1">
                  <Link href={`/brain/${j.entryId}`} className="block truncate font-medium text-[#0A2540] hover:underline">{j.title}</Link>
                  <div className="font-mono text-[10px] text-muted-foreground">v{j.version} · {j.status} · {j.attempts} attempts</div>
                  {j.error && <div className="truncate text-[11px] text-[#8C2F59]" title={j.error}>{j.error}</div>}
                </div>
                {j.status === 'failed' && <Button size="sm" variant="ghost" disabled={retry.isPending}
                  onClick={() => retry.mutate({ id: j.id }, { onSuccess: () => invalidate(j.entryId), onError: (e) => fail(e, 'Retry failed') })}
                  data-testid={`button-brain-retry-${j.id}`}><RotateCw className="mr-1 h-3 w-3" />Retry</Button>}
              </li>))}</ul>)}
        </section>
        <section className="rounded-xl border border-card-border bg-card">
          <h3 className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]">Possible duplicates <span className="font-mono">{a.duplicates.length}</span></h3>
          {a.duplicates.length === 0 ? <p className="px-4 py-5 text-center text-xs text-muted-foreground">No duplicate titles detected.</p> : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto">{a.duplicates.map((d, i) => (
              <li key={i} className="px-4 py-2 text-[12px]" data-testid={`row-brain-duplicate-${i}`}>
                <div className="font-medium text-[#0A2540]">{d.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">{d.ids.map((id) => <Link key={id} href={`/brain/${id}`} className="rounded bg-[#1D8BC4]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#0A2540] hover:bg-[#1D8BC4]/20">{id.slice(0, 8)}</Link>)}</div>
              </li>))}</ul>)}
        </section>
      </div>
    </div>
  );
}
