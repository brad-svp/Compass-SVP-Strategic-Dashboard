import type {
  CalendarEvent, ScorecardMeasurement, ScorecardMetric, ScorecardMetricInput, ScorecardMilestone, ScorecardMilestoneInput,
} from '@workspace/api-client-react';

/* Pure helpers for the measurement-based scorecard. No React, no '@/' imports, so tests run under plain tsx. */

export type Direction = ScorecardMetricInput['direction'];
export type Goal = { direction: Direction; target: number; upperTarget: number | null };
export type Judgement = 'on_track' | 'off_track' | 'not_due' | 'missing';

export const MAX_MILESTONES = 100;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(s: string | null | undefined): s is string {
  if (!s || !ISO_DAY.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/* ---------- formatting ---------- */

export function fmtNum(v: number, decimals: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function fmtWithUnit(v: number | null | undefined, decimals: number, unit: string) {
  if (v == null) return 'No value';
  return unit ? `${fmtNum(v, decimals)} ${unit}` : fmtNum(v, decimals);
}
export function goalText(g: Goal, decimals: number, unit: string) {
  const u = unit ? ` ${unit}` : '';
  if (g.direction === 'range') return `${fmtNum(g.target, decimals)} to ${fmtNum(g.upperTarget ?? g.target, decimals)}${u}`;
  return `${g.direction === 'at_most' ? 'At most' : 'At least'} ${fmtNum(g.target, decimals)}${u}`;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayLabel(iso: string) {
  if (!isIsoDay(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return `${MON[m - 1]} ${d}, ${y}`;
}
export function stampLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* ---------- people ---------- */

export function staffInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export function authorLabel(staff: { id: string; name: string }[], id: string) {
  const s = staff.find((x) => x.id === id);
  const name = s?.name ?? 'Former staff member';
  return { name, initials: s ? staffInitials(s.name) : '?' };
}

/* ---------- values ---------- */

const ts = (iso: string) => { const t = Date.parse(iso); return Number.isNaN(t) ? 0 : t; };
export function byRecorded(a: ScorecardMeasurement, b: ScorecardMeasurement) {
  return ts(a.recordedAt) - ts(b.recordedAt) || a.id.localeCompare(b.id);
}
/** Latest undeleted measurement for a metric (the server already excludes deleted ones). */
export function latestFor(latest: ScorecardMeasurement[], metricId: string): ScorecardMeasurement | undefined {
  let best: ScorecardMeasurement | undefined;
  for (const m of latest) if (m.metricId === metricId && (!best || byRecorded(best, m) < 0)) best = m;
  return best;
}
/** Zero is a real value. Only a null (legacy cleared week) or absent entry is missing. */
export function currentValue(latest: ScorecardMeasurement[], metricId: string): number | null {
  const m = latestFor(latest, metricId);
  return m && typeof m.value === 'number' && Number.isFinite(m.value) ? m.value : null;
}

/* ---------- goals ---------- */

export function milestonesFor(all: ScorecardMilestone[], metricId: string) {
  return all.filter((m) => m.metricId === metricId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export type GoalState =
  | { mode: 'standing'; goal: Goal; next: null; dueDate: null }
  | { mode: 'due'; goal: Goal; dueDate: string; next: ScorecardMilestone | null }
  | { mode: 'pending'; goal: null; dueDate: null; next: ScorecardMilestone };

/**
 * No dated milestones: the metric's standing target applies.
 * Otherwise the latest milestone with dueDate <= today is the goal in force; if none is due yet,
 * there is no on/off judgement and the first future target is shown as "next". Future targets never count early.
 */
export function goalState(metric: Pick<ScorecardMetric, 'direction' | 'target' | 'upperTarget'>, milestones: Pick<ScorecardMilestone, 'dueDate' | 'target' | 'upperTarget' | 'id' | 'metricId'>[], today: string): GoalState {
  const sorted = [...milestones].sort((a, b) => a.dueDate.localeCompare(b.dueDate)) as ScorecardMilestone[];
  if (sorted.length === 0) {
    return { mode: 'standing', goal: { direction: metric.direction, target: metric.target, upperTarget: metric.direction === 'range' ? metric.upperTarget : null }, next: null, dueDate: null };
  }
  let due: ScorecardMilestone | undefined;
  let next: ScorecardMilestone | null = null;
  for (const m of sorted) {
    if (m.dueDate <= today) due = m;
    else if (!next) next = m;
  }
  if (!due) return { mode: 'pending', goal: null, dueDate: null, next: next! };
  return { mode: 'due', goal: { direction: metric.direction, target: due.target, upperTarget: metric.direction === 'range' ? due.upperTarget : null }, dueDate: due.dueDate, next };
}

export function meets(value: number, g: Goal) {
  if (g.direction === 'at_most') return value <= g.target;
  if (g.direction === 'range') return value >= g.target && value <= (g.upperTarget ?? g.target);
  return value >= g.target;
}
export function judge(value: number | null, state: GoalState): Judgement {
  if (!state.goal) return 'not_due';
  if (value == null) return 'missing';
  return meets(value, state.goal) ? 'on_track' : 'off_track';
}

/* ---------- metric payloads ---------- */

export type MilestoneDraft = { key: string; dueDate: string; target: string; upper: string };
export type MetricDraft = {
  title: string; description: string; ownerId: string; areaId: string; unit: string; decimals: string;
  direction: Direction; target: string; upper: string; krId: string; eventId: string; milestones: MilestoneDraft[];
};

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

export function validateMilestones(rows: MilestoneDraft[], direction: Direction): { ok: true; value: ScorecardMilestoneInput[] } | { ok: false; message: string } {
  if (rows.length > MAX_MILESTONES) return { ok: false, message: `At most ${MAX_MILESTONES} dated targets.` };
  const seen = new Set<string>();
  const out: ScorecardMilestoneInput[] = [];
  for (const r of rows) {
    if (!isIsoDay(r.dueDate)) return { ok: false, message: 'Every dated target needs a real due date.' };
    if (seen.has(r.dueDate)) return { ok: false, message: `Two targets share ${dayLabel(r.dueDate)}. Dates must be unique.` };
    seen.add(r.dueDate);
    const t = num(r.target);
    if (!Number.isFinite(t)) return { ok: false, message: `Target for ${dayLabel(r.dueDate)} must be a number.` };
    let u: number | null = null;
    if (direction === 'range') {
      u = num(r.upper);
      if (!Number.isFinite(u)) return { ok: false, message: `Upper bound for ${dayLabel(r.dueDate)} must be a number.` };
      if (u < t) return { ok: false, message: `Upper bound for ${dayLabel(r.dueDate)} must be at least the lower bound.` };
    }
    out.push({ dueDate: r.dueDate, target: t, upperTarget: u });
  }
  out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { ok: true, value: out };
}

/** Optimistic version token: the server's updatedAt for this metric. */
// Narrow accessor until the regenerated DTO (required updatedAt) lands; harmless afterwards.
export function versionOf(m: ScorecardMetric): string | undefined {
  const u = (m as ScorecardMetric & { updatedAt?: unknown }).updatedAt;
  return typeof u === 'string' && u ? u : undefined;
}

export function buildMetricPayload(d: MetricDraft, editing: ScorecardMetric | null, nextSort: number): { ok: true; value: ScorecardMetricInput } | { ok: false; message: string } {
  if (!d.title.trim() || !d.ownerId || !d.areaId) return { ok: false, message: 'Title, owner and area are required.' };
  const ms = validateMilestones(d.milestones, d.direction);
  if (!ms.ok) return ms;
  let t = num(d.target);
  let u: number | null = d.direction === 'range' ? num(d.upper) : null;
  if (!Number.isFinite(t) && ms.value.length > 0) { t = ms.value[0].target; u = d.direction === 'range' ? ms.value[0].upperTarget : null; }
  if (!Number.isFinite(t)) return { ok: false, message: 'Add a standing goal or at least one dated target.' };
  if (d.direction === 'range' && (u == null || !Number.isFinite(u) || u < t)) return { ok: false, message: 'Standing upper bound must be at least the lower bound.' };
  const value: ScorecardMetricInput = {
    title: d.title.trim(), description: d.description.trim(), ownerId: d.ownerId, areaId: d.areaId, unit: d.unit.trim(),
    decimals: Number(d.decimals) || 0, direction: d.direction, target: t, upperTarget: d.direction === 'range' ? u : null,
    linkedKeyResultId: d.krId || null, sortOrder: editing ? editing.sortOrder : nextSort, active: editing ? editing.active : true,
    calendarEventId: d.eventId || null, milestones: ms.value,
  };
  if (editing) {
    const v = versionOf(editing);
    if (!v) return { ok: false, message: 'This metric is missing its version; reload the page before saving.' };
    value.expectedUpdatedAt = v;
  }
  return { ok: true, value };
}

/** Archive / restore / reorder: milestones omitted so the server keeps them; event and KR links preserved. */
export function structuralPayload(m: ScorecardMetric, patch: Partial<Pick<ScorecardMetricInput, 'active' | 'sortOrder'>>): ScorecardMetricInput {
  const out: ScorecardMetricInput = {
    title: m.title, description: m.description, ownerId: m.ownerId, areaId: m.areaId, unit: m.unit, decimals: m.decimals,
    direction: m.direction, target: m.target, upperTarget: m.upperTarget, linkedKeyResultId: m.linkedKeyResultId,
    sortOrder: m.sortOrder, active: m.active, calendarEventId: m.calendarEventId ?? null, ...patch,
  };
  const v = versionOf(m);
  if (v) out.expectedUpdatedAt = v;
  return out;
}

export function draftFromMetric(m: ScorecardMetric, milestones: ScorecardMilestone[]): MetricDraft {
  return {
    title: m.title, description: m.description, ownerId: m.ownerId, areaId: m.areaId, unit: m.unit, decimals: String(m.decimals),
    direction: m.direction, target: String(m.target), upper: m.upperTarget == null ? '' : String(m.upperTarget),
    krId: m.linkedKeyResultId ?? '', eventId: m.calendarEventId ?? '',
    milestones: milestones.map((x) => ({ key: x.id, dueDate: x.dueDate, target: String(x.target), upper: x.upperTarget == null ? '' : String(x.upperTarget) })),
  };
}

/* ---------- calendar ---------- */

/** Only a real, concrete start date. Month-only or TBD events never yield an invented day. */
export function eventDueDate(e: Pick<CalendarEvent, 'startDate' | 'dateStatus'> | undefined): string | null {
  if (!e || e.dateStatus === 'tbd' || e.dateStatus === 'cancelled') return null;
  return isIsoDay(e.startDate) ? e.startDate : null;
}
export function eventWhen(e: Pick<CalendarEvent, 'startDate' | 'planningYear' | 'planningMonth' | 'dateStatus'>) {
  const d = eventDueDate(e);
  if (d) return dayLabel(d);
  const m = e.planningMonth ? `${MON[e.planningMonth - 1]} ` : '';
  return `${m}${e.planningYear}, date not set`;
}

/* ---------- CSV (long form, one row per measurement) ---------- */

export function csvCell(raw: string) {
  let v = raw;
  if (/^[=+@\t\r]/.test(v) || (v.startsWith('-') && !Number.isFinite(Number(v)))) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export function buildMeasurementCsv(
  metrics: ScorecardMetric[], entries: Record<string, ScorecardMeasurement[]>, staff: { id: string; name: string }[],
) {
  const head = ['Metric', 'Metric owner', 'Recorded at (UTC)', 'Value', 'Unit', 'Note', 'Author', 'Author initials', 'Legacy week', 'Legacy reason'];
  const rows: string[][] = [];
  for (const m of metrics) {
    const owner = authorLabel(staff, m.ownerId).name;
    for (const e of [...(entries[m.id] ?? [])].sort(byRecorded)) {
      const a = authorLabel(staff, e.authorId);
      rows.push([m.title, owner, e.recordedAt, e.value == null ? '' : String(e.value), e.unit, e.note, a.name, a.initials, e.sourceWeekStart ?? '', e.legacyReason ?? '']);
    }
  }
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

/** Points whose recorded unit differs from the metric's current unit are never converted or co-plotted. */
export function splitByUnit(entries: ScorecardMeasurement[], unit: string) {
  const same: ScorecardMeasurement[] = [], other: ScorecardMeasurement[] = [];
  for (const e of entries) ((e.unit ?? '') === unit ? same : other).push(e);
  return { same, other, otherUnits: [...new Set(other.map((e) => e.unit || '(no unit)'))] };
}
