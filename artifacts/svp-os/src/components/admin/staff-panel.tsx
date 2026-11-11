import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { Area, Staff } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StaffAvatar } from '@/components/ui-bits';
import { Field } from './field';
import { useFoundationWrite } from './use-foundation-write';
import { useStaffSession } from '@/lib/session-context';
import { areaById } from '@/lib/format';

type Draft = { name: string; email: string; role: 'admin' | 'staff'; areaId: string; roleDescription: string; active: boolean };

export function StaffPanel({ staff, areas }: { staff: Staff[]; areas: Area[] }) {
  const me = useStaffSession();
  const w = useFoundationWrite();
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);
  const [d, setD] = useState<Draft>({ name: '', email: '', role: 'staff', areaId: '', roleDescription: '', active: true });

  const open = (s: Staff | 'new') => {
    setEditing(s);
    setD(s === 'new'
      ? { name: '', email: '', role: 'staff', areaId: areas[0]?.id ?? '', roleDescription: '', active: true }
      : { name: s.name, email: s.email ?? '', role: s.role, areaId: s.areaId, roleDescription: s.roleDescription, active: s.active });
  };
  const isSelf = editing !== null && editing !== 'new' && editing.id === me.id;

  const submit = () => {
    const base = { name: d.name.trim(), areaId: d.areaId, roleDescription: d.roleDescription.trim() };
    const data = isSelf ? base : { ...base, email: d.email.trim() || null, role: d.role, active: d.active };
    w.save('staff', editing === 'new' || !editing ? null : editing.id, data, () => setEditing(null));
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open('new')} className="bg-[#0A2540] text-white" data-testid="button-add-staff"><Plus className="mr-1.5 h-4 w-4" /> Add teammate</Button>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {staff.map((s) => {
          const a = areaById(areas, s.areaId);
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40" data-testid={`row-staff-${s.id}`}>
              <StaffAvatar name={s.name} url={s.avatarUrl} color={a?.color} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-[#0A2540]">
                  {s.name}
                  {s.role === 'admin' && <span className="rounded bg-[#0A2540] px-1.5 text-[10px] uppercase text-white">Admin</span>}
                  {!s.active && <span className="rounded bg-muted px-1.5 text-[10px] uppercase text-muted-foreground">Inactive</span>}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {s.email ?? <span className="font-medium text-[#8A5A00]">Sign-in not enabled</span>} · {a?.name ?? 'No area'}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => open(s)} data-testid={`button-edit-staff-${s.id}`}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
            </div>
          );
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing === 'new' ? 'Add teammate' : 'Edit teammate'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Name"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="input-staff-name" /></Field>
            {!isSelf && (
              <Field label="Google email" hint="Leave blank to keep sign-in disabled for this person.">
                <Input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} data-testid="input-staff-email" />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Area">
                <Select value={d.areaId} onValueChange={(v) => setD({ ...d, areaId: v })}>
                  <SelectTrigger data-testid="select-staff-area"><SelectValue placeholder="Choose area" /></SelectTrigger>
                  <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {!isSelf && (
                <Field label="Access">
                  <Select value={d.role} onValueChange={(v) => setD({ ...d, role: v as Draft['role'] })}>
                    <SelectTrigger data-testid="select-staff-role"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                  </Select>
                </Field>
              )}
            </div>
            <Field label="Role description"><Textarea rows={3} value={d.roleDescription} onChange={(e) => setD({ ...d, roleDescription: e.target.value })} data-testid="input-staff-description" /></Field>
            {isSelf ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">Your own email, access level and active status are locked so you can't lock yourself out.</p>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm font-medium">Active</span>
                <Switch checked={d.active} onCheckedChange={(v) => setD({ ...d, active: v })} data-testid="switch-staff-active" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={submit} disabled={w.pending || !d.name.trim() || !d.areaId} className="bg-[#1D8BC4] text-white" data-testid="button-save-staff">{w.pending ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
