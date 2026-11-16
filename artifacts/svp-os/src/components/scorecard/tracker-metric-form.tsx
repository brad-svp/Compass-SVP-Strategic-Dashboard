import { useEffect, useState, type ReactNode } from 'react';
import { Lock, Plus, X } from 'lucide-react';
import type { CalendarEvent, Foundation, ScorecardMetric, ScorecardMilestone } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EVENT_PRESETS, type EventPreset } from '@/lib/event-metric';
import type { TrackerActions } from '@/lib/scorecard-tracker-hooks';
import {
  MAX_MILESTONES, buildMetricPayload, draftFromMetric, eventDueDate, eventWhen, type Direction, type MetricDraft,
} from '@/lib/scorecard-tracker';

export type KrOption = { id: string; label: string; objectiveTitle: string; quarter: string };

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-[#3A4E63]">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

let keySeq = 0;
const newKey = () => `n${++keySeq}`;

export function TrackerMetricForm({ open, onOpenChange, foundation, krOptions, events, actions, editing, milestones, hasData, nextSort }: {
  open: boolean; onOpenChange: (o: boolean) => void; foundation: Foundation; krOptions: KrOption[]; events: CalendarEvent[];
  actions: TrackerActions; editing: ScorecardMetric | null; milestones: ScorecardMilestone[]; hasData?: boolean; nextSort: number;
}) {
  const staff = foundation.staff.filter((s) => s.active || s.id === editing?.ownerId);
  const blank = (): MetricDraft => {
    const first = staff[0];
    return { title: '', description: '', ownerId: first?.id ?? '', areaId: first?.areaId ?? foundation.areas[0]?.id ?? '', unit: '', decimals: '0',
      direction: 'at_least', target: '', upper: '', krId: '', eventId: '', milestones: [] };
  };
  const [d, setD] = useState<MetricDraft>(blank);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setError('');
    setD(editing ? draftFromMetric(editing, milestones) : blank());
    // init only on open / record switch so polling never wipes a draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set = (p: Partial<MetricDraft>) => setD((x) => ({ ...x, ...p }));
  const unitLocked = !!editing && !!hasData;
  const event = events.find((e) => e.id === d.eventId);
  const linkedMissing = d.krId && !krOptions.some((k) => k.id === d.krId);
  const eventMissing = d.eventId && !event;

  const pickEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    const due = eventDueDate(ev);
    setD((x) => {
      const next = { ...x, eventId: id };
      if (due) {
        if (x.milestones.length === 0) next.milestones = [{ key: newKey(), dueDate: due, target: '', upper: '' }];
        else if (x.milestones[0].dueDate === '') next.milestones = [{ ...x.milestones[0], dueDate: due }, ...x.milestones.slice(1)];
      }
      return next;
    });
  };
  const applyPreset = (p: EventPreset) => {
    if (!event) return;
    const suffix = `: ${EVENT_PRESETS[p].label}`;
    const t = event.title.trim();
    const room = 200 - suffix.length;
    set({ title: (t.length > room ? t.slice(0, room - 1).trimEnd() + '…' : t) + suffix, ...(unitLocked ? {} : { unit: EVENT_PRESETS[p].unit, decimals: p === 'revenue' ? '2' : '0' }) });
  };
  const setMs = (i: number, p: Partial<MetricDraft['milestones'][number]>) => setD((x) => ({ ...x, milestones: x.milestones.map((m, j) => (j === i ? { ...m, ...p } : m)) }));

  const submit = async () => {
    const r = buildMetricPayload(d, editing, nextSort);
    if (!r.ok) { setError(r.message); return; }
    const res = editing ? await actions.updateMetric(editing.id, r.value) : await actions.createMetric(r.value);
    if (res.ok) onOpenChange(false); else setError(res.message);
  };

  const eventOpts = events.filter((e) => e.kind !== 'planning_note' && (e.dateStatus !== 'cancelled' || e.id === d.eventId))
    .sort((a, b) => (a.startDate ?? `${a.planningYear}-99`).localeCompare(b.startDate ?? `${b.planningYear}-99`));

  return (
    <BrowserDialog open={open} onOpenChange={onOpenChange} title={editing ? 'Configure metric' : 'New metric'} testId="dialog-metric-form"
      description="One number, one owner. Dated targets decide on or off track only once they are due.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <section className="space-y-2.5 rounded-xl border border-[#1D8BC4]/25 bg-[#1D8BC4]/[0.04] p-3.5">
          <Field label="Calendar event" hint="Optional. Link registrations, attendance or revenue to a live calendar event.">
            <NativeSelect value={d.eventId} onChange={(e) => pickEvent(e.target.value)} data-testid="select-metric-event">
              <option value="">No event</option>
              {eventMissing && <option value={d.eventId}>Current link (not on calendar)</option>}
              {eventOpts.map((e) => <option key={e.id} value={e.id}>{e.title.slice(0, 60)} · {eventWhen(e)}</option>)}
            </NativeSelect>
          </Field>
          {event && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-[#3A4E63]">Quick metric:</span>
              {(Object.keys(EVENT_PRESETS) as EventPreset[]).map((p) => (
                <button type="button" key={p} onClick={() => applyPreset(p)} className="rounded-full border border-[#1D8BC4]/30 bg-white/70 px-2.5 py-0.5 text-[12px] font-medium text-[#14648F] hover:bg-[#1D8BC4]/10" data-testid={`button-preset-${p}`}>
                  {p === 'attendance' ? 'Attendees' : p === 'revenue' ? 'Revenue' : 'Registration count'}
                </button>
              ))}
              {!eventDueDate(event) && <span className="w-full text-[11.5px] text-[#8A5A00]">This event has no confirmed day, so no target date was filled in.</span>}
            </div>
          )}
        </section>

        <Field label="Metric">
          <Input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} placeholder="Volunteer applications received" data-testid="input-metric-title" />
        </Field>
        <Field label="Description" hint="How it is counted and where the number comes from.">
          <Textarea value={d.description} onChange={(e) => set({ description: e.target.value })} maxLength={4000} rows={2} data-testid="input-metric-description" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Accountable owner">
            <NativeSelect value={d.ownerId} onChange={(e) => { const s = staff.find((x) => x.id === e.target.value); set({ ownerId: e.target.value, ...(s && !editing ? { areaId: s.areaId } : {}) }); }} data-testid="select-metric-owner">
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Area">
            <NativeSelect value={d.areaId} onChange={(e) => set({ areaId: e.target.value })} data-testid="select-metric-area">
              {foundation.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Unit" hint={unitLocked ? <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Fixed once values are recorded, so history stays comparable.</span> : 'registrations, USD, hours, percent'}>
            <Input value={d.unit} readOnly={unitLocked} onChange={(e) => set({ unit: e.target.value })} maxLength={40} className={unitLocked ? 'bg-[#0A2540]/[0.04] text-[#3A4E63]' : ''} data-testid="input-metric-unit" />
          </Field>
          <Field label="Decimals">
            <NativeSelect value={d.decimals} onChange={(e) => set({ decimals: e.target.value })} data-testid="select-metric-decimals">
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>
          </Field>
        </div>

        <section className="space-y-3 rounded-xl border border-[#ECA519]/35 bg-[#ECA519]/[0.05] p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Goal type">
              <NativeSelect value={d.direction} onChange={(e) => set({ direction: e.target.value as Direction })} data-testid="select-metric-direction">
                <option value="at_least">At least</option>
                <option value="at_most">At most</option>
                <option value="range">Within range</option>
              </NativeSelect>
            </Field>
            <Field label={d.direction === 'range' ? 'Standing lower' : 'Standing goal'}>
              <Input inputMode="decimal" value={d.target} onChange={(e) => set({ target: e.target.value })} className="font-mono" data-testid="input-metric-target" />
            </Field>
            {d.direction === 'range' && (
              <Field label="Standing upper">
                <Input inputMode="decimal" value={d.upper} onChange={(e) => set({ upper: e.target.value })} className="font-mono" data-testid="input-metric-upper" />
              </Field>
            )}
          </div>
          <p className="text-[12px] text-[#6B4A00]">The standing goal applies only while there are no dated targets. Leave it blank to use the first dated target.</p>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#3A4E63]">Dated targets ({d.milestones.length})</span>
              <Button type="button" size="sm" variant="ghost" disabled={d.milestones.length >= MAX_MILESTONES} className="h-7 text-[#14648F]"
                onClick={() => set({ milestones: [...d.milestones, { key: newKey(), dueDate: '', target: '', upper: '' }] })} data-testid="button-add-milestone">
                <Plus className="mr-1 h-3.5 w-3.5" />Add target
              </Button>
            </div>
            {d.milestones.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">None. Add targets that ramp toward an event or deadline; each one counts only from its due date.</p>
            ) : (
              <div className="space-y-1.5">
                {d.milestones.map((m, i) => (
                  <div key={m.key} className={`grid items-center gap-1.5 ${d.direction === 'range' ? 'grid-cols-[1.2fr_1fr_1fr_auto]' : 'grid-cols-[1.2fr_1fr_auto]'}`} data-testid={`row-milestone-${i}`}>
                    <Input type="date" value={m.dueDate} onChange={(e) => setMs(i, { dueDate: e.target.value })} aria-label="Due date" className="font-mono text-[13px]" data-testid={`input-milestone-date-${i}`} />
                    <Input inputMode="decimal" value={m.target} onChange={(e) => setMs(i, { target: e.target.value })} placeholder={d.direction === 'range' ? 'Lower' : 'Target'} aria-label="Target" className="font-mono" data-testid={`input-milestone-target-${i}`} />
                    {d.direction === 'range' && <Input inputMode="decimal" value={m.upper} onChange={(e) => setMs(i, { upper: e.target.value })} placeholder="Upper" aria-label="Upper bound" className="font-mono" data-testid={`input-milestone-upper-${i}`} />}
                    <button type="button" aria-label="Remove target" onClick={() => set({ milestones: d.milestones.filter((_, j) => j !== i) })} className="rounded p-1.5 text-[#3A4E63] hover:bg-[#B03E71]/10" data-testid={`button-remove-milestone-${i}`}><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <Field label="Linked QBO key result" hint="Context only. Recorded values never change key result progress.">
          <NativeSelect value={d.krId} onChange={(e) => set({ krId: e.target.value })} data-testid="select-metric-kr">
            <option value="">Not linked</option>
            {linkedMissing && <option value={d.krId}>Current link (no longer eligible)</option>}
            {krOptions.map((k) => <option key={k.id} value={k.id}>{k.quarter} · {k.objectiveTitle.slice(0, 40)}: {k.label.slice(0, 60)}</option>)}
          </NativeSelect>
        </Field>

        {error && <p className="rounded-lg bg-[#B03E71]/8 px-3 py-2 text-[13px] text-[#8E2D58]" data-testid="text-metric-error">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-metric">Cancel</Button>
          <Button type="submit" disabled={actions.pending} className="bg-[#0A2540] text-white" data-testid="button-save-metric">
            {actions.pending ? 'Saving' : editing ? 'Save metric' : 'Add metric'}
          </Button>
        </div>
      </form>
    </BrowserDialog>
  );
}
