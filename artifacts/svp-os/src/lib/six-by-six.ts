import { useQueryClient } from '@tanstack/react-query';
import {
  getGetFoundationQueryKey,
  getGetSixBySixQueryKey,
  useCreateSixItem,
  useCreateSixPeriod,
  useDeleteSixItem,
  useGetSixBySix,
  useUpdateSixItem,
  useUpdateSixMoment,
  useUpdateSixPeriod,
  type SixItem,
  type SixItemInput,
  type SixItemUpdate,
  type SixMomentInput,
  type SixPeriod,
  type SixPeriodInput,
  type Staff,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, errorStatus } from '@/lib/format';

export const ITEM_STATUS: Record<string, { label: string; dot: string; chip: string }> = {
  planned: { label: 'Planned', dot: '#9AA8B6', chip: 'bg-[#0A2540]/[0.04] text-[#3A4E63] ring-[#0A2540]/12' },
  in_progress: { label: 'In progress', dot: '#1D8BC4', chip: 'bg-[#1D8BC4]/10 text-[#125F88] ring-[#1D8BC4]/30' },
  blocked: { label: 'Blocked', dot: '#B03E71', chip: 'bg-[#B03E71]/10 text-[#8E2D58] ring-[#B03E71]/30' },
  done: { label: 'Done', dot: '#49B949', chip: 'bg-[#49B949]/12 text-[#22702A] ring-[#49B949]/35' },
};
export const ITEM_STATUSES = ['planned', 'in_progress', 'blocked', 'done'] as const;
export const PERIOD_STATUSES = ['draft', 'active', 'closed'] as const;
export const PERIOD_DAYS = 42;

/* ---------- dates (ISO yyyy-mm-dd, UTC arithmetic) ---------- */

export function todayIso(now = new Date()) {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const d10 = (s: string) => s.slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mar to Apr 2026", "Dec 2025 to Jan 2026", "May 2026". */
export function periodNameFor(start: string, end: string) {
  const [sy, sm] = [Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1];
  const [ey, em] = [Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1];
  if (sy === ey && sm === em) return `${MON[sm]} ${sy}`;
  if (sy === ey) return `${MON[sm]} to ${MON[em]} ${sy}`;
  return `${MON[sm]} ${sy} to ${MON[em]} ${ey}`;
}

/* ---------- navigation ---------- */

export function sortPeriods(periods: SixPeriod[]) {
  return [...periods].sort((a, b) => d10(a.startDate).localeCompare(d10(b.startDate)) || a.id.localeCompare(b.id));
}
export function containsDate(p: SixPeriod, iso: string) {
  return d10(p.startDate) <= iso && iso <= d10(p.endDate);
}
/** Period containing today, else nearest past, else first future. */
export function actualPeriodIndex(sorted: SixPeriod[], today: string) {
  if (!sorted.length) return -1;
  const hit = sorted.findIndex((p) => containsDate(p, today));
  if (hit >= 0) return hit;
  let past = -1;
  sorted.forEach((p, i) => { if (d10(p.endDate) < today) past = i; });
  return past >= 0 ? past : 0;
}
export function resolveAnchor(sorted: SixPeriod[], requested: string | null, today: string) {
  const i = requested ? sorted.findIndex((p) => p.id === requested) : -1;
  return i >= 0 ? i : actualPeriodIndex(sorted, today);
}

export type PeriodDraft = Omit<SixPeriodInput, 'expectedVersion'>;
export function adjacentDraft(dir: 'prev' | 'next', ref: SixPeriod | null, today: string): PeriodDraft {
  let start: string, end: string;
  if (!ref) { start = today; end = addDays(today, PERIOD_DAYS - 1); }
  else if (dir === 'prev') { end = addDays(d10(ref.startDate), -1); start = addDays(end, -(PERIOD_DAYS - 1)); }
  else { start = addDays(d10(ref.endDate), 1); end = addDays(start, PERIOD_DAYS - 1); }
  return { name: periodNameFor(start, end), startDate: start, endDate: end, meetingDate: null, meetingNotes: '', status: 'draft' };
}
export function periodToDraft(p: SixPeriod): PeriodDraft {
  return { name: p.name, startDate: d10(p.startDate), endDate: d10(p.endDate), meetingDate: p.meetingDate ? d10(p.meetingDate) : null, meetingNotes: p.meetingNotes, status: p.status };
}

/** Client-side mirror of server rules; returns a message or null. */
export function validatePeriod(d: PeriodDraft, all: SixPeriod[], selfId?: string) {
  if (!d.name.trim()) return 'Give the period a name.';
  if (!d.startDate || !d.endDate) return 'Start and end dates are required.';
  if (d.endDate < d.startDate) return 'End date must be on or after the start date.';
  const clash = all.find((p) => p.id !== selfId && d10(p.startDate) <= d.endDate && d.startDate <= d10(p.endDate));
  if (clash) return `These dates overlap "${clash.name}".`;
  const self = all.find((p) => p.id === selfId);
  const outside = self?.moments.find((m) => m.eventDate && (d10(m.eventDate) < d.startDate || d10(m.eventDate) > d.endDate));
  if (outside) return `Moment ${outside.position} is dated ${d10(outside.eventDate!)}; keep the period around it or move that date first.`;
  return null;
}

/* ---------- columns, permissions, summaries ---------- */

/** Active staff plus anyone (even inactive) who owns items in this period. */
export function columnsFor(staff: Staff[], items: SixItem[], periodId: string) {
  const owners = new Set(items.filter((i) => i.periodId === periodId).map((i) => i.ownerId));
  return staff.filter((s) => s.active || owners.has(s.id));
}
export function canCreateFor(actor: Pick<Staff, 'id' | 'role'>, owner: Pick<Staff, 'id' | 'active'>) {
  return owner.active && (actor.role === 'admin' || actor.id === owner.id);
}
export function summarize(items: SixItem[]) {
  return { total: items.length, done: items.filter((i) => i.status === 'done').length, blocked: items.filter((i) => i.status === 'blocked').length };
}

/* ---------- hooks ---------- */

export function useSixWorkspace() {
  return useGetSixBySix({ query: { queryKey: getGetSixBySixQueryKey(), refetchInterval: 30_000, refetchOnWindowFocus: true } });
}

export type SaveResult = { ok: true; id?: string } | { ok: false; conflict: boolean; message: string };

export function useSixActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createPeriod = useCreateSixPeriod();
  const updatePeriod = useUpdateSixPeriod();
  const updateMoment = useUpdateSixMoment();
  const createItem = useCreateSixItem();
  const updateItem = useUpdateSixItem();
  const deleteItem = useDeleteSixItem();

  async function run(p: () => Promise<unknown>, success: string): Promise<SaveResult> {
    try {
      const out = await p();
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetSixBySixQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() }),
      ]);
      toast({ title: success });
      const id = out && typeof out === 'object' && 'id' in out ? String((out as { id: unknown }).id) : undefined;
      return { ok: true, id };
    } catch (e) {
      const conflict = errorStatus(e) === 409;
      const message = conflict
        ? 'Someone saved this first. Your draft is still here; reopen to load the latest version before saving again.'
        : errorMessage(e);
      toast({ title: conflict ? 'Changed by someone else' : 'Not saved', description: message, variant: 'destructive' });
      if (conflict) await qc.invalidateQueries({ queryKey: getGetSixBySixQueryKey() });
      return { ok: false, conflict, message };
    }
  }

  return {
    pending: createPeriod.isPending || updatePeriod.isPending || updateMoment.isPending || createItem.isPending || updateItem.isPending || deleteItem.isPending,
    createPeriod: (data: SixPeriodInput) => run(() => createPeriod.mutateAsync({ data }), 'Period created'),
    updatePeriod: (id: string, data: SixPeriodInput) => run(() => updatePeriod.mutateAsync({ id, data }), 'Period updated'),
    updateMoment: (id: string, data: SixMomentInput) => run(() => updateMoment.mutateAsync({ id, data }), 'Moment updated'),
    createItem: (data: SixItemInput) => run(() => createItem.mutateAsync({ data }), 'Item added'),
    updateItem: (id: string, data: SixItemUpdate) => run(() => updateItem.mutateAsync({ id, data }), 'Item saved'),
    deleteItem: (id: string, expectedVersion: number) => run(() => deleteItem.mutateAsync({ id, data: { expectedVersion } }), 'Item removed'),
  };
}
export type SixActions = ReturnType<typeof useSixActions>;
