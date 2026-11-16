import { useEffect, useState, type ReactNode } from 'react';
import type { Foundation, ScorecardMetric, ScorecardMetricInput } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/native-select';
import { goalLabel, type ScorecardActions } from '@/lib/scorecard';

export type KrOption = { id: string; label: string; objectiveTitle: string; quarter: string };

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">{label}</Label>
      {children}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

export function MetricDialog({ open, onOpenChange, foundation, krOptions, actions, editing, nextSort }: {
  open: boolean; onOpenChange: (o: boolean) => void; foundation: Foundation; krOptions: KrOption[];
  actions: ScorecardActions; editing?: ScorecardMetric | null; nextSort: number;
}) {
  const staff = foundation.staff.filter((s) => s.active || s.id === editing?.ownerId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [unit, setUnit] = useState('');
  const [decimals, setDecimals] = useState('0');
  const [direction, setDirection] = useState<ScorecardMetricInput['direction']>('at_least');
  const [target, setTarget] = useState('');
  const [upper, setUpper] = useState('');
  const [krId, setKrId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setTitle(editing.title); setDescription(editing.description); setOwnerId(editing.ownerId); setAreaId(editing.areaId);
      setUnit(editing.unit); setDecimals(String(editing.decimals)); setDirection(editing.direction);
      setTarget(String(editing.target)); setUpper(editing.upperTarget == null ? '' : String(editing.upperTarget));
      setKrId(editing.linkedKeyResultId ?? '');
    } else {
      const first = staff[0];
      setTitle(''); setDescription(''); setOwnerId(first?.id ?? ''); setAreaId(first?.areaId ?? foundation.areas[0]?.id ?? '');
      setUnit(''); setDecimals('0'); setDirection('at_least'); setTarget(''); setUpper(''); setKrId('');
    }
    // init only on open / record switch so polling never wipes a draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const t = num(target);
  const u = num(upper);
  const goalOk = Number.isFinite(t) && (direction !== 'range' || (Number.isFinite(u) && u >= t));
  const valid = title.trim().length > 0 && !!ownerId && !!areaId && goalOk;
  const linkedMissing = krId && !krOptions.some((k) => k.id === krId);
  const goalChanged = editing && (editing.direction !== direction || editing.target !== t || (editing.upperTarget ?? null) !== (direction === 'range' ? u : null) || editing.unit !== unit.trim());

  const submit = async () => {
    if (!valid) { setError(direction === 'range' && Number.isFinite(t) && u < t ? 'Upper bound must be at least the lower bound.' : 'Title, owner, area and a numeric goal are required.'); return; }
    const data: ScorecardMetricInput = {
      title: title.trim(), description: description.trim(), ownerId, areaId, unit: unit.trim(),
      decimals: Number(decimals), direction, target: t, upperTarget: direction === 'range' ? u : null,
      linkedKeyResultId: krId || null, sortOrder: editing ? editing.sortOrder : nextSort, active: editing ? editing.active : true,
    };
    const r = editing ? await actions.updateMetric(editing.id, data) : await actions.createMetric(data);
    if (r.ok) onOpenChange(false); else setError(r.message);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#FBFAF6]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#0A2540]">{editing ? 'Configure metric' : 'New weekly metric'}</DialogTitle>
          <DialogDescription>One number, one owner, one goal. Recorded every week, Monday to Sunday.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Metric">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="New volunteer applications" data-testid="input-metric-title" autoFocus />
          </Field>
          <Field label="Description" hint="Optional. How it is counted and where the number comes from.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={2} data-testid="input-metric-description" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Accountable owner">
              <NativeSelect value={ownerId} onChange={(e) => { setOwnerId(e.target.value); const s = staff.find((x) => x.id === e.target.value); if (s && !editing) setAreaId(s.areaId); }} data-testid="select-metric-owner">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Area">
              <NativeSelect value={areaId} onChange={(e) => setAreaId(e.target.value)} data-testid="select-metric-area">
                {foundation.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Unit" hint="people, $, %, hours, meetings">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={40} placeholder="applications" data-testid="input-metric-unit" />
            </Field>
            <Field label="Decimals">
              <NativeSelect value={decimals} onChange={(e) => setDecimals(e.target.value)} data-testid="select-metric-decimals">
                {[0, 1, 2, 3, 4].map((d) => <option key={d} value={d}>{d}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <div className="rounded-xl border border-[#1D8BC4]/25 bg-[#1D8BC4]/[0.04] p-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Goal type">
                <NativeSelect value={direction} onChange={(e) => setDirection(e.target.value as ScorecardMetricInput['direction'])} data-testid="select-metric-direction">
                  <option value="at_least">At least</option>
                  <option value="at_most">At most</option>
                  <option value="range">Within range</option>
                </NativeSelect>
              </Field>
              <Field label={direction === 'range' ? 'Lower bound' : 'Goal'}>
                <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="font-mono" data-testid="input-metric-target" />
              </Field>
              {direction === 'range' && (
                <Field label="Upper bound">
                  <Input inputMode="decimal" value={upper} onChange={(e) => setUpper(e.target.value)} className="font-mono" data-testid="input-metric-upper" />
                </Field>
              )}
            </div>
            <p className="mt-2.5 text-[12px] text-[#3A4E63]" data-testid="text-goal-preview">
              {goalOk ? <>On track when the week's value is <strong>{goalLabel({ direction, target: t, upperTarget: direction === 'range' ? u : null, unit: unit.trim() }, Number(decimals)).replace(/^At/, 'at')}</strong>{direction === 'range' ? ', inclusive' : ''}. Zero and negative values count.</> : 'Enter a numeric goal.'}
            </p>
            {goalChanged && (
              <p className="mt-2 text-[12px] font-medium text-[#8A5A00]" data-testid="text-goal-change-warning">
                Goal changes apply to weeks recorded from now on. Past weeks keep the goal they were judged against, even if corrected later.
              </p>
            )}
          </div>
          <Field label="Linked QBO key result" hint="Optional context only. Weekly values never update quarterly key result progress; that still moves through check-ins.">
            <NativeSelect value={krId} onChange={(e) => setKrId(e.target.value)} data-testid="select-metric-kr">
              <option value="">Not linked</option>
              {linkedMissing && <option value={krId}>Current link (no longer eligible)</option>}
              {krOptions.map((k) => <option key={k.id} value={k.id}>{k.quarter} · {k.objectiveTitle.slice(0, 40)}: {k.label.slice(0, 60)}</option>)}
            </NativeSelect>
          </Field>
          {error && <p className="rounded-lg bg-[#B03E71]/8 px-3 py-2 text-[13px] text-[#8E2D58]" data-testid="text-metric-error">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-metric">Cancel</Button>
          <Button onClick={submit} disabled={!valid || actions.pending} className="bg-[#0A2540] text-white" data-testid="button-save-metric">
            {actions.pending ? 'Saving' : editing ? 'Save metric' : 'Add metric'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
