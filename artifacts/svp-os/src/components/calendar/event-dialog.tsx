import type { ReactNode } from 'react';
import { ExternalLink, MapPin, Pencil, Users } from 'lucide-react';
import type { CalendarEvent, CalendarProgram, Staff } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { Btn } from '@/components/six-by-six/form-kit';
import { fmtDate } from '@/lib/format';
import { LOCATION_STATUS, isHttpUrl, isTentative, whenLabel, type EventDraft } from '@/lib/calendar';
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
  const title = !target ? '' : editing ? (e ? 'Edit event' : 'New event') : e?.title ?? '';
  const desc = !target ? '' : editing ? 'Times are Sacramento (Pacific) time. Source provenance is kept read-only.' : e ? whenLabel(e) : '';
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
        <DateStatusBadge status={e.dateStatus} /><ProgramTag e={e} />
      </div>
      {isTentative(e) && e.dateStatus !== 'tbd' && (
        <p className="mb-3 rounded-lg bg-[#ECA519]/10 px-3 py-2 text-[13px] text-[#6B4600]">Tentative: this date is proposed, not confirmed.</p>
      )}
      <dl className="divide-y divide-border/70">
        <Row label="When">{whenLabel(e)}</Row>
        <Row label="Where"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{e.location || 'Not set'}</span> <span className="text-muted-foreground">· {LOCATION_STATUS[e.locationStatus]}</span></Row>
        <Row label="Audience"><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" />{e.audience.length ? e.audience.join(', ') : 'Not set'}</span></Row>
        <Row label="Owner">{owner ? owner.name : 'No owner'}</Row>
        {e.wixUrl && <Row label="Wix page">{isHttpUrl(e.wixUrl) ? <a href={e.wixUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[#125F88] underline" data-testid="link-event-wix">{e.wixUrl}<ExternalLink className="h-3 w-3" /></a> : e.wixUrl}</Row>}
        {e.notes && <Row label="Notes"><span className="whitespace-pre-wrap">{e.notes}</span></Row>}
        <Row label="Source">
          {e.imported ? (
            <span>Imported once from the Notion master calendar{e.sourceUrl && isHttpUrl(e.sourceUrl) && <> (<a href={e.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-[#125F88] underline" data-testid="link-event-source">Source calendar</a>)</>}. Not a live sync; edits here do not change Notion.</span>
          ) : 'Created in SVP OS'}
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
