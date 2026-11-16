import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpRight, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { getGetSvpPurposeQueryKey, useGetSvpPurpose, useUpdateSvpPurpose, type SvpPurpose } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { AccessDenied } from '@/components/access-denied';
import { ErrorPanel } from '@/components/ui-bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useStaffSession } from '@/lib/session-context';
import { errorMessage, errorStatus, fmtDate } from '@/lib/format';
import { PURPOSE_LIMITS, draftFromPurpose, hasErrors, isDirty, moveValue, newValue, safeHttpUrl, toPurposeInput, validatePurpose, type PurposeDraft } from '@/lib/purpose';
import { cn } from '@/lib/utils';

function Counter({ n, max }: { n: number; max: number }) {
  if (n < max * 0.8) return null;
  return <span className={cn('font-mono text-[11px]', n > max ? 'text-[#8E2D58]' : 'text-muted-foreground')}>{n}/{max}</span>;
}

function NotConfigured({ what, isEditor }: { what: string; isEditor: boolean }) {
  return (
    <p className="rounded-xl border border-dashed border-[#0A2540]/20 px-4 py-5 text-[14px] text-muted-foreground" data-testid={`empty-${what.toLowerCase()}`}>
      No {what.toLowerCase()} statement configured yet.{isEditor ? ' Use Edit to write it.' : ' An admin can add it.'}
    </p>
  );
}

/* ---------- editor ---------- */

function PurposeEditor({ open, onOpenChange, purpose }: { open: boolean; onOpenChange: (o: boolean) => void; purpose: SvpPurpose }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateSvpPurpose();
  const [draft, setDraft] = useState<PurposeDraft>(() => draftFromPurpose(purpose));
  const [version, setVersion] = useState(purpose.version);
  const [conflict, setConflict] = useState(false);
  const [failure, setFailure] = useState('');
  const [touched, setTouched] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const purposeRef = useRef(purpose); purposeRef.current = purpose;
  const baseRef = useRef(purpose);

  // Snapshot only when opening; 30s refresh never touches an open draft.
  useEffect(() => {
    if (!open) return;
    const p = purposeRef.current;
    baseRef.current = p;
    setDraft(draftFromPurpose(p)); setVersion(p.version); setConflict(false); setFailure(''); setTouched(false);
  }, [open]);

  const errors = validatePurpose(draft);
  const invalid = hasErrors(errors);
  const dirty = isDirty(draft, baseRef.current);
  const setValue = (id: string, k: 'title' | 'description', v: string) => setDraft((d) => ({ ...d, values: d.values.map((x) => (x.id === id ? { ...x, [k]: v } : x)) }));
  const move = (i: number, dir: -1 | 1) => { const id = draft.values[i]?.id ?? null; setDraft((d) => ({ ...d, values: moveValue(d.values, i, dir) })); setFlashId(id); };
  const add = () => { const v = newValue(); setDraft((d) => ({ ...d, values: [...d.values, v] })); setFlashId(v.id); };
  const remove = (id: string) => setDraft((d) => ({ ...d, values: d.values.filter((x) => x.id !== id) }));

  useEffect(() => { if (!flashId) return; const t = setTimeout(() => setFlashId(null), 700); return () => clearTimeout(t); }, [flashId]);

  const save = async () => {
    setTouched(true);
    if (invalid || conflict) return;
    if (!dirty) { onOpenChange(false); return; }
    try {
      await update.mutateAsync({ data: toPurposeInput(draft, version) });
      toast({ title: 'Mission, vision and values saved' });
      onOpenChange(false);
    } catch (e) {
      const c = errorStatus(e) === 409;
      setConflict(c);
      setFailure(c ? 'Someone else saved changes after you opened this. Your draft is kept here.' : errorMessage(e));
      toast({ title: c ? 'Changed elsewhere' : 'Not saved', description: c ? 'Reopen the latest version to continue.' : errorMessage(e), variant: 'destructive' });
    } finally {
      await qc.invalidateQueries({ queryKey: getGetSvpPurposeQueryKey() });
    }
  };

  const reopenLatest = async () => {
    setReloading(true);
    try {
      const latest = await qc.fetchQuery({ queryKey: getGetSvpPurposeQueryKey(), staleTime: 0 }) as SvpPurpose | undefined;
      if (latest) { baseRef.current = latest; setDraft(draftFromPurpose(latest)); setVersion(latest.version); setConflict(false); setFailure(''); }
    } catch (e) { setFailure(errorMessage(e)); } finally { setReloading(false); }
  };

  const label = 'text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]';
  return (
    <BrowserDialog open={open} onOpenChange={onOpenChange} testId="purpose-editor-dialog" title="Edit mission, vision and values"
      description="Changes apply inside SVP Compass only. They do not update the public website.">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between"><Label className={label}>Mission</Label><Counter n={draft.mission.length} max={PURPOSE_LIMITS.statement} /></div>
          <Textarea rows={3} value={draft.mission} onChange={(e) => setDraft((d) => ({ ...d, mission: e.target.value }))} placeholder="Leave blank to show as not configured." data-testid="input-purpose-mission" />
          {errors.mission && <p className="text-[12px] text-[#8E2D58]">{errors.mission}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between"><Label className={label}>Vision</Label><Counter n={draft.vision.length} max={PURPOSE_LIMITS.statement} /></div>
          <Textarea rows={2} value={draft.vision} onChange={(e) => setDraft((d) => ({ ...d, vision: e.target.value }))} placeholder="Leave blank to show as not configured." data-testid="input-purpose-vision" />
          {errors.vision && <p className="text-[12px] text-[#8E2D58]">{errors.vision}</p>}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Label className={label}>Values · {draft.values.length}</Label>
            <span className="text-[11px] text-muted-foreground">Order here is display order</span>
          </div>
          {errors.values && <p className="mb-2 text-[12px] text-[#8E2D58]">{errors.values}</p>}
          <ol className="space-y-2" data-testid="list-purpose-values-edit">
            {draft.values.map((v, i) => {
              const err = touched ? errors.byId[v.id] : errors.byId[v.id]?.description ? { description: errors.byId[v.id]?.description } : undefined;
              return (
                <li key={v.id} className={cn('rounded-xl border bg-white/60 p-3 transition-colors duration-500', flashId === v.id ? 'border-[#1D8BC4] bg-[#1D8BC4]/[0.06]' : 'border-border')} data-testid={`edit-value-${v.id}`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-5 shrink-0 font-mono text-[12px] text-[#1D8BC4]">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Input value={v.title} onChange={(e) => setValue(v.id, 'title', e.target.value)} placeholder="Value title" className="font-semibold" maxLength={PURPOSE_LIMITS.title + 20} data-testid={`input-value-title-${v.id}`} />
                      {err?.title && <p className="text-[12px] text-[#8E2D58]">{err.title}</p>}
                      <Textarea rows={2} value={v.description} onChange={(e) => setValue(v.id, 'description', e.target.value)} placeholder="What it means in practice" className="text-[13px]" data-testid={`input-value-description-${v.id}`} />
                      {err?.description && <p className="text-[12px] text-[#8E2D58]">{err.description}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="rounded p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/6 disabled:opacity-20" data-testid={`button-value-up-${v.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={i === draft.values.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="rounded p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/6 disabled:opacity-20" data-testid={`button-value-down-${v.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => remove(v.id)} aria-label="Remove value" title="Remove from draft" className="rounded p-1.5 text-[#B03E71] hover:bg-[#B03E71]/10" data-testid={`button-value-remove-${v.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {draft.values.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-3 text-[13px] text-muted-foreground">No values in this draft.</p>}
          <button type="button" onClick={add} disabled={draft.values.length >= PURPOSE_LIMITS.values}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#1D8BC4] hover:bg-[#1D8BC4]/8 disabled:opacity-40" data-testid="button-add-value">
            <Plus className="h-4 w-4" /> Add value
          </button>
        </div>

        {failure && (
          <div className={cn('rounded-lg px-3 py-2.5 text-[13px]', conflict ? 'bg-[#ECA519]/12 text-[#6B4600]' : 'bg-[#B03E71]/10 text-[#8E2D58]')} data-testid="text-purpose-error">
            {failure}
            {conflict && <button type="button" onClick={reopenLatest} disabled={reloading} className="ml-1.5 inline-flex items-center gap-1 font-semibold underline" data-testid="button-purpose-reopen"><RefreshCw className={cn('h-3 w-3', reloading && 'animate-spin')} />Reopen latest</button>}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {dirty && !conflict && <span className="text-[12px] text-muted-foreground sm:mr-auto">Unsaved changes</span>}
        <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-purpose">Cancel</Button>
        <Button onClick={save} disabled={update.isPending || conflict || (touched && invalid)} className="bg-[#0A2540] text-[#FBFAF6] hover:bg-[#13365A]" data-testid="button-save-purpose">
          {update.isPending ? 'Saving' : 'Save'}
        </Button>
      </div>
    </BrowserDialog>
  );
}

/* ---------- page ---------- */

function Statement({ eyebrow, text, isEditor, testId, size }: { eyebrow: string; text: string; isEditor: boolean; testId: string; size: 'lg' | 'md' }) {
  return (
    <section className="rise">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1D8BC4]">{eyebrow}</span>
        <span className="h-px flex-1 bg-[#0A2540]/12" />
      </div>
      {text ? (
        <p className={cn('whitespace-pre-wrap font-display font-semibold leading-[1.15] text-[#0A2540]', size === 'lg' ? 'text-[1.7rem] md:text-[2.5rem]' : 'text-[1.35rem] md:text-[1.9rem]')} data-testid={testId}>{text}</p>
      ) : <NotConfigured what={eyebrow} isEditor={isEditor} />}
    </section>
  );
}

function Block({ children }: { children: ReactNode }) { return <div className="space-y-12 md:space-y-16">{children}</div>; }

export default function PurposePage() {
  const me = useStaffSession();
  const q = useGetSvpPurpose({ query: { queryKey: getGetSvpPurposeQueryKey(), refetchInterval: 30_000 } });
  const [editOpen, setEditOpen] = useState(false);

  if (q.isLoading) {
    return (
      <Block>
        <div className="space-y-3"><div className="h-3 w-24 animate-pulse rounded bg-[#0A2540]/8" /><div className="h-24 animate-pulse rounded-xl bg-[#0A2540]/[0.05]" /></div>
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-[#0A2540]/[0.05]" />)}</div>
      </Block>
    );
  }
  if (q.isError || !q.data) {
    const s = errorStatus(q.error);
    if (s === 401 || s === 403) return <AccessDenied status={s} />;
    return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const p = q.data;
  const isEditor = p.canEdit && me.role === 'admin';
  const sources = p.sourceUrls.map(safeHttpUrl).filter((u): u is string => !!u);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="rise mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1D8BC4]">Mission, vision and values</div>
          <h1 className="font-display text-3xl font-semibold text-[#0A2540] md:text-[2.6rem] md:leading-[1.05]">Why SVP exists.</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">The shared reference for every QBO and 6x6 commitment. If a priority does not trace back to this page, ask why.</p>
        </div>
        {isEditor && (
          <Button onClick={() => setEditOpen(true)} className="self-start bg-[#0A2540] text-[#FBFAF6] hover:bg-[#13365A] md:self-auto" data-testid="button-edit-purpose">
            <Pencil className="mr-1.5 h-4 w-4" />Edit
          </Button>
        )}
      </header>

      <Block>
        <Statement eyebrow="Mission" text={p.mission} isEditor={isEditor} testId="text-mission" size="lg" />
        <Statement eyebrow="Vision" text={p.vision} isEditor={isEditor} testId="text-vision" size="md" />

        <section className="rise">
          <div className="mb-5 flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1D8BC4]">Values</span>
            <span className="font-mono text-[11px] text-muted-foreground">{p.values.length}</span>
            <span className="h-px flex-1 bg-[#0A2540]/12" />
          </div>
          {p.values.length === 0 ? <NotConfigured what="Values" isEditor={isEditor} /> : (
            <ol className="grid gap-x-10 gap-y-1 md:grid-cols-2" data-testid="list-values">
              {p.values.map((v, i) => (
                <li key={v.id} className="group flex gap-4 border-t border-[#0A2540]/10 py-5 transition-colors" data-testid={`value-${v.id}`}>
                  <span className="font-display text-[1.6rem] font-semibold leading-none text-[#1D8BC4]/45 tabular-nums transition-colors group-hover:text-[#1D8BC4]">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-semibold leading-snug text-[#0A2540]">{v.title}</h3>
                    {v.description ? <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-[#3A4E63]">{v.description}</p> : <p className="mt-1.5 text-[13px] italic text-muted-foreground">No description yet.</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#0A2540]/10 pt-4 text-[12px] text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span data-testid="text-purpose-updated">Updated {fmtDate(p.updatedAt, 'MMM d, yyyy')} · Edited inside SVP Compass, not synced with the website</span>
          {sources.length > 0 && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Originally drawn from</span>
              {sources.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#125F88] hover:underline" data-testid="link-purpose-source">
                  {new URL(u).host.replace(/^www\./, '')}{new URL(u).pathname.replace(/\/$/, '')}<ArrowUpRight className="h-3 w-3" />
                </a>
              ))}
            </span>
          )}
        </footer>
      </Block>

      {isEditor && <PurposeEditor open={editOpen} onOpenChange={setEditOpen} purpose={p} />}
    </div>
  );
}
