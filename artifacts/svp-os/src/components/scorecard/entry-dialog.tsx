import { useEffect, useState } from 'react';
import type { ScorecardEntry, ScorecardMetric, ScorecardRevision, Staff } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EntryHistory } from '@/components/scorecard/entry-history';
import { STATUS_META, currentMonday, fmtValue, goalLabel, sameGoal, weekLabel, type ScorecardActions } from '@/lib/scorecard';
import { cn } from '@/lib/utils';

export function EntryDialog({ open, onOpenChange, metric, weekStart, entry, revisions, staff, actions }: {
  open: boolean; onOpenChange: (o: boolean) => void; metric: ScorecardMetric; weekStart: string;
  entry?: ScorecardEntry; revisions: ScorecardRevision[]; staff: Staff[]; actions: ScorecardActions;
}) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!open) return;
    setValue(entry?.value == null ? '' : String(entry.value));
    setNote(entry?.note ?? ''); setReason(''); setClearing(false); setError(''); setConflict(false);
    setVersion(entry?.version ?? 0);
    // snapshot the version we opened; polling must never change what we send or wipe the draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, metric.id, weekStart]);

  const canWrite = metric.canRecord && metric.active;
  const future = weekStart > currentMonday();
  const parsed = value.trim() === '' ? null : Number(value);
  const numOk = parsed != null && Number.isFinite(parsed);
  const hadValue = entry?.value != null;
  const correcting = hadValue && numOk && parsed !== entry?.value;
  const reasonNeeded = correcting || clearing;
  const noteChanged = note.trim() !== (entry?.note ?? '');
  const changed = clearing || (numOk && (parsed !== (entry?.value ?? null) || noteChanged));
  const valid = !conflict && changed && (clearing || numOk) && (!reasonNeeded || reason.trim().length > 0);
  const status = entry ? STATUS_META[entry.status] : null;
  const snapshotDiffers = entry && !sameGoal(entry, metric);

  const submit = async () => {
    if (!valid) return;
    const r = await actions.saveEntry(metric.id, weekStart, {
      value: clearing ? null : parsed, note: note.trim(), reason: reason.trim(), expectedVersion: version,
    }, clearing ? 'Week cleared; history kept' : 'Week saved');
    if (r.ok) onOpenChange(false);
    else { setError(r.message); setConflict(r.conflict); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto bg-[#FBFAF6] sm:max-w-lg">
        <DialogHeader>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1D8BC4]" data-testid="text-entry-week">Week of {weekLabel(weekStart)}</div>
          <DialogTitle className="font-display text-2xl text-[#0A2540]">{metric.title}</DialogTitle>
          <DialogDescription>Current goal: {goalLabel(metric, metric.decimals)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
          <div className="font-mono text-2xl font-medium tabular-nums text-[#0A2540]" data-testid="text-entry-current">
            {entry ? (entry.value == null ? 'Cleared' : fmtValue(entry.value, metric.decimals, entry.unit)) : 'No entry'}
          </div>
          {status && <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', status.bg, status.text)} data-testid="status-entry">{status.label}</span>}
          {entry && <span className="ml-auto font-mono text-[11px] text-muted-foreground">v{entry.version}</span>}
          {snapshotDiffers && (
            <p className="w-full text-[12px] text-[#8A5A00]" data-testid="text-entry-snapshot">Judged against the goal at the time: {goalLabel(entry, metric.decimals)}</p>
          )}
          {entry?.note && !canWrite && <p className="w-full whitespace-pre-wrap text-[13px] text-[#1E3349]">{entry.note}</p>}
        </div>

        {canWrite && !future ? (
          <div className="space-y-4">
            {!clearing ? (
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">Value{(entry?.unit ?? metric.unit) ? ` (${entry?.unit ?? metric.unit})` : ''}</Label>
                <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="h-12 font-mono text-lg" placeholder="0" data-testid="input-entry-value" autoFocus />
                <p className="text-[12px] text-muted-foreground">Zero and negative numbers are valid. Leave the week unsaved if it truly has no number yet.</p>
                {value.trim() !== '' && !numOk && <p className="text-[12px] text-[#B03E71]">Enter a number.</p>}
              </div>
            ) : (
              <p className="rounded-lg bg-[#B03E71]/8 px-3 py-2 text-[13px] text-[#8E2D58]" data-testid="text-clear-confirm">
                Clearing marks this week as missing. The previous value stays in history.
              </p>
            )}
            {!entry && (
              <p className="text-[12px] text-[#3A4E63]" data-testid="text-backfill-note">
                A new entry is judged against the current goal ({goalLabel(metric, metric.decimals)}), even for an older week.
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold uppercase tracking-wider text-[#3A4E63]">Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={4000} placeholder="Context for the team, optional" data-testid="input-entry-note" />
            </div>
            {reasonNeeded && (
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold uppercase tracking-wider text-[#8A5A00]">Reason for {clearing ? 'clearing' : 'correction'} (required)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Recount after intake form audit" data-testid="input-entry-reason" />
              </div>
            )}
            {error && <p className="rounded-lg bg-[#B03E71]/8 px-3 py-2 text-[13px] text-[#8E2D58]" data-testid="text-entry-error">{error}</p>}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground" data-testid="text-entry-readonly">
            {future ? 'Future weeks open on their Monday.' : !metric.active ? 'This metric is archived, so its weeks are read-only.' : 'Only the metric owner or an admin can record this week.'}
          </p>
        )}

        <section className="border-t border-border/70 pt-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3A4E63]">History</h3>
          <EntryHistory revisions={revisions} staff={staff} decimals={metric.decimals} />
        </section>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {canWrite && !future && hadValue && (
              <Button variant="ghost" className="text-[#B03E71]" onClick={() => { setClearing((c) => !c); setError(''); }} data-testid="button-toggle-clear">
                {clearing ? 'Keep value' : 'Clear value'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-close-entry">{canWrite ? 'Cancel' : 'Close'}</Button>
            {canWrite && !future && (
              <Button onClick={submit} disabled={!valid || actions.pending} className={clearing ? 'bg-[#B03E71] text-white hover:bg-[#9A3563]' : 'bg-[#1D8BC4] text-white hover:bg-[#177AAE]'} data-testid="button-save-entry">
                {actions.pending ? 'Saving' : clearing ? 'Clear this week' : entry ? 'Save correction' : 'Record week'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
