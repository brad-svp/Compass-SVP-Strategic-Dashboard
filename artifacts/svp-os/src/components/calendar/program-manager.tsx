import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Archive, ImagePlus, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { CalendarProgram } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { NativeSelect } from '@/components/native-select';
import { Btn, ConflictNotice, Field, FormError, inputCls } from '@/components/six-by-six/form-kit';
import { fmtDate } from '@/lib/format';
import { LOGO_ACCEPT, buildProgramInput, draftFromProgram, validateLogoFile, type ProgramDraft } from '@/lib/calendar-programs';
import type { ProgramActions } from '@/lib/calendar-hooks';
import { ProgramMark } from './program-mark';

type Editing = { id: string | null; nonce: number } | null;

export function ProgramManager({ open, onClose, programs, actions }: {
  open: boolean; onClose: () => void; programs: CalendarProgram[]; actions: ProgramActions;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => { setEditing(null); onClose(); };
  const current = editing?.id ? programs.find((p) => p.id === editing.id) ?? null : null;
  const title = !editing ? 'Programs' : editing.id ? 'Edit program' : 'New program';
  const desc = !editing
    ? 'The managed list events choose from. Renames and logos flow to every linked event. Programs are retired, never deleted, so history keeps its label.'
    : 'PNG, JPEG or WEBP logo up to 2 MB. Optional; without one, events show the program colour and initials.';
  return (
    <BrowserDialog open={open} onOpenChange={(o) => { if (!o) close(); }} title={title} description={desc} testId="dialog-programs">
      {editing
        ? <ProgramForm key={`${editing.id ?? 'new'}-${editing.nonce}`} program={editing.id ? current : null} missing={!!editing.id && !current}
            programs={programs} actions={actions} onDone={() => setEditing(null)}
            onReopen={() => setEditing({ id: editing.id, nonce: editing.nonce + 1 })} />
        : <ProgramList programs={programs} actions={actions} onEdit={(id) => setEditing({ id, nonce: 0 })} onClose={close} />}
    </BrowserDialog>
  );
}

function ProgramList({ programs, actions, onEdit, onClose }: {
  programs: CalendarProgram[]; actions: ProgramActions; onEdit: (id: string | null) => void; onClose: () => void;
}) {
  const [show, setShow] = useState<'active' | 'retired' | 'all'>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const sorted = [...programs].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const list = sorted.filter((p) => show === 'all' || (show === 'active' ? p.active : !p.active));
  const retiredCount = programs.filter((p) => !p.active).length;

  async function toggle(p: CalendarProgram) {
    setBusyId(p.id);
    await actions.updateProgram(p.id, { name: p.name, logoId: p.logoId, active: !p.active, expectedVersion: p.version }, p.active ? `${p.name} retired` : `${p.name} restored`);
    setBusyId(null);
  }

  return (
    <div className="space-y-3" data-testid="list-programs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <NativeSelect aria-label="Show programs" wrapClassName="w-40" value={show} onChange={(e) => setShow(e.target.value as typeof show)} data-testid="select-program-show">
          <option value="active">Active</option>
          <option value="retired">Retired ({retiredCount})</option>
          <option value="all">All programs</option>
        </NativeSelect>
        <Btn type="button" onClick={() => onEdit(null)} data-testid="button-new-program"><Plus className="h-3.5 w-3.5" /> New program</Btn>
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center" data-testid="empty-programs">
          <div className="font-display text-lg font-semibold text-[#0A2540]">{programs.length ? 'Nothing in this view.' : 'No programs yet.'}</div>
          <p className="mt-1 text-[13px] text-muted-foreground">{programs.length ? 'Switch the view to see the rest of the list.' : 'Add Think Tank, Fast Pitch or whatever the team runs so events can be tagged.'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-card-border bg-card">
          {list.map((p) => (
            <li key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${p.active ? '' : 'bg-[#0A2540]/[0.025]'}`} data-testid={`row-program-${p.id}`}>
              <ProgramMark name={p.name} logoUrl={p.logoUrl} size={34} className={p.active ? '' : 'opacity-60 grayscale'} testId={`mark-program-${p.id}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`truncate text-sm font-semibold ${p.active ? 'text-[#0A2540]' : 'text-muted-foreground'}`} data-testid={`text-program-name-${p.id}`}>{p.name}</span>
                  {!p.active && <span className="rounded-full bg-[#0A2540]/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#3A4E63]">Retired</span>}
                </div>
                <div className="text-[11.5px] text-muted-foreground" data-testid={`text-program-count-${p.id}`}>
                  {p.eventCount} {p.eventCount === 1 ? 'event' : 'events'} · updated {fmtDate(p.updatedAt)}
                </div>
              </div>
              {p.canEdit && <>
                <button type="button" onClick={() => onEdit(p.id)} aria-label={`Edit ${p.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-[#3A4E63] hover:bg-[#0A2540]/[0.05]" data-testid={`button-edit-program-${p.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => toggle(p)} disabled={busyId === p.id}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-[12px] font-semibold text-[#3A4E63] hover:bg-[#0A2540]/[0.04] disabled:opacity-50"
                  data-testid={`button-toggle-program-${p.id}`}>
                  {p.active ? <><Archive className="h-3.5 w-3.5" /> Retire</> : <><RotateCcw className="h-3.5 w-3.5" /> Restore</>}
                </button>
              </>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end"><Btn tone="ghost" type="button" onClick={onClose} data-testid="button-close-programs">Done</Btn></div>
    </div>
  );
}

function ProgramForm({ program, missing, programs, actions, onDone, onReopen }: {
  program: CalendarProgram | null; missing: boolean; programs: CalendarProgram[]; actions: ProgramActions; onDone: () => void; onReopen: () => void;
}) {
  const [version] = useState(program?.version ?? 0); // captured at open; polling never resets the draft
  const [d, setD] = useState<ProgramDraft>(() => draftFromProgram(program));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<{ pct: number; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<ProgramDraft>) => setD((x) => ({ ...x, ...p }));

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateLogoFile(file);
    if (!check.ok) { setUploadError(check.error); return; }
    setUploadError(null); setUpload({ pct: 0, name: file.name });
    const r = await actions.uploadLogo(file, check.contentType, (pct) => setUpload({ pct, name: file.name }));
    setUpload(null);
    if (r.ok) set({ logoId: r.logoId, logoUrl: r.logoUrl }); else setUploadError(r.message);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (conflict || upload || missing) return;
    const r = buildProgramInput(d, version, programs, program?.id ?? null);
    if (!r.ok) { setError(r.error); return; }
    setError(null); setBusy(true);
    const res = program ? await actions.updateProgram(program.id, r.input) : await actions.createProgram(r.input);
    setBusy(false);
    if (res.ok) onDone(); else { setError(res.message); setConflict(res.conflict); }
  }

  const renamed = program && d.name.trim() && d.name.trim() !== program.name;
  const uploading = !!upload;

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-program">
      {conflict && <ConflictNotice onReopen={onReopen} />}
      {missing && <FormError message="This program is no longer in the list. Go back and pick it again." />}
      <div className="flex items-start gap-4 rounded-xl border border-card-border bg-card p-3">
        <div className="relative">
          <ProgramMark name={d.name.trim() || '?'} logoUrl={d.logoUrl} size={64} testId="img-program-logo-preview" />
          {uploading && <span className="absolute inset-0 grid place-items-center rounded-[5px] bg-[#FBFAF6]/80 text-[11px] font-semibold tabular-nums text-[#0A2540]" data-testid="text-logo-progress">{upload.pct}%</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">Logo</div>
          <input ref={fileRef} type="file" accept={LOGO_ACCEPT} className="sr-only" onChange={pick} disabled={uploading || busy || conflict} data-testid="input-program-logo" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || busy || conflict}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-[#FBFAF6] px-2.5 text-[12.5px] font-semibold text-[#0A2540] hover:bg-[#0A2540]/[0.04] disabled:opacity-50" data-testid="button-upload-logo">
              <ImagePlus className="h-3.5 w-3.5" /> {uploading ? 'Uploading' : d.logoId ? 'Replace logo' : 'Upload logo'}
            </button>
            {d.logoId && !uploading && (
              <button type="button" onClick={() => set({ logoId: null, logoUrl: null })} disabled={busy || conflict}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-[#8E2D58] hover:underline disabled:opacity-50" data-testid="button-remove-logo">
                <Trash2 className="h-3.5 w-3.5" /> Remove logo
              </button>
            )}
          </div>
          {uploading && (
            <div className="h-1.5 overflow-hidden rounded-full bg-[#0A2540]/10" role="progressbar" aria-valuenow={upload.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${upload.name}`}>
              <div className="h-full w-full origin-left bg-[#1D8BC4] transition-transform duration-300" style={{ transform: `scaleX(${upload.pct / 100})` }} />
            </div>
          )}
          {uploadError && <p role="alert" className="text-[12.5px] text-[#8E2D58]" data-testid="text-logo-error">{uploadError}</p>}
          {!uploading && !uploadError && <p className="text-[12px] text-muted-foreground">{d.logoId && d.logoId !== program?.logoId ? 'New logo ready. Save to apply it to every linked event.' : 'Shown on Timeline cards and Month entries.'}</p>}
        </div>
      </div>
      <Field label="Name" hint={renamed ? `Renaming updates all ${program.eventCount} linked ${program.eventCount === 1 ? 'event' : 'events'}.` : undefined}>
        <input className={inputCls} required maxLength={120} value={d.name} onChange={(e) => set({ name: e.target.value })} autoFocus data-testid="input-program-name" />
      </Field>
      <label className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0A2540]" checked={d.active} onChange={(e) => set({ active: e.target.checked })} data-testid="checkbox-program-active" />
        <span className="text-sm text-[#0A2540]"><span className="font-semibold">Active</span>
          <span className="block text-[12px] text-muted-foreground">Retired programs cannot be chosen for events but stay on the events that already use them.</span></span>
      </label>
      <FormError message={conflict ? null : error} />
      <div className="flex justify-end gap-2">
        <Btn tone="ghost" type="button" onClick={onDone} disabled={uploading}>Back</Btn>
        <Btn type="submit" disabled={busy || conflict || uploading || missing} data-testid="button-save-program">{busy ? 'Saving' : program ? 'Save program' : 'Add program'}</Btn>
      </div>
    </form>
  );
}
