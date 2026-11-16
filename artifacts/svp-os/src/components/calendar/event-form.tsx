import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { CalendarEvent, CalendarEventInputDateStatus, CalendarEventInputLocationStatus, CalendarProgram, Staff } from '@workspace/api-client-react';
import { programChoices } from '@/lib/calendar-programs';
import { NativeSelect } from '@/components/native-select';
import { Btn, ConflictNotice, Field, FormError, inputCls } from '@/components/six-by-six/form-kit';
import { DATE_STATUS, LOCATION_STATUS, buildInput, eventToDraft, type DateMode, type EventDraft } from '@/lib/calendar';
import type { CalendarActions } from '@/lib/calendar-hooks';
import { MONTHS } from '@/lib/calendar-time';

const MODES: { id: DateMode; label: string }[] = [
  { id: 'allday', label: 'All day' }, { id: 'timed', label: 'Timed' }, { id: 'tbd', label: 'Date TBD' },
];

export function EventForm({ event, seed, staff, programs, actions, onDone, onReopen }: {
  event: CalendarEvent | null; seed: EventDraft; staff: Staff[]; programs: CalendarProgram[]; actions: CalendarActions; onDone: () => void; onReopen: () => void;
}) {
  const [version] = useState(event?.version ?? 0); // captured at open
  const [d, setD] = useState<EventDraft>(() => (event ? eventToDraft(event) : seed));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (p: Partial<EventDraft>) => setD((x) => ({ ...x, ...p }));
  const [initialProgram] = useState(() => (event ? eventToDraft(event) : seed).program);
  const choices = programChoices(programs, initialProgram);
  const currentChoice = choices.find((c) => c.value === d.program);
  const note = d.kind === 'planning_note';
  const owners = staff.filter((s) => s.active || s.id === event?.ownerId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (conflict) return;
    const r = buildInput(d, version);
    if (!r.ok) { setError(r.error); return; }
    setNotice(r.notice); setError(null); setBusy(true);
    const res = event ? await actions.updateEvent(event.id, r.input) : await actions.createEvent(r.input);
    setBusy(false);
    if (res.ok) onDone(); else { setError(res.message); setConflict(res.conflict); }
  }
  async function remove() {
    if (!event || conflict) return;
    setBusy(true);
    const res = await actions.deleteEvent(event.id, version);
    setBusy(false);
    if (res.ok) onDone(); else { setError(res.message); setConflict(res.conflict); setConfirmDelete(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-calendar-event">
      {conflict && <ConflictNotice onReopen={onReopen} />}
      <Field label="Title"><input className={inputCls} required maxLength={300} value={d.title} onChange={(e) => set({ title: e.target.value })} autoFocus data-testid="input-event-title" /></Field>
      <Field label="Program" hint={programs.length ? 'Programs are managed by admins from the Programs list.' : 'No programs yet. An admin can add them from Programs.'}>
        <NativeSelect aria-label="Program" value={d.program} onChange={(e) => set({ program: e.target.value })} data-testid="select-event-program">
          <option value="">No program</option>
          {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </NativeSelect>
      </Field>
      {currentChoice?.inactive && (
        <p className="rounded-lg bg-[#ECA519]/10 px-3 py-2 text-[13px] text-[#6B4600]" data-testid="text-program-inactive-warning">
          {currentChoice.unmanaged
            ? `"${currentChoice.value}" is not in the managed program list. Saving may be rejected; choose a listed program or No program.`
            : `"${currentChoice.value}" is retired. This event keeps it, but it cannot be newly assigned elsewhere.`}
        </p>
      )}
      {note ? (
        <Field label="Date" hint="Notes sit on one specific day, all day.">
          <input type="date" required min="1900-01-01" max="9999-12-31" className={inputCls} value={d.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: e.target.value })} data-testid="input-note-date" />
        </Field>
      ) : (<>
      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">When</legend>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="radiogroup" aria-label="Date type">
          {MODES.map((m) => (
            <label key={m.id} className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-semibold focus-within:ring-2 focus-within:ring-[#1D8BC4]/40 ${d.mode === m.id ? 'bg-[#0A2540] text-[#FBFAF6]' : 'text-[#3A4E63]'}`}>
              <input type="radio" name="date-mode" className="sr-only" checked={d.mode === m.id} onChange={() => set({ mode: m.id, dateStatus: m.id === 'tbd' ? 'tbd' : d.dateStatus === 'tbd' ? 'proposed' : d.dateStatus })} data-testid={`radio-mode-${m.id}`} />
              {m.label}
            </label>
          ))}
        </div>
        {d.mode === 'tbd' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Planning year" hint="No day is invented.">
              <input type="number" min={1900} max={9999} className={inputCls} value={d.planningYear} onChange={(e) => set({ planningYear: e.target.value })} data-testid="input-event-year" />
            </Field>
            <Field label="Month (optional)" hint="If known, it shows under that month with Day TBD.">
              <NativeSelect aria-label="Planning month" value={d.planningMonth} onChange={(e) => set({ planningMonth: e.target.value })} data-testid="select-event-month">
                <option value="">Month TBD</option>
                {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
              </NativeSelect>
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={d.mode === 'timed' ? 'Starts (date)' : 'First day'}>
              <input type="date" required min="1900-01-01" max="9999-12-31" className={inputCls} value={d.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: d.endDate && d.endDate >= e.target.value ? d.endDate : e.target.value })} data-testid="input-event-start-date" />
            </Field>
            <Field label={d.mode === 'timed' ? 'Ends (date)' : 'Last day (inclusive)'}>
              <input type="date" required min={d.startDate || '1900-01-01'} max="9999-12-31" className={inputCls} value={d.endDate} onChange={(e) => set({ endDate: e.target.value })} data-testid="input-event-end-date" />
            </Field>
            {d.mode === 'timed' && (<>
              <Field label="Start time (Sacramento)"><input type="time" required className={inputCls} value={d.startTime} onChange={(e) => set({ startTime: e.target.value })} data-testid="input-event-start-time" /></Field>
              <Field label="End time (Sacramento)"><input type="time" required className={inputCls} value={d.endTime} onChange={(e) => set({ endTime: e.target.value })} data-testid="input-event-end-time" /></Field>
            </>)}
          </div>
        )}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date status">
          <NativeSelect value={d.dateStatus} onChange={(e) => set({ dateStatus: e.target.value as CalendarEventInputDateStatus })} data-testid="select-event-date-status">
            {Object.entries(DATE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Venue status">
          <NativeSelect value={d.locationStatus} onChange={(e) => set({ locationStatus: e.target.value as CalendarEventInputLocationStatus })} data-testid="select-event-location-status">
            {Object.entries(LOCATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Location"><input className={inputCls} maxLength={1000} value={d.location} onChange={(e) => set({ location: e.target.value })} data-testid="input-event-location" /></Field>
      <Field label="Audience" hint="Separate with commas, e.g. Partners, Board, Investees.">
        <input className={inputCls} value={d.audience} onChange={(e) => set({ audience: e.target.value })} data-testid="input-event-audience" />
      </Field>
      </>)}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Owner (optional)">
          <NativeSelect value={d.ownerId} onChange={(e) => set({ ownerId: e.target.value })} data-testid="select-event-owner">
            <option value="">No owner</option>
            {owners.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label={note ? 'Details (optional)' : 'Notes'}><textarea className={`${inputCls} min-h-[88px]`} maxLength={16000} value={d.notes} onChange={(e) => set({ notes: e.target.value })} data-testid="input-event-notes" /></Field>
      {notice && <p className="rounded-lg bg-[#ECA519]/10 px-3 py-2 text-[13px] text-[#6B4600]" data-testid="text-dst-notice">{notice}</p>}
      <FormError message={conflict ? null : error} />
      {confirmDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#B03E71]/30 bg-[#B03E71]/[0.05] px-3 py-2.5" data-testid="confirm-delete-event">
          <span className="text-sm text-[#8E2D58]">Delete {note ? 'planning note' : ''} "{event?.title}" from the master calendar? Subscribed calendars drop it on their next refresh.</span>
          <div className="flex gap-2">
            <Btn tone="ghost" type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep</Btn>
            <Btn tone="danger" type="button" onClick={remove} disabled={busy} data-testid="button-confirm-delete-event">{busy ? 'Deleting' : 'Delete'}</Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {event ? (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy || conflict} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#8E2D58] hover:underline disabled:opacity-50" data-testid="button-delete-event">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <Btn tone="ghost" type="button" onClick={onDone}>Cancel</Btn>
            <Btn type="submit" disabled={busy || conflict} data-testid="button-save-event">{busy ? 'Saving' : note ? (event ? 'Save note' : 'Add note') : event ? 'Save event' : 'Add event'}</Btn>
          </div>
        </div>
      )}
    </form>
  );
}
