import { useQueryClient } from '@tanstack/react-query';
import {
  getGetFoundationQueryKey,
  getGetScorecardQueryKey,
  useCreateScorecardMetric,
  useGetScorecard,
  useSaveScorecardEntry,
  useUpdateScorecardMetric,
  type ScorecardEntry,
  type ScorecardEntryInput,
  type ScorecardMetric,
  type ScorecardMetricInput,
  type ScorecardRevision,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, errorStatus } from '@/lib/format';

export const DIRECTION_LABEL: Record<string, string> = {
  at_least: 'At least',
  at_most: 'At most',
  range: 'Within range',
};

export const STATUS_META: Record<string, { label: string; color: string; bg: string; text: string }> = {
  on_track: { label: 'On track', color: '#49B949', bg: 'bg-[#49B949]/14', text: 'text-[#22702A]' },
  off_track: { label: 'Off track', color: '#B03E71', bg: 'bg-[#B03E71]/12', text: 'text-[#8E2D58]' },
  missing: { label: 'Missing', color: '#9AA8B6', bg: 'bg-[#0A2540]/[0.04]', text: 'text-[#3A4E63]' },
};

/* ---------- weeks (UTC Mondays) ---------- */

export function currentMonday(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addWeeks(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

export function isMonday(iso: string | null | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(iso + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1 && d.toISOString().slice(0, 10) === iso;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function short(d: Date) { return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; }
export function weekLabel(iso: string) {
  const s = new Date(iso + 'T00:00:00Z');
  const e = new Date(s); e.setUTCDate(e.getUTCDate() + 6);
  return `${short(s)} to ${short(e)}`;
}
export function weekShort(iso: string) { return short(new Date(iso + 'T00:00:00Z')); }

/* ---------- values & goals ---------- */

export function fmtValue(v: number | null | undefined, decimals: number, unit?: string) {
  if (v == null) return '--';
  const s = v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return unit ? `${s} ${unit}` : s;
}

type Goal = { direction: string; target: number; upperTarget: number | null; unit: string };
export function goalLabel(g: Goal, decimals: number) {
  const f = (n: number) => fmtValue(n, decimals);
  const u = g.unit ? ` ${g.unit}` : '';
  if (g.direction === 'range') return `${f(g.target)} to ${f(g.upperTarget ?? g.target)}${u}`;
  return `${g.direction === 'at_most' ? 'At most' : 'At least'} ${f(g.target)}${u}`;
}
export function sameGoal(a: Goal, b: Goal) {
  return a.direction === b.direction && a.target === b.target && (a.upperTarget ?? null) === (b.upperTarget ?? null) && a.unit === b.unit;
}

export function metricToInput(m: ScorecardMetric): ScorecardMetricInput {
  return {
    title: m.title, description: m.description, ownerId: m.ownerId, areaId: m.areaId, unit: m.unit, decimals: m.decimals,
    direction: m.direction, target: m.target, upperTarget: m.upperTarget, linkedKeyResultId: m.linkedKeyResultId,
    sortOrder: m.sortOrder, active: m.active,
  };
}

export function bySortTitle(a: ScorecardMetric, b: ScorecardMetric) {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

/** Per-metric summary over the visible window. Never sums across metrics. */
export function metricStats(entries: ScorecardEntry[]) {
  const recorded = entries.filter((e) => e.value != null).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const onTrack = recorded.filter((e) => e.status === 'on_track').length;
  const last = recorded[recorded.length - 1];
  const prev = recorded[recorded.length - 2];
  const change = last && prev && last.value != null && prev.value != null ? last.value - prev.value : null;
  return { recorded: recorded.length, onTrack, change, last };
}

export function revisionsFor(revs: ScorecardRevision[], entryId?: string) {
  return entryId ? revs.filter((r) => r.entryId === entryId).sort((a, b) => b.version - a.version) : [];
}

/* ---------- CSV ---------- */

function csvCell(raw: string) {
  let v = raw;
  if (/^[=+@\t\r]/.test(v) || (v.startsWith('-') && !Number.isFinite(Number(v)))) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
/** One row per metric. For every week: value, status, and the goal + unit snapshot that status was judged against. */
export function buildCsv(metrics: ScorecardMetric[], weeks: string[], entries: ScorecardEntry[], staffName: (id: string) => string) {
  const head = ['Metric', 'Owner', 'Current unit', 'Current goal', 'Active'];
  weeks.forEach((w) => head.push(`${w} value`, `${w} unit`, `${w} status`, `${w} goal then`, `${w} note`));
  const rows = metrics.map((m) => {
    const r = [m.title, staffName(m.ownerId), m.unit, goalLabel(m, m.decimals), m.active ? 'yes' : 'archived'];
    weeks.forEach((w) => {
      const e = entries.find((x) => x.metricId === m.id && x.weekStart === w);
      r.push(e?.value == null ? '' : String(e.value), e ? e.unit : '', e ? e.status : 'no entry', e ? goalLabel(e, m.decimals) : '', e?.note ?? '');
    });
    return r;
  });
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}
export function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- hooks ---------- */

export function useScorecard(endWeek?: string) {
  const params = endWeek ? { endWeek } : undefined;
  return useGetScorecard(params, {
    query: { queryKey: getGetScorecardQueryKey(params), refetchInterval: 30_000, refetchOnWindowFocus: true },
  });
}

export type SaveResult = { ok: true } | { ok: false; conflict: boolean; message: string };

export function useScorecardActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateScorecardMetric();
  const update = useUpdateScorecardMetric();
  const save = useSaveScorecardEntry();

  async function run(p: () => Promise<unknown>, success: string): Promise<SaveResult> {
    try {
      await p();
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetScorecardQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetFoundationQueryKey() }),
      ]);
      toast({ title: success });
      return { ok: true };
    } catch (e) {
      const conflict = errorStatus(e) === 409;
      const message = conflict
        ? 'Someone saved this first. Your draft is kept here; close and reopen to see the latest version before trying again.'
        : errorMessage(e);
      toast({ title: conflict ? 'Changed by someone else' : 'Not saved', description: message, variant: 'destructive' });
      if (conflict) await qc.invalidateQueries({ queryKey: getGetScorecardQueryKey() });
      return { ok: false, conflict, message };
    }
  }

  return {
    pending: create.isPending || update.isPending || save.isPending,
    createMetric: (data: ScorecardMetricInput) => run(() => create.mutateAsync({ data }), 'Metric added'),
    updateMetric: (id: string, data: ScorecardMetricInput, msg = 'Metric updated') => run(() => update.mutateAsync({ id, data }), msg),
    saveEntry: (id: string, weekStart: string, data: ScorecardEntryInput, msg = 'Week saved') =>
      run(() => save.mutateAsync({ id, weekStart, data }), msg),
  };
}

export type ScorecardActions = ReturnType<typeof useScorecardActions>;
