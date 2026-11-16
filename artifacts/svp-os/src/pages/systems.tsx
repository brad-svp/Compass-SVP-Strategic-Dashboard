import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Archive, ArrowUpRight, KeyRound, Pencil, Plus, RefreshCw, Search, Trash2, Waypoints } from 'lucide-react';
import {
  getGetFoundationQueryKey, getGetSystemsOverviewQueryKey, useCreateSvpSystem, useDeleteSvpSystem, useGetSystemsOverview, useUpdateSvpSystem,
  type Foundation, type SvpSystem,
} from '@workspace/api-client-react';
import { WithFoundation } from '@/components/with-foundation';
import { BrowserDialog } from '@/components/browser-dialog';
import { NativeSelect } from '@/components/native-select';
import { ErrorPanel, PageHeader, StaffAvatar } from '@/components/ui-bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useStaffSession } from '@/lib/session-context';
import { errorMessage, errorStatus, fmtDate } from '@/lib/format';
import { LIMITS, blankSystem, categoriesOf, draftFrom, filterSystems, hostOf, howWhy, toInput, validateSystem, type SystemDraft } from '@/lib/systems';
import { cn } from '@/lib/utils';

type Staff = Foundation['staff'][number];
type WriteResult = { ok: true } | { ok: false; conflict: boolean; message: string };

function useSystemWrites() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateSvpSystem();
  const update = useUpdateSvpSystem();
  const del = useDeleteSvpSystem();
  const run = async (fn: () => Promise<unknown>, ok: string): Promise<WriteResult> => {
    try {
      await fn();
      toast({ title: ok });
      return { ok: true };
    } catch (e) {
      const conflict = errorStatus(e) === 409;
      const message = conflict ? 'Someone else changed this system since you opened it.' : errorMessage(e);
      toast({ title: conflict ? 'Changed elsewhere' : 'Not saved', description: message, variant: 'destructive' });
      return { ok: false, conflict, message };
    } finally {
      await Promise.all([qc.invalidateQueries({ queryKey: getGetSystemsOverviewQueryKey() }), qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() })]);
    }
  };
  return {
    pending: create.isPending || update.isPending || del.isPending,
    create: (d: SystemDraft) => run(() => create.mutateAsync({ data: toInput(d, 0) }), `${d.name.trim()} added`),
    update: (id: string, d: SystemDraft, v: number, msg = 'Saved') => run(() => update.mutateAsync({ id, data: toInput(d, v) }), msg),
    remove: (id: string, v: number) => run(() => del.mutateAsync({ id, data: { expectedVersion: v } }), 'Removed from workspace'),
  };
}
type Writes = ReturnType<typeof useSystemWrites>;

/* ---------- small bits ---------- */

function Field({ label, hint, error, count, max, children }: { label: string; hint?: string; error?: string; count?: number; max?: number; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">{label}</Label>
        {max != null && count != null && count > max * 0.8 && <span className={cn('font-mono text-[11px]', count > max ? 'text-[#8E2D58]' : 'text-muted-foreground')}>{count}/{max}</span>}
      </div>
      {children}
      {error ? <p className="text-[12px] text-[#8E2D58]">{error}</p> : hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ExtLink({ url, className, testId }: { url: string; className?: string; testId?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} data-testid={testId}
      className={cn('inline-flex min-w-0 items-center gap-1 text-[#125F88] underline-offset-2 hover:underline', className)}>
      <span className="truncate">{hostOf(url)}</span><ArrowUpRight className="h-3 w-3 shrink-0" />
    </a>
  );
}

/* ---------- form ---------- */

function SystemForm({ open, onOpenChange, editing, staff, categories, writes }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: SvpSystem | null; staff: Staff[]; categories: string[]; writes: Writes;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SystemDraft>(blankSystem());
  const [version, setVersion] = useState(0);
  const [touched, setTouched] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [failure, setFailure] = useState('');
  const [reloading, setReloading] = useState(false);
  const editingRef = useRef(editing); editingRef.current = editing;

  // Init once per open / record. 30s polling never resets the draft.
  useEffect(() => {
    if (!open) return;
    const e = editingRef.current;
    setDraft(e ? draftFrom(e) : blankSystem()); setVersion(e ? e.version : 0);
    setTouched(false); setConflict(false); setFailure('');
  }, [open, editing?.id]);

  const set = <K extends keyof SystemDraft>(k: K, v: SystemDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const errors = validateSystem(draft);
  const valid = Object.keys(errors).length === 0;
  const ownerChoices = staff.filter((s) => s.active || s.id === draft.ownerId || s.id === editing?.ownerId);
  const show = (k: keyof SystemDraft) => (touched || (k !== 'name' && k !== 'url') ? errors[k] : undefined);


  const submit = async () => {
    setTouched(true);
    if (!valid || conflict) return;
    const r = editing ? await writes.update(editing.id, draft, version) : await writes.create(draft);
    if (r.ok) { onOpenChange(false); return; }
    setFailure(r.message); setConflict(r.conflict);
  };

  const reopenLatest = async () => {
    if (!editing) return;
    setReloading(true);
    try {
      const data = await qc.fetchQuery({ queryKey: getGetSystemsOverviewQueryKey(), staleTime: 0 }) as { systems: SvpSystem[] } | undefined;
      const latest = data?.systems.find((s) => s.id === editing.id);
      if (!latest) { setFailure('This system was removed by someone else.'); return; }
      setDraft(draftFrom(latest)); setVersion(latest.version); setConflict(false); setFailure('');
    } finally { setReloading(false); }
  };

  return (
    <BrowserDialog open={open} onOpenChange={onOpenChange} testId="system-form-dialog"
      title={editing ? `Edit ${editing.name}` : 'Add a system'}
      description="What it is, why SVP uses it, and how to get in. Shared with all staff.">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
          <Field label="Name" error={show('name')} count={draft.name.length} max={LIMITS.name}>
            <Input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Salesforce" autoFocus data-testid="input-system-name" />
          </Field>
          <Field label="Category" hint="Free text, e.g. Fundraising" error={show('category')} count={draft.category.length} max={LIMITS.category}>
            <Input value={draft.category} onChange={(e) => set('category', e.target.value)} placeholder={categories[0] ?? 'Fundraising'} data-testid="input-system-category" />
          </Field>
        </div>
        {categories.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-1">
            {categories.slice(0, 8).map((c) => (
              <button key={c} type="button" onClick={() => set('category', c)} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors', draft.category.trim() === c ? 'bg-[#0A2540] text-[#FBFAF6]' : 'bg-[#0A2540]/6 text-[#3A4E63] hover:bg-[#0A2540]/12')}>{c}</button>
            ))}
          </div>
        )}
        <Field label="Link" error={show('url')} hint="The address people open. No usernames or passwords in the link.">
          <Input value={draft.url} onChange={(e) => set('url', e.target.value)} inputMode="url" placeholder="https://" className="font-mono text-[13px]" data-testid="input-system-url" />
        </Field>
        <Field label="How/why we use it" error={show('purpose')} count={draft.purpose.length} max={LIMITS.purpose}>
          <Textarea rows={5} value={draft.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Our record of every donor, partner and gift. Log every gift within two days." data-testid="input-system-purpose" />
        </Field>
        <Field label="Owner">
          <NativeSelect value={draft.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value || null)} data-testid="select-system-owner">
            <option value="">No owner yet</option>
            {ownerChoices.map((s) => <option key={s.id} value={s.id} disabled={!s.active && s.id !== editing?.ownerId}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Access notes" error={errors.accessInstructions} hint="How to get an account. Never write passwords here; point to the password manager." count={draft.accessInstructions.length} max={LIMITS.accessInstructions}>
          <Textarea rows={2} value={draft.accessInstructions} onChange={(e) => set('accessInstructions', e.target.value)} placeholder="Ask the owner for an invite. Shared login lives in the team password vault." data-testid="input-system-access" />
        </Field>
        {editing && (
          <Field label="Status">
            <div className="inline-flex rounded-lg bg-[#0A2540]/6 p-0.5" role="radiogroup">
              {(['active', 'retired'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={draft.status === v} onClick={() => set('status', v)} data-testid={`seg-system-status-${v}`}
                  className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold capitalize transition-all', draft.status === v ? 'bg-white text-[#0A2540] shadow-sm' : 'text-[#3A4E63] hover:text-[#0A2540]')}>{v}</button>
              ))}
            </div>
          </Field>
        )}
        {failure && (
          <div className={cn('rounded-lg px-3 py-2.5 text-[13px]', conflict ? 'bg-[#ECA519]/12 text-[#6B4600]' : 'bg-[#B03E71]/10 text-[#8E2D58]')} data-testid="text-system-error">
            {failure}
            {conflict && <> Your draft is kept below until you reload. <button type="button" onClick={reopenLatest} disabled={reloading} className="ml-1 inline-flex items-center gap-1 font-semibold underline" data-testid="button-system-reopen"><RefreshCw className={cn('h-3 w-3', reloading && 'animate-spin')} />Reopen latest</button></>}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-system">Cancel</Button>
        <Button onClick={submit} disabled={writes.pending || conflict || (touched && !valid)} className="bg-[#0A2540] text-[#FBFAF6] hover:bg-[#13365A]" data-testid="button-save-system">
          {writes.pending ? 'Saving' : editing ? 'Save changes' : 'Add system'}
        </Button>
      </div>
    </BrowserDialog>
  );
}

/* ---------- details + delete ---------- */

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3A4E63]">{label}</div>
      <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1E3349]">{children}</div>
    </div>
  );
}

function SystemDetails({ sys, onClose, staffById, colorOf, onEdit }: { sys: SvpSystem | null; onClose: () => void; staffById: Map<string, Staff>; colorOf: (s?: Staff) => string | undefined; onEdit: (s: SvpSystem) => void }) {
  if (!sys) return null;
  const owner = sys.ownerId ? staffById.get(sys.ownerId) : undefined;
  const none = <span className="text-muted-foreground">Not written yet.</span>;
  return (
    <BrowserDialog open onOpenChange={(o) => { if (!o) onClose(); }} testId="system-details-dialog" title={sys.name}
      description={[sys.category || 'Uncategorized', sys.status === 'retired' ? 'Retired' : ''].filter(Boolean).join(' · ')}>
      <div className="space-y-4">
        <a href={sys.url} target="_blank" rel="noopener noreferrer" data-testid="link-system-open"
          className="group flex items-center justify-between gap-3 rounded-xl border border-[#1D8BC4]/30 bg-[#1D8BC4]/[0.06] px-4 py-3 transition-colors hover:bg-[#1D8BC4]/12">
          <span className="min-w-0"><span className="block text-[13px] font-semibold text-[#0A2540]">Open {sys.name}</span><span className="block truncate font-mono text-[12px] text-[#125F88]">{sys.url}</span></span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[#125F88] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
        <Block label="How/why we use it">{howWhy(sys) || none}</Block>
        <Block label="Owner">
          {owner ? <span className="flex items-center gap-2"><StaffAvatar name={owner.name} url={owner.avatarUrl} color={colorOf(owner)} size="h-6 w-6" />{owner.name}{!owner.active && <span className="text-[11px] text-muted-foreground">(inactive)</span>}</span> : sys.ownerId ? 'Former staff' : none}
        </Block>
        <div className="rounded-xl bg-[#ECA519]/10 px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A5A00]"><KeyRound className="h-3 w-3" />Getting access</div>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1E3349]">{sys.accessInstructions || 'Ask the owner.'}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">Updated {fmtDate(sys.updatedAt, 'MMM d, yyyy')}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {sys.canEdit && <Button variant="ghost" onClick={() => { onClose(); onEdit(sys); }} data-testid="button-details-edit"><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}
        <Button onClick={onClose} className="bg-[#0A2540] text-[#FBFAF6]">Done</Button>
      </div>
    </BrowserDialog>
  );
}

function ConfirmRemove({ sys, onClose, writes }: { sys: SvpSystem | null; onClose: () => void; writes: Writes }) {
  const [version, setVersion] = useState(0);
  const [failure, setFailure] = useState<{ conflict: boolean; message: string } | null>(null);
  useEffect(() => { if (sys) { setVersion(sys.version); setFailure(null); } }, [sys?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sys) return null;
  const confirm = async () => {
    const r = await writes.remove(sys.id, version);
    if (r.ok) onClose(); else setFailure(r);
  };
  return (
    <BrowserDialog open onOpenChange={(o) => { if (!o) onClose(); }} testId="system-delete-dialog" title={`Remove ${sys.name}?`}
      description="It disappears from the directory for everyone. The audit trail is kept. To keep it on record instead, retire it.">
      {failure && <p className="mb-3 rounded-lg bg-[#ECA519]/12 px-3 py-2 text-[13px] text-[#6B4600]" data-testid="text-system-delete-error">{failure.message}{failure.conflict && ' Close and review the latest version before removing.'}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} data-testid="button-cancel-delete-system">Keep it</Button>
        <Button onClick={confirm} disabled={writes.pending || !!failure?.conflict} className="bg-[#B03E71] text-white hover:bg-[#9A3563]" data-testid="button-confirm-delete-system">
          {writes.pending ? 'Removing' : 'Remove from workspace'}
        </Button>
      </div>
    </BrowserDialog>
  );
}

/* ---------- page ---------- */

function Directory({ foundation }: { foundation: Foundation }) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const q = useGetSystemsOverview({ query: { queryKey: getGetSystemsOverviewQueryKey(), refetchInterval: 30_000 } });
  const writes = useSystemWrites();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const staffById = useMemo(() => new Map(foundation.staff.map((s) => [s.id, s])), [foundation.staff]);
  const colorOf = (s?: Staff) => foundation.areas.find((a) => a.id === s?.areaId)?.color;
  const systems = q.data?.systems ?? [];
  const categories = categoriesOf(systems);
  const retiredCount = systems.filter((s) => s.status === 'retired').length;
  const shown = filterSystems(systems, { text, category, showRetired }, (id) => staffById.get(id)?.name ?? '');
  const find = (id: string | null) => (id ? systems.find((s) => s.id === id) ?? null : null);
  const editing = find(editingId);
  // Snapshot for the form so polling cannot swap the record mid-edit.
  const [editingSnap, setEditingSnap] = useState<SvpSystem | null>(null);
  const [deleteSnap, setDeleteSnap] = useState<SvpSystem | null>(null);

  const openNew = () => { setEditingId(null); setEditingSnap(null); setFormOpen(true); };
  const openEdit = (s: SvpSystem) => { setEditingId(s.id); setEditingSnap(s); setFormOpen(true); };
  const openDelete = (s: SvpSystem) => { setDeleteId(s.id); setDeleteSnap(s); };
  const toggleRetire = async (s: SvpSystem) => {
    setBusyId(s.id);
    const next = s.status === 'active' ? 'retired' : 'active';
    await writes.update(s.id, { ...draftFrom(s), status: next }, s.version, next === 'retired' ? `${s.name} retired` : `${s.name} restored`);
    setBusyId(null);
  };

  const header = (
    <PageHeader eyebrow="Systems overview" title="The tools SVP runs on."
      actions={isAdmin && systems.length > 0 ? <Button onClick={openNew} className="bg-[#0A2540] text-[#FBFAF6] hover:bg-[#13365A]" data-testid="button-add-system"><Plus className="mr-1.5 h-4 w-4" />Add system</Button> : undefined}>
      Where each system lives, why we pay for it, how we use it, and who to ask for access.{!isAdmin && ' Admins keep this list current.'}
    </PageHeader>
  );

  let body: ReactNode;
  if (q.isLoading) {
    body = (
      <div className="space-y-2" data-testid="systems-loading">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[74px] animate-pulse rounded-xl bg-[#0A2540]/[0.05]" style={{ animationDelay: `${i * 90}ms` }} />)}
      </div>
    );
  } else if (q.isError) {
    body = <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  } else if (systems.length === 0) {
    body = (
      <div className="rise relative overflow-hidden rounded-2xl border border-dashed border-[#0A2540]/20 bg-card px-6 py-14 text-center" data-testid="systems-empty">
        <Waypoints className="mx-auto h-8 w-8 text-[#49B949]" />
        <h2 className="mt-3 font-display text-2xl font-semibold text-[#0A2540]">No systems written down yet.</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
          {isAdmin ? 'Start with the one people ask about most: the CRM, the shared drive, the grants portal. Add the link, why it exists, and who to ask for access.' : 'An admin has not added any systems yet. Ask them to start with the CRM and the shared drive.'}
        </p>
        {isAdmin && <Button onClick={openNew} className="mt-5 bg-[#0A2540] text-[#FBFAF6] hover:bg-[#13365A]" data-testid="button-add-first-system"><Plus className="mr-1.5 h-4 w-4" />Add the first system</Button>}
      </div>
    );
  } else {
    body = (
      <>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search names, how/why, owner, access notes" className="pl-9" data-testid="input-search-systems" />
          </div>
          {categories.length > 0 && (
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} wrapClassName="md:w-52" data-testid="select-system-category">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          )}
          {retiredCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-[#3A4E63] hover:border-[#1D8BC4]/40">
              <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} className="accent-[#1D8BC4]" data-testid="toggle-show-retired" />
              Show retired ({retiredCount})
            </label>
          )}
        </div>

        <div className="mb-2 flex items-baseline justify-between px-1 text-[12px] text-muted-foreground">
          <span data-testid="text-systems-count">{shown.length} of {systems.length} systems</span>
          {q.isFetching && <span className="font-mono">syncing</span>}
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-[14px] text-muted-foreground" data-testid="systems-no-match">
            Nothing matches. <button type="button" className="font-semibold text-[#1D8BC4] hover:underline" onClick={() => { setText(''); setCategory(''); }}>Clear search</button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,2.6fr)_8rem_auto] gap-4 border-b border-border/70 bg-[#0A2540]/[0.03] px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#3A4E63] lg:grid">
              <span>System</span><span>How/why we use it</span><span>Owner</span><span className="w-[5.5rem]" />
            </div>
            <ul className="divide-y divide-border/70">
              {shown.map((s) => {
                const owner = s.ownerId ? staffById.get(s.ownerId) : undefined;
                const retired = s.status === 'retired';
                return (
                  <li key={s.id} className={cn('group relative grid cursor-pointer gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-[#1D8BC4]/[0.045] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2.6fr)_8rem_auto] lg:items-start', retired && 'bg-[#0A2540]/[0.02]', busyId === s.id && 'opacity-60')}
                    onClick={() => setDetailsId(s.id)} data-testid={`row-system-${s.id}`}>
                    <span className="absolute inset-y-3 left-0 w-[3px] rounded-r bg-[#1D8BC4] opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn('font-semibold text-[#0A2540]', retired && 'text-[#3A4E63] line-through decoration-[#3A4E63]/40')} data-testid={`text-system-name-${s.id}`}>{s.name}</span>
                        {retired && <span className="rounded bg-[#0A2540]/8 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-[#3A4E63]">Retired</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]">
                        <ExtLink url={s.url} className="max-w-[14rem] font-mono text-[11.5px]" testId={`link-system-${s.id}`} />
                        {s.category && <span className="text-muted-foreground">· {s.category}</span>}
                      </div>
                    </div>
                    <div className="min-w-0 text-[13px] leading-snug">
                      {howWhy(s) ? <p className="line-clamp-3 whitespace-pre-line text-[#1E3349]">{howWhy(s)}</p> : <p className="italic text-muted-foreground">Not written yet.</p>}
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-[#1E3349]">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground lg:hidden">Owner</span>
                      {owner ? <><StaffAvatar name={owner.name} url={owner.avatarUrl} color={colorOf(owner)} size="h-6 w-6" /><span className="truncate">{owner.name.split(' ')[0]}</span></> : <span className="text-muted-foreground">{s.ownerId ? 'Former staff' : 'Unowned'}</span>}
                    </div>
                    <div className="flex w-[5.5rem] items-center justify-end gap-0.5 lg:opacity-60 lg:transition-opacity lg:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      {s.canEdit && (
                        <>
                          <button type="button" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`} title="Edit" className="rounded-md p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/8" data-testid={`button-edit-system-${s.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => toggleRetire(s)} disabled={busyId === s.id} aria-label={retired ? `Restore ${s.name}` : `Retire ${s.name}`} title={retired ? 'Restore' : 'Retire'} className="rounded-md p-1.5 text-[#3A4E63] hover:bg-[#0A2540]/8" data-testid={`button-retire-system-${s.id}`}>{retired ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}</button>
                          <button type="button" onClick={() => openDelete(s)} aria-label={`Remove ${s.name}`} title="Remove" className="rounded-md p-1.5 text-[#B03E71] hover:bg-[#B03E71]/10" data-testid={`button-delete-system-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      {header}
      {body}
      {isAdmin && <SystemForm open={formOpen} onOpenChange={setFormOpen} editing={editingId ? editingSnap ?? editing : null} staff={foundation.staff} categories={categories} writes={writes} />}
      <SystemDetails sys={find(detailsId)} onClose={() => setDetailsId(null)} staffById={staffById} colorOf={colorOf} onEdit={openEdit} />
      {isAdmin && <ConfirmRemove sys={deleteId ? deleteSnap : null} onClose={() => { setDeleteId(null); setDeleteSnap(null); }} writes={writes} />}
    </div>
  );
}

export default function SystemsPage() {
  return <WithFoundation>{(f) => <Directory foundation={f} />}</WithFoundation>;
}
