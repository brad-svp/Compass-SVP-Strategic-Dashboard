import type { ReactNode } from 'react';
import { MapPin, Pencil, StickyNote, Users } from 'lucide-react';
import type { CalendarEvent, CalendarProgram, Staff } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { Btn } from '@/components/six-by-six/form-kit';
import { fmtDate } from '@/lib/format';
import { LOCATION_STATUS, NOTE_COLOR, isHttpUrl, isNote, isTentative, whenLabel, type EventDraft } from '@/lib/calendar';
import type { CalendarActions } from '@/lib/calendar-hooks';
import { DateStatusBadge, ProgramTag } from './calendar-bits';
import { EventForm } from './event-form';

export type EventTarget = { event: CalendarEvent | null; seed: EventDraft; editing: boolean; nonce: number };

export function EventDialog({ target, staff, programs, isAdmin, actions, onClose, onEdit, onReopen }: {
  target: EventTarget | null; staff: Staff[]; programs: CalendarProgram[]; isAdmin: boolean; actions: CalendarActions;
  onClose: () => void; onEdit: () => void; onReopen: () => void;
}) {
  const e = target?.event ?? null;
  const editing = !!target?.editing;
  const note = e ? isNote(e) : target?.seed.kind === 'planning_note';
  const title = !target ? '' : editing ? (note ? (e ? 'Edit planning note' : 'New planning note') : e ? 'Edit event' : 'New event') : e?.title ?? '';
  const desc = !target ? '' : editing ? (note ? 'A date-specific reminder for staff, such as an application release or deadline. Shows on Month and Timeline.' : 'Times are Sacramento (Pacific) time. Source provenance is kept read-only.') : e ? (note ? whenLabel(e).replace(' · all day', '') : whenLabel(e)) : '';
  return (
    <BrowserDialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }} title={title} description={desc}>
      {target && editing && (
        <EventForm key={`${e?.id ?? 'new'}-${target.nonce}`} event={e} seed={target.seed} staff={staff} programs={programs} actions={actions} onDone={onClose} onReopen={onReopen} />
      )}
      {target && !editing && e && <EventDetails e={e} staff={staff} canEdit={isAdmin && e.canEdit} onEdit={onEdit} onClose={onClose} />}
    </BrowserDialog>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[#0A2540]">{children}</dd>
    </div>
  );
}

function EventDetails({ e, staff, canEdit, onEdit, onClose }: { e: CalendarEvent; staff: Staff[]; canEdit: boolean; onEdit: () => void; onClose: () => void }) {
  const owner = e.ownerId ? staff.find((s) => s.id === e.ownerId) : null;
  return (
    <div data-testid={`detail-event-${e.id}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {isNote(e) ? <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F3F1] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset ring-[#2E7D7A]/35" style={{ color: NOTE_COLOR }} data-testid="badge-planning-note"><StickyNote className="h-3 w-3" /> Planning note</span> : <DateStatusBadge status={e.dateStatus} />}
        {e.program && <ProgramTag e={e} />}
      </div>
      {!isNote(e) && isTentative(e) && e.dateStatus !== 'tbd' && (
        <p className="mb-3 rounded-lg bg-[#ECA519]/10 px-3 py-2 text-[13px] text-[#6B4600]">Tentative: this date is proposed, not confirmed.</p>
      )}
      <dl className="divide-y divide-border/70">
        <Row label="When">{whenLabel(e)}</Row>
        {!isNote(e) && <Row label="Where"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{e.location || 'Not set'}</span> <span className="text-muted-foreground">· {LOCATION_STATUS[e.locationStatus]}</span></Row>}
        {!isNote(e) && <>        <Row label="Audience"><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" />{e.audience.length ? e.audience.join(', ') : 'Not set'}</span></Row></>}
        <Row label="Owner">{owner ? owner.name : 'No owner'}</Row>
        {e.notes && <Row label={isNote(e) ? 'Details' : 'Notes'}><span className="whitespace-pre-wrap">{e.notes}</span></Row>}
        <Row label="Source">
          {e.imported ? (
            <span>Imported once from the Notion master calendar{e.sourceUrl && isHttpUrl(e.sourceUrl) && <> (<a href={e.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-[#125F88] underline" data-testid="link-event-source">Source calendar</a>)</>}. Not a live sync; edits here do not change Notion.</span>
          ) : 'Created in SVP Compass'}
          <span className="block text-[12px] text-muted-foreground">Last updated {fmtDate(e.updatedAt)}</span>
        </Row>
      </dl>
      <div className="mt-4 flex justify-end gap-2">
        <Btn tone="ghost" type="button" onClick={onClose}>Close</Btn>
        {canEdit && <Btn type="button" onClick={onEdit} data-testid="button-edit-event"><Pencil className="h-3.5 w-3.5" /> Edit</Btn>}
      </div>
    </div>
  );
}
