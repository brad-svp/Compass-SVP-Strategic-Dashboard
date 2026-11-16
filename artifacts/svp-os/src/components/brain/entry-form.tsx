import { useState, type FormEvent } from 'react';
import { useCreateBrainEntry, useUpdateBrainEntry, type Area, type BrainEntry, type BrainEntryInput, type BrainEntryInputKind, type CalendarProgram, type Staff } from '@workspace/api-client-react';
import { BrowserDialog } from '@/components/browser-dialog';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useStaffSession } from '@/lib/session-context';
import { BRAIN_KINDS, entryToInput, kindLabel, useBrainInvalidate, useBrainToastError } from '@/lib/brain';

export function EntryFormDialog({ open, onOpenChange, entry, staff, areas, programs, defaultReviewDays, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; entry?: BrainEntry; staff: Staff[]; areas: Area[]; programs: CalendarProgram[];
  defaultReviewDays: number; onCreated?: (id: string) => void;
}) {
  const me = useStaffSession();
  const { toast } = useToast();
  const fail = useBrainToastError();
  const invalidate = useBrainInvalidate();
  const create = useCreateBrainEntry();
  const update = useUpdateBrainEntry();
  const base: BrainEntryInput = entry ? entryToInput(entry) : {
    title: '', summary: '', content: '', kind: 'procedure', programId: null, areaId: me.areaId || null, ownerId: me.id,
    tags: [], sourceUrls: [], links: [], visibility: 'staff', reviewIntervalDays: defaultReviewDays, expectedVersion: 0,
  };
  const [f, setF] = useState(base);
  const [tags, setTags] = useState(base.tags.join(', '));
  const [urls, setUrls] = useState(base.sourceUrls.join('\n'));
  const [requestKey] = useState(() => `brain-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const set = <K extends keyof BrainEntryInput>(k: K, v: BrainEntryInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const pending = create.isPending || update.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    const data: BrainEntryInput = {
      ...f, title: f.title.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20),
      sourceUrls: urls.split('\n').map((u) => u.trim()).filter(Boolean).slice(0, 20),
      reviewIntervalDays: Math.min(730, Math.max(7, Number(f.reviewIntervalDays) || defaultReviewDays)),
      expectedVersion: entry ? entry.version : 0,
    };
    if (entry) {
      update.mutate({ id: entry.id, data }, {
        onSuccess: () => { invalidate(entry.id); toast({ title: 'Entry updated' }); onOpenChange(false); },
        onError: (err) => fail(err),
      });
    } else {
      create.mutate({ data: { ...data, requestKey } }, {
        onSuccess: (r) => { invalidate(); toast({ title: 'Contribution added', description: 'It is searchable now and marked Unreviewed.' }); onOpenChange(false); onCreated?.(r.id); },
        onError: (err) => fail(err),
      });
    }
  }

  return (
    <BrowserDialog open={open} onOpenChange={onOpenChange} testId="dialog-brain-entry"
      title={entry ? 'Edit entry' : 'Contribute knowledge'}
      description={entry ? `Saving against version ${entry.version}.` : 'New contributions are searchable immediately and marked Unreviewed until an admin approves them.'}>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1"><Label htmlFor="b-title">Title</Label>
          <Input id="b-title" required maxLength={240} value={f.title} onChange={(e) => set('title', e.target.value)} data-testid="input-brain-title" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label>Type</Label>
            <NativeSelect aria-label="Type" value={f.kind} onChange={(e) => set('kind', e.target.value as BrainEntryInputKind)} data-testid="select-brain-kind">
              {BRAIN_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </NativeSelect></div>
          <div className="space-y-1"><Label>Owner</Label>
            <NativeSelect aria-label="Owner" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)} data-testid="select-brain-owner">
              {staff.filter((s) => s.active || s.id === f.ownerId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect></div>
          <div className="space-y-1"><Label>Program</Label>
            <NativeSelect aria-label="Program" value={f.programId ?? ''} onChange={(e) => set('programId', e.target.value || null)} data-testid="select-brain-program">
              <option value="">No program</option>
              {programs.filter((p) => p.active || p.id === f.programId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect></div>
          <div className="space-y-1"><Label>Area</Label>
            <NativeSelect aria-label="Area" value={f.areaId ?? ''} onChange={(e) => set('areaId', e.target.value || null)} data-testid="select-brain-area">
              <option value="">No area</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </NativeSelect></div>
        </div>
        <div className="space-y-1"><Label htmlFor="b-summary">Summary</Label>
          <Textarea id="b-summary" rows={2} maxLength={2000} value={f.summary} onChange={(e) => set('summary', e.target.value)} data-testid="input-brain-summary" /></div>
        <div className="space-y-1"><Label htmlFor="b-content">Content</Label>
          <Textarea id="b-content" rows={8} maxLength={80000} value={f.content} onChange={(e) => set('content', e.target.value)} className="font-mono text-[12.5px]" data-testid="input-brain-content" />
          <p className="text-right font-mono text-[10px] text-muted-foreground">{f.content.length.toLocaleString()} / 80,000</p></div>
        <div className="space-y-1"><Label htmlFor="b-tags">Tags <span className="font-normal text-muted-foreground">(comma separated)</span></Label>
          <Input id="b-tags" value={tags} onChange={(e) => setTags(e.target.value)} data-testid="input-brain-tags" /></div>
        <div className="space-y-1"><Label htmlFor="b-urls">Source links <span className="font-normal text-muted-foreground">(one per line)</span></Label>
          <Textarea id="b-urls" rows={2} value={urls} onChange={(e) => setUrls(e.target.value)} data-testid="input-brain-urls" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label>Visibility</Label>
            <NativeSelect aria-label="Visibility" value={f.visibility} onChange={(e) => set('visibility', e.target.value as BrainEntryInput['visibility'])} data-testid="select-brain-visibility">
              <option value="staff">All staff</option>
              <option value="admin" disabled={me.role !== 'admin'}>Admins only</option>
            </NativeSelect></div>
          <div className="space-y-1"><Label htmlFor="b-interval">Review every (days)</Label>
            <Input id="b-interval" type="number" min={7} max={730} value={f.reviewIntervalDays} onChange={(e) => set('reviewIntervalDays', Number(e.target.value))} data-testid="input-brain-interval" /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-brain-cancel">Cancel</Button>
          <Button type="submit" disabled={pending || !f.title.trim()} data-testid="button-brain-save">{pending ? 'Saving...' : entry ? 'Save changes' : 'Add to Brain'}</Button>
        </div>
      </form>
    </BrowserDialog>
  );
}
