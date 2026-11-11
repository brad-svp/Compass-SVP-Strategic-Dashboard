import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { Cycle, CycleStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusPill } from '@/components/ui-bits';
import { fmtDate } from '@/lib/format';
import { Field } from './field';
import { useFoundationWrite } from './use-foundation-write';

export function CyclesPanel({ cycles }: { cycles: Cycle[] }) {
  const w = useFoundationWrite();
  const [editing, setEditing] = useState<Cycle | 'new' | null>(null);
  const [d, setD] = useState<{ name: string; startDate: string; endDate: string; status: CycleStatus }>({ name: '', startDate: '', endDate: '', status: 'planning' });

  const open = (c: Cycle | 'new') => {
    setEditing(c);
    setD(c === 'new' ? { name: '', startDate: '', endDate: '', status: 'planning' }
      : { name: c.name, startDate: c.startDate.slice(0, 10), endDate: c.endDate.slice(0, 10), status: c.status });
  };
  const valid = d.name.trim() && d.startDate && d.endDate && d.endDate >= d.startDate;
  const submit = () => w.save('cycles', editing === 'new' || !editing ? null : editing.id, { ...d, name: d.name.trim() }, () => setEditing(null));

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open('new')} className="bg-[#0A2540] text-white" data-testid="button-add-cycle"><Plus className="mr-1.5 h-4 w-4" /> Add cycle</Button>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {cycles.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40" data-testid={`row-cycle-${c.id}`}>
            <div className="flex-1">
              <div className="font-display text-lg font-semibold text-[#0A2540]">{c.name}</div>
              <div className="text-[13px] text-muted-foreground">{fmtDate(c.startDate)} to {fmtDate(c.endDate)}</div>
            </div>
            <StatusPill status={c.status} />
            <Button variant="ghost" size="sm" onClick={() => open(c)} data-testid={`button-edit-cycle-${c.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        {cycles.length === 0 && <div className="p-6 text-sm text-muted-foreground">No cycles yet. Add the first one to anchor objectives.</div>}
      </div>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing === 'new' ? 'Add cycle' : 'Edit cycle'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Name"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="input-cycle-name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start"><Input type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} data-testid="input-cycle-start" /></Field>
              <Field label="End"><Input type="date" value={d.endDate} onChange={(e) => setD({ ...d, endDate: e.target.value })} data-testid="input-cycle-end" /></Field>
            </div>
            <Field label="Status">
              <Select value={d.status} onValueChange={(v) => setD({ ...d, status: v as CycleStatus })}>
                <SelectTrigger data-testid="select-cycle-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={submit} disabled={w.pending || !valid} className="bg-[#1D8BC4] text-white" data-testid="button-save-cycle">{w.pending ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
