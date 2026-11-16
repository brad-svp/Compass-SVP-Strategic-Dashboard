import { useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  useGetBrainEntry, getGetBrainEntryQueryKey, useActOnBrainEntry, useGetBrain, getGetBrainQueryKey, useGetMasterCalendar, getGetMasterCalendarQueryKey,
  type BrainActionInputAction, type BrainEntry, type Foundation,
} from '@workspace/api-client-react';
import { AlertTriangle, ArrowLeft, Check, ExternalLink, GitMerge, History, Pencil, RotateCcw, Archive, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/native-select';
import { BrowserDialog } from '@/components/browser-dialog';
import { ErrorPanel, PageSkeleton } from '@/components/ui-bits';
import { WithFoundation } from '@/components/with-foundation';
import { AccessDenied } from '@/components/access-denied';
import { EntryFormDialog } from '@/components/brain/entry-form';
import { FilesPanel } from '@/components/brain/files-panel';
import { EmptyState, EntryFlags, ReviewBadge } from '@/components/brain/brain-bits';
import { useToast } from '@/hooks/use-toast';
import { useStaffSession } from '@/lib/session-context';
import { errorMessage, errorStatus, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBrainInvalidate, useBrainToastError } from '@/lib/brain';

type Pending = { action: BrainActionInputAction; title: string; description: string; needsNote?: boolean; versionId?: string; needsTarget?: boolean } | null;

function MergeTargets({ entry, value, onChange }: { entry: BrainEntry; value: string; onChange: (v: string) => void }) {
  const params = { status: 'all' as const };
  const q = useGetBrain(params, { query: { queryKey: getGetBrainQueryKey(params) } });
  const options = (q.data?.entries ?? []).filter((e) => e.id !== entry.id && !e.retired);
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Loading entries...</p>;
  return (
    <NativeSelect aria-label="Merge into" value={value} onChange={(e) => onChange(e.target.value)} data-testid="select-brain-merge-target">
      <option value="">Choose the entry to keep</option>
      {options.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
    </NativeSelect>
  );
}

function Detail({ foundation }: { foundation: Foundation }) {
  const { id = '' } = useParams<{ id: string }>();
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const q = useGetBrainEntry(id, { query: { queryKey: getGetBrainEntryQueryKey(id), enabled: !!id, refetchInterval: (query) => query.state.data?.files.some((f) => !['ready', 'failed', 'error', 'indexed', 'extracted', 'searchable', 'text_empty', 'unsupported'].includes(f.status)) || query.state.data?.entry.indexStatus === 'pending' ? 4000 : false } });
  const cal = useGetMasterCalendar({ query: { queryKey: getGetMasterCalendarQueryKey() } });
  const act = useActOnBrainEntry();
  const invalidate = useBrainInvalidate();
  const fail = useBrainToastError();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState('');
  const [target, setTarget] = useState('');
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) {
    const s = errorStatus(q.error);
    if (s === 404) return <EmptyState testId="empty-brain-missing" title="Entry not found." body="It may have been removed, or it is restricted to admins."><Link href="/brain" className="text-sm font-medium text-[#1D8BC4]">Back to the Brain</Link></EmptyState>;
    if (s === 401 || s === 403) return <AccessDenied status={s} />;
    return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  if (!q.data) return null;
  const { entry, files, versions } = q.data;
  const programs = cal.data?.programs ?? [];
  const staffName = (sid: string | null) => foundation.staff.find((s) => s.id === sid)?.name ?? 'Unknown';
  const area = foundation.areas.find((a) => a.id === entry.areaId);
  const program = programs.find((p) => p.id === entry.programId);

  function open(p: NonNullable<Pending>) { setNote(''); setTarget(''); setPending(p); }
  function run() {
    if (!pending) return;
    act.mutate({ id: entry.id, data: {
      action: pending.action, expectedVersion: entry.version,
      ...(note.trim() ? { note: note.trim() } : {}), ...(pending.versionId ? { versionId: pending.versionId } : {}), ...(pending.needsTarget ? { targetId: target } : {}),
    } }, {
      onSuccess: () => { invalidate(entry.id); if (pending.needsTarget) invalidate(target); toast({ title: 'Done', description: pending.title }); setPending(null); },
      onError: (e) => fail(e, 'Action failed'),
    });
  }

  const meta: [string, React.ReactNode][] = [
    ['Owner', staffName(entry.ownerId)], ['Author', staffName(entry.authorId)],
    ['Area', area ? <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: area.color }} />{area.name}</span> : '—'],
    ['Program', program?.name ?? '—'], ['Visibility', entry.visibility === 'admin' ? 'Admins only' : 'All staff'],
    ['Reviewed', entry.reviewedAt ? `${fmtDate(entry.reviewedAt)} by ${staffName(entry.reviewerId)}` : 'Not yet'],
    ['Review due', entry.reviewDueAt ? <span className={cn(entry.overdue && 'font-semibold text-[#B03E71]')}>{fmtDate(entry.reviewDueAt)}</span> : '—'],
    ['Interval', `${entry.reviewIntervalDays} days`], ['Index', <span className="font-mono">{entry.indexStatus}</span>],
    ['Added via', entry.via], ['Created', fmtDate(entry.createdAt)], ['Updated', fmtDate(entry.updatedAt)],
  ];

  return (
    <div className="rise">
      <Link href="/brain" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#0A2540]" data-testid="link-brain-back"><ArrowLeft className="h-4 w-4" />Brain</Link>
      <header className="mb-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <ReviewBadge status={entry.reviewStatus} overdue={entry.overdue} testId="status-brain-review" />
          <EntryFlags entry={entry} />
          <span className="font-mono text-[11px] text-muted-foreground" data-testid="text-brain-version">v{entry.version}</span>
        </div>
        <h1 className="font-display text-3xl font-semibold text-[#0A2540] md:text-4xl" data-testid="text-brain-title">{entry.title}</h1>
        {entry.summary && <p className="mt-2 max-w-3xl text-[15px] text-muted-foreground">{entry.summary}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {entry.canEdit && <Button size="sm" onClick={() => setEditing(true)} data-testid="button-brain-edit"><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}
          {!entry.canEdit && !entry.retired && <Button size="sm" variant="outline" onClick={() => open({ action: 'propose_amendment', title: 'Propose an amendment', description: 'Describe what should change. The owner and admins will see it.', needsNote: true })} data-testid="button-brain-propose"><MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />Propose change</Button>}
          {isAdmin && <>
            {entry.reviewStatus === 'unreviewed' && !entry.retired && <Button size="sm" variant="outline" className="border-[#22702A]/40 text-[#22702A]" onClick={() => open({ action: 'approve', title: 'Approve entry', description: `Mark version ${entry.version} as reviewed.` })} data-testid="button-brain-approve"><Check className="mr-1.5 h-3.5 w-3.5" />Approve</Button>}
            {entry.conflict
              ? <Button size="sm" variant="outline" onClick={() => open({ action: 'clear_conflict', title: 'Clear conflict', description: 'Mark the conflict as resolved.' })} data-testid="button-brain-clear-conflict"><Check className="mr-1.5 h-3.5 w-3.5" />Clear conflict</Button>
              : <Button size="sm" variant="outline" onClick={() => open({ action: 'flag_conflict', title: 'Flag conflict', description: 'Explain what this contradicts.', needsNote: true })} data-testid="button-brain-flag-conflict"><AlertTriangle className="mr-1.5 h-3.5 w-3.5" />Flag conflict</Button>}
            {!entry.retired && <Button size="sm" variant="outline" onClick={() => open({ action: 'merge', title: 'Merge into another entry', description: 'This entry will be retired and point to the one you keep.', needsTarget: true })} data-testid="button-brain-merge"><GitMerge className="mr-1.5 h-3.5 w-3.5" />Merge</Button>}
            {entry.retired
              ? <Button size="sm" variant="outline" onClick={() => open({ action: 'restore', title: 'Restore entry', description: 'Bring this entry back into search.' })} data-testid="button-brain-restore"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restore</Button>
              : <Button size="sm" variant="outline" className="text-[#8C2F59]" onClick={() => open({ action: 'retire', title: 'Retire entry', description: 'Retired entries leave search but keep their history.' })} data-testid="button-brain-retire"><Archive className="mr-1.5 h-3.5 w-3.5" />Retire</Button>}
          </>}
        </div>
      </header>

      {entry.conflict && <div className="mb-4 rounded-xl border border-[#B03E71]/30 bg-[#B03E71]/[0.06] px-4 py-3 text-sm text-[#8C2F59]" data-testid="text-brain-conflict"><span className="font-semibold">Conflict: </span>{entry.conflict}</div>}
      {entry.mergedIntoId && <div className="mb-4 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm">Merged into <Link href={`/brain/${entry.mergedIntoId}`} className="font-semibold text-[#1D8BC4] hover:underline" data-testid="link-brain-merged-into">the surviving entry</Link>.</div>}
      {entry.reviewStatus === 'unreviewed' && <div className="mb-4 rounded-xl border border-[#ECA519]/40 bg-[#ECA519]/10 px-4 py-2.5 text-xs text-[#72500A]">Unreviewed. Use with judgment until an admin approves it.</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <article className="rounded-xl border border-card-border bg-card px-5 py-5 md:px-7" data-testid="text-brain-content">
            {entry.content ? <div className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-[#1B2F45]">{entry.content}</div>
              : <p className="text-sm italic text-muted-foreground">No written content. See attached files.</p>}
          </article>

          <section className="rounded-xl border border-card-border bg-card" data-testid="panel-brain-citations">
            <h2 className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]">Citations</h2>
            {entry.sourceUrls.length === 0 && entry.links.length === 0 ? <p className="px-4 py-4 text-xs text-muted-foreground">No sources cited.</p> : (
              <ol className="divide-y divide-border">
                {entry.sourceUrls.map((u, i) => (
                  <li key={u + i} className="flex items-center gap-2 px-4 py-2 text-[13px]"><span className="font-mono text-[10px] text-muted-foreground">[{i + 1}]</span>
                    <a href={u} target="_blank" rel="noreferrer noopener" className="inline-flex min-w-0 items-center gap-1 truncate text-[#1D8BC4] hover:underline" data-testid={`link-brain-source-${i}`}>{u}<ExternalLink className="h-3 w-3 shrink-0" /></a></li>
                ))}
                {entry.links.map((l, i) => (
                  <li key={l.domain + l.id} className="flex items-center gap-2 px-4 py-2 text-[13px]" data-testid={`text-brain-link-${i}`}>
                    <span className="rounded bg-muted px-1.5 font-mono text-[10px] uppercase">{l.domain}</span><span>{l.label}</span></li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-xl border border-card-border bg-card" data-testid="panel-brain-history">
            <h2 className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4E63]"><History className="h-3.5 w-3.5" />Version history <span className="font-mono">{versions.length}</span></h2>
            {versions.length === 0 ? <p className="px-4 py-4 text-xs text-muted-foreground">No history recorded.</p> : (
              <ol className="divide-y divide-border">
                {[...versions].sort((a, b) => b.version - a.version).map((v) => (
                  <li key={v.id} className="px-4 py-2.5" data-testid={`row-brain-version-${v.id}`}>
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="font-mono font-semibold text-[#0A2540]">v{v.version}</span>
                      <span className="rounded bg-muted px-1.5 text-[10px] font-semibold uppercase tracking-wide">{v.action.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">{staffName(v.actorId)} · {fmtDate(v.createdAt, 'MMM d, yyyy h:mm a')}</span>
                      <span className="ml-auto flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpenVersion(openVersion === v.id ? null : v.id)} data-testid={`button-brain-version-view-${v.id}`}>{openVersion === v.id ? 'Hide' : 'View'}</Button>
                        {isAdmin && v.version !== entry.version && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => open({ action: 'restore_version', title: `Restore v${v.version}`, description: 'Creates a new version with this content.', versionId: v.id })} data-testid={`button-brain-version-restore-${v.id}`}><RotateCcw className="mr-1 h-3 w-3" />Restore</Button>}
                      </span>
                    </div>
                    {v.note && <p className="mt-1 text-[12px] text-[#3A4E63]">{v.note}</p>}
                    {openVersion === v.id && (
                      <div className="mt-2 rounded-lg bg-muted/60 p-3 text-[12px]">
                        <div className="font-semibold">{v.title}</div>
                        {v.summary && <p className="mt-1 text-muted-foreground">{v.summary}</p>}
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{v.content || '(no content)'}</pre>
                        {v.fileIds.length > 0 && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{v.fileIds.length} file(s) attached at this version</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <FilesPanel entryId={entry.id} version={entry.version} files={files} canEdit={entry.canEdit} />
          <dl className="rounded-xl border border-card-border bg-card px-4 py-3 text-[12px]" data-testid="panel-brain-meta">
            {meta.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium text-[#0A2540]">{v}</dd></div>)}
            {entry.tags.length > 0 && <div className="flex flex-wrap gap-1 pt-2">{entry.tags.map((t) => <span key={t} className="rounded bg-[#1D8BC4]/10 px-1.5 py-0.5 font-mono text-[10px]">#{t}</span>)}</div>}
          </dl>
        </aside>
      </div>

      {editing && <EntryFormDialog open={editing} onOpenChange={setEditing} entry={entry} staff={foundation.staff} areas={foundation.areas} programs={programs} defaultReviewDays={entry.reviewIntervalDays} />}
      <BrowserDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} title={pending?.title ?? ''} description={pending?.description ?? ''} testId="dialog-brain-action">
        <div className="space-y-3">
          {pending?.needsTarget && <MergeTargets entry={entry} value={target} onChange={setTarget} />}
          <div className="space-y-1"><Label htmlFor="brain-note">Note {pending?.needsNote ? '' : <span className="font-normal text-muted-foreground">(optional)</span>}</Label>
            <Textarea id="brain-note" rows={3} maxLength={8000} value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-brain-action-note" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)} data-testid="button-brain-action-cancel">Cancel</Button>
            <Button onClick={run} disabled={act.isPending || (!!pending?.needsNote && !note.trim()) || (!!pending?.needsTarget && !target)} data-testid="button-brain-action-confirm">{act.isPending ? 'Working...' : 'Confirm'}</Button>
          </div>
        </div>
      </BrowserDialog>
    </div>
  );
}

export default function BrainDetailPage() {
  return <WithFoundation>{(f) => <Detail foundation={f} />}</WithFoundation>;
}
