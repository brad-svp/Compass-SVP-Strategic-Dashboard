import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetBrain, getGetBrainQueryKey, useGetMasterCalendar, getGetMasterCalendarQueryKey, type Foundation, type GetBrainParams, type GetBrainStatus } from '@workspace/api-client-react';
import { ChevronLeft, ChevronRight, Plug, Plus, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NativeSelect } from '@/components/native-select';
import { ErrorPanel, PageHeader } from '@/components/ui-bits';
import { WithFoundation } from '@/components/with-foundation';
import { EntryFormDialog } from '@/components/brain/entry-form';
import { BrainAdminPanel } from '@/components/brain/admin-panel';
import { EmptyState, EntryFlags, ReviewBadge } from '@/components/brain/brain-bits';
import { useStaffSession } from '@/lib/session-context';
import { errorMessage, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BRAIN_KINDS, BRAIN_STATUSES, kindLabel } from '@/lib/brain';

const STATUS_LABEL: Record<string, string> = { all: 'All statuses', unreviewed: 'Unreviewed', reviewed: 'Reviewed', overdue: 'Review overdue', conflicts: 'Conflicts', retired: 'Retired' };

function BrainCatalog({ foundation }: { foundation: Foundation }) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const [, setLocation] = useLocation();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [programId, setProgramId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [status, setStatus] = useState<GetBrainStatus>('all');
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setQ(text.trim().slice(0, 500)); setOffset(0); }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text]);

  const params: GetBrainParams = useMemo(() => ({
    ...(q ? { q } : {}), ...(kind ? { kind } : {}), ...(programId ? { programId } : {}), ...(areaId ? { areaId } : {}),
    status, ...(offset ? { offset } : {}),
  }), [q, kind, programId, areaId, status, offset]);
  const brain = useGetBrain(params, { query: { queryKey: getGetBrainQueryKey(params), placeholderData: (prev) => prev } });
  const cal = useGetMasterCalendar({ query: { queryKey: getGetMasterCalendarQueryKey() } });
  const programs = cal.data?.programs ?? [];
  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name;
  const areaOf = (id: string | null) => foundation.areas.find((a) => a.id === id);
  const staffName = (id: string) => foundation.staff.find((s) => s.id === id)?.name ?? 'Unknown';
  const filtered = !!(q || kind || programId || areaId || status !== 'all');
  const data = brain.data;
  const pageSize = Math.max(data?.entries.length ?? 0, 1);

  function reset() { setText(''); setQ(''); setKind(''); setProgramId(''); setAreaId(''); setStatus('all'); setOffset(0); }

  return (
    <div>
      <PageHeader eyebrow="Organizational Brain" title="What the team knows."
        actions={<>
          <Link href="/brain/connections" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-[#0A2540] hover:bg-muted" data-testid="link-brain-connections"><Plug className="h-4 w-4" />Claude</Link>
          <Button onClick={() => setCreating(true)} data-testid="button-brain-new"><Plus className="mr-1.5 h-4 w-4" />Contribute</Button>
        </>}>
        Playbooks, procedures, decisions and lessons. Anything you add is searchable right away and marked Unreviewed until an admin checks it.
      </PageHeader>

      {isAdmin && (
        <div className="mb-5">
          <button type="button" onClick={() => setShowAdmin((s) => !s)} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', showAdmin ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-border bg-card text-[#0A2540]')} data-testid="button-brain-toggle-admin">
            <ShieldCheck className="h-3.5 w-3.5" />Review and diagnostics
          </button>
          {showAdmin && <div className="mt-3 rise"><BrainAdminPanel onFilter={(s) => { setStatus(s as GetBrainStatus); setOffset(0); }} /></div>}
        </div>
      )}

      <div className="sticky top-[57px] z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 pb-3 pt-2 backdrop-blur lg:top-0 md:mx-0 md:rounded-xl md:border md:px-3">
        <label className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-[#1D8BC4]/40">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search entries, files and excerpts" maxLength={500}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" data-testid="input-brain-search" />
          {text && <button type="button" aria-label="Clear search" onClick={() => setText('')} data-testid="button-brain-clear-search"><X className="h-4 w-4 text-muted-foreground" /></button>}
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <NativeSelect aria-label="Program" value={programId} onChange={(e) => { setProgramId(e.target.value); setOffset(0); }} data-testid="select-filter-program">
            <option value="">All programs</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Area" value={areaId} onChange={(e) => { setAreaId(e.target.value); setOffset(0); }} data-testid="select-filter-area">
            <option value="">All areas</option>{foundation.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Type" value={kind} onChange={(e) => { setKind(e.target.value); setOffset(0); }} data-testid="select-filter-kind">
            <option value="">All types</option>{BRAIN_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Review status" value={status} onChange={(e) => { setStatus(e.target.value as GetBrainStatus); setOffset(0); }} data-testid="select-filter-status">
            {BRAIN_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </NativeSelect>
        </div>
      </div>

      {brain.isLoading ? (
        <div className="space-y-2" data-testid="loading-brain">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[68px] rounded-xl bg-[#0A2540]/6" />)}</div>
      ) : brain.isError || !data ? (
        <ErrorPanel message={errorMessage(brain.error)} onRetry={() => brain.refetch()} />
      ) : (
        <div className={cn('space-y-5 transition-opacity', brain.isFetching && 'opacity-70')}>
          {q && !data.semanticReady && data.semanticMessage && (
            <p className="rounded-lg border border-[#ECA519]/40 bg-[#ECA519]/10 px-3 py-2 text-xs text-[#72500A]" data-testid="text-brain-semantic">{data.semanticMessage}</p>
          )}
          {q && data.hits.length > 0 && (
            <section data-testid="section-brain-hits">
              <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1D8BC4]"><Sparkles className="h-3.5 w-3.5" />Best passages</h2>
              <ol className="space-y-1.5">
                {data.hits.map((h, i) => (
                  <li key={`${h.entryId}-${i}`}>
                    <Link href={`/brain/${h.entryId}`} className="block rounded-xl border border-card-border bg-card px-4 py-3 hover:border-[#1D8BC4]/50" data-testid={`link-brain-hit-${i}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#0A2540]">{h.title}</span>
                        <ReviewBadge status={h.reviewStatus} overdue={h.overdue} />
                        {h.conflict && <span className="text-[10px] font-semibold text-[#8C2F59]">Conflict flagged</span>}
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{h.sourceLabel}{h.page != null ? ` p.${h.page}` : ''} · {h.score.toFixed(2)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] text-[#3A4E63]">{h.excerpt}</p>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]">Entries <span className="font-mono" data-testid="text-brain-total">{data.total}</span></h2>
              {filtered && <button type="button" onClick={reset} className="text-xs font-medium text-[#1D8BC4] hover:underline" data-testid="button-brain-reset">Clear filters</button>}
            </div>
            {data.entries.length === 0 ? (
              filtered
                ? <EmptyState testId="empty-brain-filtered" title="Nothing matches." body="Try a broader search or clear a filter."><Button variant="outline" onClick={reset}>Clear filters</Button></EmptyState>
                : <EmptyState testId="empty-brain" title="The Brain is empty." body="Start with something you explain often: a procedure, a decision and why, or a lesson from last season."><Button onClick={() => setCreating(true)}>Contribute the first entry</Button></EmptyState>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-card-border bg-card">
                {data.entries.map((e) => {
                  const area = areaOf(e.areaId);
                  return (
                    <li key={e.id}>
                      <Link href={`/brain/${e.id}`} className={cn('grid gap-1 px-4 py-3 hover:bg-[#1D8BC4]/[0.04] md:grid-cols-[1fr_auto] md:items-center', e.retired && 'opacity-60')} data-testid={`row-brain-entry-${e.id}`}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-[#0A2540]">{e.title}</span>
                            <EntryFlags entry={e} />
                          </div>
                          {e.summary && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{e.summary}</p>}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            {area && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: area.color }} />{area.name}</span>}
                            {programName(e.programId) && <span>{programName(e.programId)}</span>}
                            <span>{staffName(e.ownerId)}</span>
                            {e.tags.slice(0, 3).map((t) => <span key={t} className="font-mono">#{t}</span>)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 md:flex-col md:items-end md:gap-1">
                          <ReviewBadge status={e.reviewStatus} overdue={e.overdue} testId={`status-brain-entry-${e.id}`} />
                          <span className="font-mono text-[10px] text-muted-foreground">v{e.version} · {fmtDate(e.updatedAt, 'MMM d')}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {(offset > 0 || offset + data.entries.length < data.total) && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span data-testid="text-brain-range">{offset + 1} to {offset + data.entries.length} of {data.total}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))} data-testid="button-brain-prev"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" disabled={offset + data.entries.length >= data.total} onClick={() => setOffset(offset + data.entries.length)} data-testid="button-brain-next"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {creating && <EntryFormDialog open={creating} onOpenChange={setCreating} staff={foundation.staff} areas={foundation.areas} programs={programs}
        defaultReviewDays={data?.defaultReviewDays ?? 180} onCreated={(id) => setLocation(`/brain/${id}`)} />}
    </div>
  );
}

export default function BrainPage() {
  return <WithFoundation>{(f) => <BrainCatalog foundation={f} />}</WithFoundation>;
}
