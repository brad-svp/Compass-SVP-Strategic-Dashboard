import { useState, type FormEvent } from 'react';
import type { SixMoment, SixPeriod } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import type { SixActions } from '@/lib/six-by-six';
import { Btn, ConflictNotice, Field, FormError, inputCls } from './form-kit';

export type MomentTarget = { moment: SixMoment; period: SixPeriod; nonce: number };

export function MomentDialog({ target, actions, onClose, onReopen }: {
  target: MomentTarget | null; actions: SixActions; onClose: () => void; onReopen: () => void;
}) {
  return (
    <BrowserDialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}
      title={target ? `Moment ${target.moment.position}` : ''}
      description={target ? `The shared milestone for row ${target.moment.position} of ${target.period.name}.` : ''}>
      {target && <MomentForm key={`${target.moment.id}-${target.nonce}`} target={target} actions={actions} onClose={onClose} onReopen={onReopen} />}
    </BrowserDialog>
  );
}

function MomentForm({ target, actions, onClose, onReopen }: { target: MomentTarget; actions: SixActions; onClose: () => void; onReopen: () => void }) {
  const { moment, period } = target;
  const [version] = useState(moment.version);
  const [title, setTitle] = useState(moment.title);
  const [eventDate, setEventDate] = useState(moment.eventDate?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const min = period.startDate.slice(0, 10), max = period.endDate.slice(0, 10);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (conflict) return;
    if (eventDate && (eventDate < min || eventDate > max)) { setError(`Pick a date between ${min} and ${max}.`); return; }
    setBusy(true); setError(null);
    const res = await actions.updateMoment(moment.id, { title: title.trim(), eventDate: eventDate || null, expectedVersion: version });
    setBusy(false);
    if (res.ok) onClose(); else { setError(res.message); setConflict(res.conflict); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-six-moment">
      {conflict && <ConflictNotice onReopen={onReopen} />}
      <Field label="Title" hint={`Leave blank to show "Moment ${moment.position}".`}>
        <input className={inputCls} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} autoFocus data-testid="input-moment-title" />
      </Field>
      <Field label="Event date" hint="Optional. Must fall inside the period.">
        <div className="flex gap-2">
          <input type="date" className={inputCls} value={eventDate} min={min} max={max} onChange={(e) => setEventDate(e.target.value)} data-testid="input-moment-date" />
          {eventDate && <Btn tone="ghost" type="button" onClick={() => setEventDate('')}>Clear</Btn>}
        </div>
      </Field>
      <FormError message={conflict ? null : error} />
      <div className="flex justify-end gap-2">
        <Btn tone="ghost" type="button" onClick={onClose}>Cancel</Btn>
        <Btn type="submit" disabled={busy || conflict} data-testid="button-save-moment">{busy ? 'Saving' : 'Save moment'}</Btn>
      </div>
    </form>
  );
}
