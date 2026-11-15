import { useEffect, useState, type ReactNode } from 'react';
import type { CheckIn, Foundation, KeyResult, Objective, ObjectiveInput, ObjectiveUpdate, KeyResultUpdate } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NativeSelect } from '@/components/native-select';
import { BrowserDialog } from '@/components/browser-dialog';
import { QUARTERS, isQbo, type Quarter } from '@/lib/qbo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useStaffSession } from '@/lib/session-context';
import { OBJ_STATUSES, SCOPES, bySort, fmtNum, type OkrActions } from '@/lib/okr';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">{label}</Label>
      {children}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange, testId }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; testId: string }) {
  return (
    <div className="inline-flex rounded-lg bg-[#0A2540]/6 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} data-testid={`${testId}-${o.v}`}
          className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all', value === o.v ? 'bg-white text-[#0A2540] shadow-sm' : 'text-[#3A4E63] hover:text-[#0A2540]')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Objective ---------------- */

export function ObjectiveDialog({ open, onOpenChange, foundation, objectives, cycleId, actions, editing, quarter }: {
  open: boolean; onOpenChange: (o: boolean) => void; foundation: Foundation; objectives: Objective[]; cycleId: string; actions: OkrActions;
  editing?: Objective | null; quarter?: Quarter;
}) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const staff = foundation.staff.filter((s) => s.active || s.id === editing?.ownerId);
  const [ownerId, setOwnerId] = useState(me.id);
  const [areaId, setAreaId] = useState(me.areaId);
  const [parentId, setParentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<string>('Q1');
  const [status, setStatus] = useState<string>('active');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setOwnerId(editing.ownerId); setAreaId(editing.areaId); setParentId(editing.parentObjectiveId ?? '');
      setTitle(editing.title); setDescription(editing.description ?? ''); setScope(editing.timeScope); setStatus(editing.status);
    } else {
      setOwnerId(me.id); setAreaId(me.areaId); setParentId(''); setTitle(''); setDescription('');
      setScope(quarter ?? 'Q1'); setStatus('active');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const level = editing?.level ?? 'company';
  const legacy = !!editing && !isQbo(editing);
  const scopeOptions: readonly string[] = legacy ? SCOPES : QUARTERS;
  const parents = objectives.filter((o) => o.level === 'company' && o.cycleId === (editing?.cycleId ?? cycleId)).sort(bySort);
  const needsParent = level === 'individual';
  const valid = title.trim().length > 0 && areaId && ownerId && (!needsParent || parentId) && (editing || isAdmin);

  const submit = async () => {
    if (!valid) return;
    if (editing) {
      const d: ObjectiveUpdate = {};
      if (title.trim() !== editing.title) d.title = title.trim();
      if (description !== (editing.description ?? '')) d.description = description;
      if (scope !== editing.timeScope) d.timeScope = scope as ObjectiveUpdate['timeScope'];
      if (status !== editing.status) d.status = status as ObjectiveUpdate['status'];
      if (areaId !== editing.areaId) d.areaId = areaId;
      if (isAdmin && ownerId !== editing.ownerId) d.ownerId = ownerId;
      if (needsParent && parentId !== (editing.parentObjectiveId ?? '')) d.parentObjectiveId = parentId;
      if (Object.keys(d).length === 0) { onOpenChange(false); return; }
      const r = await actions.updateObjective(editing.id, d);
      if (r) onOpenChange(false);
    } else {
      const r = await actions.createObjective({
        cycleId, level: 'company', ownerId, areaId, title: title.trim(), description: description.trim() || undefined,
        timeScope: scope as ObjectiveInput['timeScope'], status: status as 'active', parentObjectiveId: null,
        sortOrder: objectives.filter((o) => o.cycleId === cycleId && o.level === 'company' && o.timeScope === scope).length,
      });
      if (r) onOpenChange(false);
    }
  };

  return (
    <BrowserDialog open={open} onOpenChange={onOpenChange}
      title={editing ? (legacy ? 'Edit legacy objective' : 'Edit QBO') : 'New QBO'}
      description={legacy ? 'This objective predates QBOs. You can still edit it; it stays in the legacy view.' : 'An organization-wide objective for one quarter, with one accountable owner.'}>
        <div className="space-y-4">
          {!legacy && (
            <Field label="Quarter">
              <Seg value={scope} testId="seg-quarter" onChange={setScope} options={QUARTERS.map((q) => ({ v: q as string, label: q }))} />
            </Field>
          )}
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Grow the Sacramento giving circle" data-testid="input-objective-title" autoFocus />
          </Field>
          <Field label="Description" hint="Optional. Why this matters this quarter.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} data-testid="input-objective-description" />
          </Field>
          {needsParent && (
            <Field label="Supports company objective">
              <NativeSelect value={parentId} onChange={(e) => setParentId(e.target.value)} data-testid="select-parent">
                <option value="" disabled>Choose the company objective</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </NativeSelect>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Accountable owner">
              <NativeSelect value={ownerId} onChange={(e) => { const v = e.target.value; setOwnerId(v); const s = staff.find((x) => x.id === v); if (s && !editing) setAreaId(s.areaId); }} disabled={!isAdmin} data-testid="select-owner">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Area">
              <NativeSelect value={areaId} onChange={(e) => setAreaId(e.target.value)} data-testid="select-area">
                {foundation.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </Field>
            {legacy && (
              <Field label="Time scope">
                <NativeSelect value={scope} onChange={(e) => setScope(e.target.value)} disabled={level === 'company'} data-testid="select-scope">
                  {scopeOptions.map((s) => <option key={s} value={s}>{s === 'annual' ? 'Annual' : s}</option>)}
                </NativeSelect>
              </Field>
            )}
            <Field label="Status">
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="capitalize" data-testid="select-status">
                {OBJ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </NativeSelect>
            </Field>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-objective">Cancel</Button>
          <Button onClick={submit} disabled={!valid || actions.pending} className="bg-[#0A2540] text-white" data-testid="button-save-objective">
            {actions.pending ? 'Saving' : editing ? 'Save changes' : 'Add QBO'}
          </Button>
        </DialogFooter>
    </BrowserDialog>
  );
}

/* ---------------- Key result ---------------- */

export function KeyResultDialog({ open, onOpenChange, foundation, objective, existingCount, actions, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; foundation: Foundation; objective: Objective; existingCount: number; actions: OkrActions; editing?: KeyResult | null;
}) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'metric' | 'confidence'>('metric');
  const [unit, setUnit] = useState('');
  const [start, setStart] = useState('0');
  const [target, setTarget] = useState('');
  const [ownerId, setOwnerId] = useState(me.id);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title); setType(editing.measurementType); setUnit(editing.unit ?? ''); setStart(String(editing.startValue ?? 0));
      setTarget(String(editing.targetValue ?? '')); setOwnerId(editing.ownerId);
    } else {
      setTitle(''); setType('metric'); setUnit(''); setStart('0'); setTarget(''); setOwnerId(isAdmin ? objective.ownerId : me.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const metricOk = type === 'confidence' || (target.trim() !== '' && Number.isFinite(Number(target)) && Number.isFinite(Number(start)));
  const valid = title.trim().length > 0 && metricOk;

  const submit = async () => {
    if (!valid) return;
    if (editing) {
      const d: KeyResultUpdate = {};
      if (title.trim() !== editing.title) d.title = title.trim();
      if (type !== editing.measurementType) d.measurementType = type;
      if (type === 'metric') {
        if (unit !== (editing.unit ?? '')) d.unit = unit;
        if (Number(start) !== editing.startValue) d.startValue = Number(start);
        if (Number(target) !== editing.targetValue) d.targetValue = Number(target);
      }
      if (isAdmin && ownerId !== editing.ownerId) d.ownerId = ownerId;
      if (Object.keys(d).length === 0) { onOpenChange(false); return; }
      if (await actions.updateKeyResult(editing.id, d)) onOpenChange(false);
    } else {
      const r = await actions.createKeyResult({
        objectiveId: objective.id, ownerId: isAdmin ? ownerId : me.id, title: title.trim(), measurementType: type,
        ...(type === 'metric' ? { unit: unit.trim(), startValue: Number(start), targetValue: Number(target) } : {}),
        sortOrder: existingCount,
      });
      if (r) onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto bg-[#FBFAF6] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#0A2540]">{editing ? 'Edit key result' : 'New key result'}</DialogTitle>
          <DialogDescription className="line-clamp-2">For: {objective.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Key result">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Recruit 40 new partners across Sacramento County" data-testid="input-kr-title" autoFocus />
          </Field>
          <Field label="Measured by" hint={editing && type !== editing.measurementType ? 'Switching type keeps every past check-in. Values change only through check-ins.' : undefined}>
            <Seg value={type} onChange={(v) => setType(v as 'metric' | 'confidence')} testId="seg-kr-type" options={[{ v: 'metric', label: 'Metric' }, { v: 'confidence', label: 'Confidence' }]} />
          </Field>
          {type === 'metric' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Start"><Input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} data-testid="input-kr-start" /></Field>
              <Field label="Target"><Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="input-kr-target" /></Field>
              <Field label="Unit"><Input value={unit} maxLength={80} onChange={(e) => setUnit(e.target.value)} placeholder="partners" data-testid="input-kr-unit" /></Field>
            </div>
          )}
          {isAdmin && (
            <Field label="Owner">
              <NativeSelect value={ownerId} onChange={(e) => setOwnerId(e.target.value)} data-testid="select-kr-owner">
                {foundation.staff.filter((s) => s.active || s.id === ownerId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-kr">Cancel</Button>
          <Button onClick={submit} disabled={!valid || actions.pending} className="bg-[#0A2540] text-white" data-testid="button-save-kr">
            {actions.pending ? 'Saving' : editing ? 'Save changes' : 'Add key result'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Check-in ---------------- */

export function CheckInDialog({ open, onOpenChange, kr, lastCheckIn, actions }: {
  open: boolean; onOpenChange: (o: boolean) => void; kr: KeyResult; lastCheckIn?: CheckIn; actions: OkrActions;
}) {
  const type = kr.measurementType;
  const [value, setValue] = useState('');
  const [conf, setConf] = useState(50);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setValue(kr.currentValue != null ? String(kr.currentValue) : '');
    setConf(kr.confidence ?? 50);
    setNote('');
    // init only when opening or switching KR, so 30s polling never clears typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kr.id]);

  const valid = note.trim().length > 0 && (type === 'confidence' || (value.trim() !== '' && Number.isFinite(Number(value))));
  const submit = async () => {
    if (!valid) return;
    const r = await actions.createCheckIn(kr.id, type === 'metric'
      ? { measurementType: 'metric', value: Number(value), note: note.trim() }
      : { measurementType: 'confidence', confidence: conf, note: note.trim() });
    if (r) onOpenChange(false);
  };
  const confTone = conf >= 70 ? '#49B949' : conf >= 40 ? '#ECA519' : '#B03E71';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto bg-[#FBFAF6] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#0A2540]">Check in</DialogTitle>
          <DialogDescription className="line-clamp-2">{kr.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1D8BC4]" data-testid="text-checkin-type">{type === 'metric' ? 'Metric check-in' : 'Confidence check-in'}{type === 'metric' && kr.currentValue == null ? ' · first value' : ''}</div>
          {type === 'metric' ? (
            <Field label={`Current value${kr.unit ? ` (${kr.unit})` : ''}`} hint={`Start ${fmtNum(kr.startValue ?? 0)}, target ${fmtNum(kr.targetValue ?? 0)}`}>
              <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="h-12 font-mono text-lg" data-testid="input-checkin-value" autoFocus />
            </Field>
          ) : (
            <Field label="How confident are you we land this?">
              <div className="flex items-center gap-4 pt-2">
                <Slider value={[conf]} min={0} max={100} step={1} onValueChange={(v) => setConf(v[0] ?? 0)} className="flex-1" data-testid="slider-confidence" />
                <span className="w-14 text-right font-mono text-2xl font-medium tabular-nums" style={{ color: confTone }} data-testid="text-confidence">{conf}</span>
              </div>
            </Field>
          )}
          <Field label="What changed?">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} placeholder="Two partner meetings booked at Roseville; one follow-up pending." data-testid="input-checkin-note" />
          </Field>
          {lastCheckIn && (
            <p className="rounded-lg bg-[#0A2540]/[0.04] px-3 py-2 text-[12px] text-[#3A4E63]">
              Last check-in {fmtDate(lastCheckIn.createdAt, 'MMM d')}: {lastCheckIn.measurementType === 'metric' ? `value ${fmtNum(lastCheckIn.value ?? 0)}` : `${lastCheckIn.confidence}% confidence`}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-checkin">Cancel</Button>
          <Button onClick={submit} disabled={!valid || actions.pending} className="bg-[#1D8BC4] text-white hover:bg-[#177AAE]" data-testid="button-save-checkin">
            {actions.pending ? 'Saving' : 'Record check-in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Confirm delete ---------------- */

export function ConfirmDelete({ open, onOpenChange, what, name, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; what: string; name: string; onConfirm: () => Promise<unknown>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#FBFAF6]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl text-[#0A2540]">Remove this {what}?</AlertDialogTitle>
          <AlertDialogDescription>
            "{name}" will be removed from the workspace. Its check-in history and audit trail are preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
          <AlertDialogAction className="bg-[#B03E71] text-white hover:bg-[#9A3563]" data-testid="button-confirm-delete"
            onClick={async () => { await onConfirm(); }}>
            Remove from workspace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
