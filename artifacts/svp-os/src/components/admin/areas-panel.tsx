import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { Area } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from './field';
import { useFoundationWrite } from './use-foundation-write';

const SWATCHES = ['#1D8BC4', '#49B949', '#ECA519', '#B03E71', '#0A2540'];

export function AreasPanel({ areas }: { areas: Area[] }) {
  const w = useFoundationWrite();
  const [editing, setEditing] = useState<Area | 'new' | null>(null);
  const [d, setD] = useState({ name: '', color: '#1D8BC4', sortOrder: '0' });
  const sorted = [...areas].sort((a, b) => a.sortOrder - b.sortOrder);

  const open = (a: Area | 'new') => {
    setEditing(a);
    setD(a === 'new' ? { name: '', color: '#1D8BC4', sortOrder: String(areas.length + 1) } : { name: a.name, color: a.color, sortOrder: String(a.sortOrder) });
  };
  const submit = () =>
    w.save('areas', editing === 'new' || !editing ? null : editing.id, { name: d.name.trim(), color: d.color, sortOrder: Number(d.sortOrder) || 0 }, () => setEditing(null));

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open('new')} className="bg-[#0A2540] text-white" data-testid="button-add-area"><Plus className="mr-1.5 h-4 w-4" /> Add area</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((a) => (
          <div key={a.id} className="lift flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3" data-testid={`row-area-${a.id}`}>
            <span className="h-8 w-8 rounded-lg" style={{ background: a.color }} />
            <div className="flex-1">
              <div className="font-semibold text-[#0A2540]">{a.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">Order {a.sortOrder} · {a.color}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => open(a)} data-testid={`button-edit-area-${a.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing === 'new' ? 'Add area' : 'Edit area'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Name"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="input-area-name" /></Field>
            <Field label="Color">
              <div className="flex items-center gap-2">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" onClick={() => setD({ ...d, color: c })} aria-label={`Color ${c}`}
                    className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${d.color === c ? 'ring-2 ring-offset-2 ring-[#0A2540]' : ''}`} style={{ background: c }} data-testid={`button-swatch-${c.slice(1)}`} />
                ))}
                <Input className="ml-2 w-28 font-mono" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} data-testid="input-area-color" />
              </div>
            </Field>
            <Field label="Sort order"><Input type="number" value={d.sortOrder} onChange={(e) => setD({ ...d, sortOrder: e.target.value })} data-testid="input-area-order" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={submit} disabled={w.pending || !d.name.trim()} className="bg-[#1D8BC4] text-white" data-testid="button-save-area">{w.pending ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
