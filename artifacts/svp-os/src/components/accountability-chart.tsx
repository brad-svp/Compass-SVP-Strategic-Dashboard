import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAccountabilityQueryKey,
  getGetFoundationQueryKey,
  useCreateAccountabilitySeat,
  useDeleteAccountabilitySeat,
  useUpdateAccountabilitySeat,
  type AccountabilitySeat,
  type AccountabilitySeatInput,
  type AccountabilitySeatInputKind,
  type Staff,
} from '@workspace/api-client-react';
import { ArrowLeftRight, Pencil, Trash2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';
import { cn } from '@/lib/utils';

const NAVY = '#0A2540';
const BLUE = '#1D5FA8';

export function seatSort(a: AccountabilitySeat, b: AccountabilitySeat) {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

export function useSeatActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const c = useCreateAccountabilitySeat();
  const u = useUpdateAccountabilitySeat();
  const d = useDeleteAccountabilitySeat();
  async function run(p: () => Promise<unknown>, msg: string) {
    try {
      await p();
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetAccountabilityQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() }),
      ]);
      toast({ title: msg });
      return true;
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
      return false;
    }
  }
  return {
    pending: c.isPending || u.isPending || d.isPending,
    create: (data: AccountabilitySeatInput) => run(() => c.mutateAsync({ data }), 'Seat added'),
    update: (id: string, data: AccountabilitySeatInput) => run(() => u.mutateAsync({ id, data }), 'Seat updated'),
    remove: (id: string) => run(() => d.mutateAsync({ id }), 'Seat removed'),
  };
}

/* ---------------- Seat card ---------------- */

function OwnerLine({ seat, staff }: { seat: AccountabilitySeat; staff: Staff[] }) {
  const owner = seat.ownerId ? staff.find((s) => s.id === seat.ownerId) : null;
  const name = seat.personName || owner?.name || '';
  const bits = [name, seat.roleLabel, seat.capacity].filter(Boolean);
  return (
    <div className="space-y-1">
      {bits.length ? (
        <div className="text-[13.5px] font-semibold leading-snug text-[#0A2540]" data-testid={`text-seat-person-${seat.id}`}>{bits.join(' · ')}</div>
      ) : (
        <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold italic text-[#8C2F59]"><UserX className="h-3.5 w-3.5" /> Seat open</div>
      )}
      {seat.ownerId && !owner && <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8C2F59]">Linked owner no longer exists</div>}
      {owner && !owner.active && <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8C2F59]">Owner inactive</div>}
      {!seat.ownerId && name && <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Not linked to a staff login</div>}
    </div>
  );
}

function SeatCard({ seat, staff, isAdmin, onEdit, onDelete, compact, reportingLabel }: {
  seat: AccountabilitySeat; staff: Staff[]; isAdmin: boolean; onEdit: (s: AccountabilitySeat) => void; onDelete: (s: AccountabilitySeat) => void; compact?: boolean; reportingLabel?: string;
}) {
  const shared = seat.sharedSeat;
  return (
    <article
      data-testid={`card-seat-${seat.id}`}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border-2 shadow-[0_2px_0_rgba(10,37,64,0.06)]',
        shared ? 'border-[#1D5FA8] bg-[#FBF3D5]' : 'border-[#1D5FA8] bg-card',
      )}
    >
      <header className={cn('flex min-h-[3.25rem] items-center px-3 py-2 text-white', compact ? 'justify-center text-center' : '')} style={{ background: BLUE }}>
        <h3 className={cn('font-semibold uppercase tracking-wide', compact ? 'text-[11.5px] leading-tight' : 'text-[13px]')} data-testid={`text-seat-title-${seat.id}`}>{seat.title}</h3>
      </header>
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        {reportingLabel && <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{reportingLabel}</p>}
        <OwnerLine seat={seat} staff={staff} />
        {shared && <span className="w-fit rounded-full bg-[#ECA519]/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#7A5306]">Shared seat</span>}
        {seat.responsibilities.length ? (
          <ul className="list-disc space-y-1 pl-4 text-[12.5px] leading-snug text-[#3A4E63]">
            {seat.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : <p className="text-[12.5px] italic text-muted-foreground">Responsibilities not written yet.</p>}
        {isAdmin && (
          <div className="mt-auto flex flex-wrap gap-1 pt-2 opacity-80 transition-opacity group-hover:opacity-100">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onEdit(seat)} data-testid={`button-edit-seat-${seat.id}`}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[#8C2F59] hover:text-[#8C2F59]" onClick={() => onDelete(seat)} data-testid={`button-delete-seat-${seat.id}`}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ---------------- Chart ---------------- */

export function AccountabilityChart({ seats, staff, isAdmin, onEdit, onDelete }: {
  seats: AccountabilitySeat[]; staff: Staff[]; isAdmin: boolean; onEdit: (s: AccountabilitySeat) => void; onDelete: (s: AccountabilitySeat) => void;
}) {
  const sorted = [...seats].sort(seatSort);
  const byId = new Map(sorted.map((s) => [s.id, s]));
  const board = sorted.filter((s) => s.kind === 'board');
  const leaders = sorted.filter((s) => s.kind === 'leadership');
  const leaderIds = new Set(leaders.map((l) => l.id));
  const placed = new Set<string>([...board, ...leaders].map((s) => s.id));
  const groups = leaders.map((l) => ({ leader: l, kids: sorted.filter((s) => s.parentId === l.id && s.kind === 'function') }))
    .filter((g) => g.kids.length);
  groups.forEach((g) => g.kids.forEach((k) => placed.add(k.id)));
  const others = sorted.filter((s) => !placed.has(s.id));
  const sharedNames = Array.from(new Set(sorted.filter((s) => s.sharedSeat).map((s) => s.title)));
  const boardIds = new Set(board.map(s => s.id));
  const leadersReportToBoard = leaders.length > 0 && leaders.every(s => s.parentId && boardIds.has(s.parentId));
  const peers = leaders.length === 2 && leaders[0].parentId === leaders[1].parentId;
  const card = { staff, isAdmin, onEdit, onDelete };
  const reportsTo = (s: AccountabilitySeat) => s.parentId ? `Reports to ${byId.get(s.parentId)?.title ?? 'missing seat'}` : 'Top-level seat';

  return (
    <div className="rise rounded-2xl border border-card-border bg-card p-4 md:p-8" data-testid="chart-accountability">
      {/* Board */}
      {board.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-3">
            {board.map((b) => (
              <div key={b.id} className="group relative min-w-[16rem] rounded-lg border-2 border-[#0A2540] bg-[#F6F3EC] px-6 py-2.5 text-center" data-testid={`card-seat-${b.id}`}>
                <div className="text-sm font-bold uppercase tracking-wider text-[#0A2540]">{b.title}</div>
                {(b.ownerId || b.personName || b.roleLabel || b.capacity) && <div className="mt-2 text-left"><OwnerLine seat={b} staff={staff} /></div>}
                {b.parentId && <p className="mt-1 text-xs text-muted-foreground">{reportsTo(b)}</p>}
                {b.sharedSeat && <p className="mt-1 text-xs font-semibold text-[#7A5306]">Shared seat</p>}
                {b.responsibilities.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-left text-xs text-[#3A4E63]">{b.responsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul>}
                {isAdmin && (
                  <div className="mt-1 flex justify-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => onEdit(b)} data-testid={`button-edit-seat-${b.id}`}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-[#8C2F59]" onClick={() => onDelete(b)} data-testid={`button-delete-seat-${b.id}`}>Delete</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {leadersReportToBoard && <span className="h-6 w-0.5" style={{ background: NAVY }} aria-hidden />}
        </div>
      )}

      {/* Leadership */}
      {leaders.length > 0 && (
        <div className="relative">
          {leaders.length > 1 && leadersReportToBoard && <div className="absolute left-1/4 right-1/4 top-0 hidden h-0.5 md:block" style={{ background: NAVY }} aria-hidden />}
          <div className={cn('grid gap-4 md:gap-16', leaders.length > 1 && 'md:grid-cols-2')}>
            {leaders.map((l, i) => (
              <div key={l.id} className="relative md:pt-4">
                {leaders.length > 1 && leadersReportToBoard && <span className="absolute left-1/2 top-0 hidden h-4 w-0.5 md:block" style={{ background: NAVY }} aria-hidden />}
                <SeatCard seat={l} {...card} reportingLabel={reportsTo(l)} />
                {i === 0 && peers && (
                  <div className="absolute -right-14 top-1/2 hidden w-12 -translate-y-1/2 flex-col items-center text-[#0A2540] md:flex" aria-label="Peer relationship">
                    <ArrowLeftRight className="h-5 w-5" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider">Peers</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {peers && <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden">Leadership seats work as peers</p>}
        </div>
      )}

      {/* Function seats grouped by reporting leader */}
      {groups.map(({ leader, kids }) => {
        const leaderIndex = leaders.indexOf(leader);
        const alignRight = leaders.length > 1 && leaderIndex === leaders.length - 1;
        return (
          <div key={leader.id} className="mt-0" data-testid={`group-reports-${leader.id}`}>
            <div className={cn('hidden h-6 md:flex', alignRight ? 'justify-end pr-[25%]' : leaders.length > 1 ? 'justify-start pl-[25%]' : 'justify-center')}>
              <span className="h-full w-0.5" style={{ background: NAVY }} />
            </div>
            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1D8BC4] md:hidden">Reports to {leader.title}</p>
            <div className="relative grid gap-3 border-l-2 border-[#0A2540] pl-4 sm:grid-cols-2 md:border-l-0 md:pl-0 lg:grid-cols-3 xl:grid-cols-6 xl:pt-5">
              <span className="absolute left-[8.33%] right-[8.33%] top-0 hidden h-0.5 xl:block" style={{ background: NAVY }} aria-hidden />
              {kids.map((k) => (
                <div key={k.id} className="relative">
                  <span className="absolute -top-5 left-1/2 hidden h-5 w-0.5 xl:block" style={{ background: NAVY }} aria-hidden />
                  <SeatCard seat={k} compact {...card} />
                </div>
              ))}
            </div>
            <p className="mt-2 hidden text-center text-[11px] text-muted-foreground md:block xl:hidden">All seats above report to {leader.title}.</p>
          </div>
        );
      })}

      {others.length > 0 && (
        <div className="mt-8 border-t border-dashed border-border pt-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1D8BC4]">Other seats</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => {
              const p = o.parentId ? byId.get(o.parentId) : null;
              return (
                <div key={o.id}>
                  <div className="mb-1 text-[11px] text-muted-foreground">{p ? `Reports to ${p.title}` : leaderIds.size ? 'No reporting line set' : 'Top-level seat'}</div>
                  <SeatCard seat={o} {...card} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-[12.5px] italic leading-relaxed text-muted-foreground" data-testid="text-chart-note">
        <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm border border-[#1D5FA8] bg-[#FBF3D5]" />
        {sharedNames.length
          ? `Shaded seats (${sharedNames.join(', ')}) are held by someone alongside their primary seat. Seats with fewer than five roles still need filling in.`
          : 'Shaded seats mark a person holding more than one seat. Seats with fewer than five roles still need filling in.'}
      </p>
    </div>
  );
}

/* ---------------- Editor ---------------- */

type Draft = {
  title: string; kind: AccountabilitySeatInputKind; ownerId: string; personName: string; roleLabel: string;
  capacity: string; responsibilities: string; parentId: string; sharedSeat: boolean; sortOrder: string;
};

function toDraft(s: AccountabilitySeat | null, nextSort: number): Draft {
  return s ? {
    title: s.title, kind: s.kind, ownerId: s.ownerId ?? '', personName: s.personName, roleLabel: s.roleLabel,
    capacity: s.capacity, responsibilities: s.responsibilities.join('\n'), parentId: s.parentId ?? '',
    sharedSeat: s.sharedSeat, sortOrder: String(s.sortOrder),
  } : { title: '', kind: 'function', ownerId: '', personName: '', roleLabel: '', capacity: '', responsibilities: '', parentId: '', sharedSeat: false, sortOrder: String(nextSort) };
}

const sel = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

/** Draft is captured once on mount (parent keys by seat id) so background polling never overwrites edits. */
export function SeatEditor({ seat, seats, staff, open, onClose, actions }: {
  seat: AccountabilitySeat | null; seats: AccountabilitySeat[]; staff: Staff[]; open: boolean; onClose: () => void; actions: ReturnType<typeof useSeatActions>;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(seat, (Math.max(0, ...seats.map((s) => s.sortOrder)) + 10)));
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const stillExists = !seat || seats.some((s) => s.id === seat.id);
  const parents = [...seats].sort(seatSort).filter((s) => s.id !== seat?.id);

  async function save() {
    const resp = d.responsibilities.split('\n').map((r) => r.trim()).filter(Boolean);
    const so = Number(d.sortOrder);
    if (!d.title.trim()) return setErr('Give the seat a title.');
    if (!Number.isInteger(so) || so < 0 || so > 10000) return setErr('Sort order must be a whole number from 0 to 10000.');
    if (resp.length > 30) return setErr('Keep it to 30 responsibilities or fewer.');
    setErr(null);
    const data: AccountabilitySeatInput = {
      title: d.title.trim(), kind: d.kind, ownerId: d.ownerId || null, personName: d.personName.trim(),
      roleLabel: d.roleLabel.trim(), capacity: d.capacity.trim(), responsibilities: resp,
      parentId: d.parentId || null, sharedSeat: d.sharedSeat, sortOrder: so,
    };
    const ok = seat ? await actions.update(seat.id, data) : await actions.create(data);
    if (ok) onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#0A2540]">{seat ? 'Edit seat' : 'Add a seat'}</DialogTitle>
          <DialogDescription>Seats describe the work. People are named on them, not the other way round.</DialogDescription>
        </DialogHeader>
        {!stillExists && <p className="rounded-md bg-[#B03E71]/10 p-2 text-sm text-[#8C2F59]">Someone else removed this seat. Saving will fail; copy anything you need.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="seat-title">Title</Label><Input id="seat-title" maxLength={200} value={d.title} onChange={(e) => set('title', e.target.value)} data-testid="input-seat-title" /></div>
          <div><Label htmlFor="seat-kind">Kind</Label>
            <select id="seat-kind" className={sel} value={d.kind} onChange={(e) => set('kind', e.target.value as AccountabilitySeatInputKind)} data-testid="select-seat-kind">
              <option value="board">Board</option><option value="leadership">Leadership</option><option value="function">Function</option>
            </select></div>
          <div><Label htmlFor="seat-parent">Reports to</Label>
            <select id="seat-parent" className={sel} value={d.parentId} onChange={(e) => set('parentId', e.target.value)} data-testid="select-seat-parent">
              <option value="">No one (top of chart)</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.title}{p.personName ? ` (${p.personName})` : ''}</option>)}
            </select></div>
          <div><Label htmlFor="seat-owner">Owner login</Label>
            <select id="seat-owner" className={sel} value={d.ownerId} onChange={(e) => set('ownerId', e.target.value)} data-testid="select-seat-owner">
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
              {d.ownerId && !staff.some((s) => s.id === d.ownerId) && <option value={d.ownerId}>Missing staff record</option>}
            </select></div>
          <div><Label htmlFor="seat-person">Name shown on chart</Label><Input id="seat-person" maxLength={160} value={d.personName} onChange={(e) => set('personName', e.target.value)} placeholder="Full name" data-testid="input-seat-person" /></div>
          <div><Label htmlFor="seat-role">Role label</Label><Input id="seat-role" maxLength={200} value={d.roleLabel} onChange={(e) => set('roleLabel', e.target.value)} placeholder="COO / Operations" data-testid="input-seat-role" /></div>
          <div><Label htmlFor="seat-capacity">Capacity</Label><Input id="seat-capacity" maxLength={100} value={d.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="Part time" data-testid="input-seat-capacity" /></div>
          <div className="sm:col-span-2"><Label htmlFor="seat-resp">Responsibilities, one per line</Label><Textarea id="seat-resp" rows={6} value={d.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} data-testid="input-seat-responsibilities" /></div>
          <div><Label htmlFor="seat-sort">Sort order</Label><Input id="seat-sort" type="number" min={0} max={10000} value={d.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} data-testid="input-seat-sort" /></div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-[#0A2540]">
            <input type="checkbox" className="h-4 w-4 accent-[#1D5FA8]" checked={d.sharedSeat} onChange={(e) => set('sharedSeat', e.target.checked)} data-testid="checkbox-seat-shared" />
            Shared seat (held alongside another)
          </label>
        </div>
        {err && <p className="text-sm text-[#8C2F59]" data-testid="text-seat-error">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-seat">Cancel</Button>
          <Button onClick={save} disabled={actions.pending} className="bg-[#0A2540] hover:bg-[#0A2540]/90" data-testid="button-save-seat">{actions.pending ? 'Saving...' : seat ? 'Save seat' : 'Add seat'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSeatDialog({ seat, seats, onClose, actions }: {
  seat: AccountabilitySeat | null; seats: AccountabilitySeat[]; onClose: () => void; actions: ReturnType<typeof useSeatActions>;
}) {
  const kids = seat ? seats.filter((s) => s.parentId === seat.id) : [];
  return (
    <AlertDialog open={!!seat} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{seat?.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {kids.length
              ? `${kids.length} seat${kids.length === 1 ? '' : 's'} report to this one (${kids.map((k) => k.title).join(', ')}). Move them to another seat first.`
              : 'This removes the seat and its responsibilities from the chart. The change is recorded in activity.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete-seat">Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={actions.pending || kids.length > 0}
            className="bg-[#B03E71] hover:bg-[#8C2F59]"
            onClick={async (e) => { e.preventDefault(); if (seat && (await actions.remove(seat.id))) onClose(); }}
            data-testid="button-confirm-delete-seat"
          >Delete seat</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

