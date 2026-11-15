import { useState, type FormEvent } from 'react';
import type { SixPeriod, SixPeriodInputStatus } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { NativeSelect } from '@/components/native-select';
import { PERIOD_STATUSES, periodNameFor, periodToDraft, validatePeriod, type PeriodDraft, type SixActions } from '@/lib/six-by-six';
import { Btn, ConflictNotice, Field, FormError, inputCls } from './form-kit';

export type PeriodTarget = { period: SixPeriod | null; draft: PeriodDraft; nonce: number };

export function PeriodDialog({ target, all, actions, onClose, onReopen, onCreated }: {
  target: PeriodTarget | null; all: SixPeriod[]; actions: SixActions; onClose: () => void; onReopen: () => void; onCreated: (id: string) => void;
}) {
  return (
    <BrowserDialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}
      title={target?.period ? 'Edit period' : 'New 6x6 period'}
      description={target?.period ? 'Dates, meeting and status. Moments and items stay as they are.' : 'Six empty moment rows are created with it. Dates are suggested from the neighbouring period.'}>
      {target && <PeriodForm key={`${target.period?.id ?? 'new'}-${target.nonce}`} target={target} all={all} actions={actions} onClose={onClose} onReopen={onReopen} onCreated={onCreated} />}
    </BrowserDialog>
  );
}

function PeriodForm({ target, all, actions, onClose, onReopen, onCreated }: {
  target: PeriodTarget; all: SixPeriod[]; actions: SixActions; onClose: () => void; onReopen: () => void; onCreated: (id: string) => void;
}) {
  const existing = target.period;
  const [version] = useState(existing?.version ?? 0);
  const [d, setD] = useState<PeriodDraft>(() => existing ? periodToDraft(existing) : target.draft);
  const [nameTouched, setNameTouched] = useState(!!existing);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  function setDates(patch: Partial<PeriodDraft>) {
    setD((prev) => {
      const next = { ...prev, ...patch };
      if (!nameTouched && next.startDate && next.endDate) next.name = periodNameFor(next.startDate, next.endDate);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (conflict) return;
    const msg = validatePeriod(d, all, existing?.id);
    if (msg) { setError(msg); return; }
    if (d.meetingDate && (d.meetingDate < d.startDate || d.meetingDate > d.endDate)) { setError('Meeting date should fall inside the period.'); return; }
    setBusy(true); setError(null);
    const data = { ...d, name: d.name.trim(), expectedVersion: version };
    if (existing) {
      const res = await actions.updatePeriod(existing.id, data);
      setBusy(false);
      if (res.ok) onClose(); else { setError(res.message); setConflict(res.conflict); }
    } else {
      const res = await actions.createPeriod(data);
      setBusy(false);
      if (res.ok) { if (res.id) onCreated(res.id); onClose(); }
      else { setError(res.message); setConflict(res.conflict); }
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-six-period">
      {conflict && <ConflictNotice onReopen={onReopen} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts">
          <input type="date" required className={inputCls} value={d.startDate} onChange={(e) => setDates({ startDate: e.target.value })} data-testid="input-period-start" />
        </Field>
        <Field label="Ends">
          <input type="date" required className={inputCls} value={d.endDate} min={d.startDate} onChange={(e) => setDates({ endDate: e.target.value })} data-testid="input-period-end" />
        </Field>
      </div>
      <Field label="Name" hint={nameTouched ? undefined : 'Follows the dates until you type your own.'}>
        <input className={inputCls} required maxLength={160} value={d.name} onChange={(e) => { setNameTouched(true); setD({ ...d, name: e.target.value }); }} data-testid="input-period-name" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meeting date">
          <input type="date" className={inputCls} value={d.meetingDate ?? ''} min={d.startDate} max={d.endDate} onChange={(e) => setD({ ...d, meetingDate: e.target.value || null })} data-testid="input-period-meeting" />
        </Field>
        <Field label="Status">
          <NativeSelect value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as SixPeriodInputStatus })} data-testid="select-period-status">
            {PERIOD_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Meeting notes">
        <textarea className={`${inputCls} min-h-[88px]`} maxLength={12000} value={d.meetingNotes} onChange={(e) => setD({ ...d, meetingNotes: e.target.value })} data-testid="input-period-notes" />
      </Field>
      <FormError message={conflict ? null : error} />
      <div className="flex justify-end gap-2">
        <Btn tone="ghost" type="button" onClick={onClose}>Cancel</Btn>
        <Btn type="submit" disabled={busy || conflict} data-testid="button-save-period">{busy ? 'Saving' : existing ? 'Save period' : 'Create period'}</Btn>
      </div>
    </form>
  );
}
