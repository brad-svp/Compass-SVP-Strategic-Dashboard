import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ScorecardMeasurement, ScorecardMetric, ScorecardMilestone } from '@workspace/api-client-react';
import {
  authorLabel, buildMeasurementCsv, buildMetricPayload, currentValue, draftFromMetric, eventDueDate, goalState, judge,
  splitByUnit, staffInitials, structuralPayload, validateMilestones, type MetricDraft,
} from '../src/lib/scorecard-tracker';

const metric = (p: Partial<ScorecardMetric> = {}): ScorecardMetric => ({
  id: 'm1', title: 'Fast Pitch: Registrations', description: '', ownerId: 's1', areaId: 'a1', unit: 'registrations', decimals: 0,
  direction: 'at_least', target: 10, upperTarget: null, linkedKeyResultId: 'kr9', sortOrder: 2, active: true,
  canEdit: true, canRecord: true, calendarEventId: 'ev1', ...p,
});
const ms = (dueDate: string, target: number, upperTarget: number | null = null): ScorecardMilestone => ({ id: dueDate, metricId: 'm1', dueDate, target, upperTarget });
const meas = (p: Partial<ScorecardMeasurement>): ScorecardMeasurement => ({
  id: 'e', metricId: 'm1', value: 1, note: '', authorId: 's1', unit: 'registrations', recordedAt: '2026-01-01T00:00:00Z', sourceWeekStart: null, legacyReason: null, canDelete: false, ...p,
});

test('zero is a real current value; null legacy clearing is missing', () => {
  const latest = [meas({ id: 'a', value: 5, recordedAt: '2026-01-01T00:00:00Z' }), meas({ id: 'b', value: 0, recordedAt: '2026-02-01T00:00:00Z' })];
  assert.equal(currentValue(latest, 'm1'), 0);
  assert.equal(judge(0, goalState(metric({ direction: 'at_most', target: 0 }), [], '2026-02-02')), 'on_track');
  assert.equal(currentValue([meas({ value: null })], 'm1'), null);
  assert.equal(judge(null, goalState(metric(), [], '2026-02-02')), 'missing');
});

test('milestones: before first due there is no judgement, only a next target', () => {
  const s = goalState(metric(), [ms('2026-04-01', 100), ms('2026-03-01', 50)], '2026-02-15');
  assert.equal(s.mode, 'pending');
  assert.equal(s.next?.dueDate, '2026-03-01');
  assert.equal(judge(0, s), 'not_due');
});

test('milestones: due date inclusive, future never judged early, after last stays on last', () => {
  const list = [ms('2026-03-01', 50), ms('2026-04-01', 100)];
  const onDue = goalState(metric(), list, '2026-03-01');
  assert.equal(onDue.mode === 'due' && onDue.goal.target, 50);
  assert.equal(judge(60, onDue), 'on_track');
  const after = goalState(metric(), list, '2027-01-01');
  assert.equal(after.mode === 'due' && after.goal.target, 100);
  assert.equal(after.next, null);
  assert.equal(judge(60, after), 'off_track');
});

test('standing target is fallback only without milestones', () => {
  assert.equal(goalState(metric({ target: 999 }), [ms('2026-01-01', 3)], '2026-02-01').goal?.target, 3);
  assert.equal(goalState(metric({ target: 999 }), [], '2026-02-01').mode, 'standing');
});

test('range uses upper bound inclusively', () => {
  const s = goalState(metric({ direction: 'range', target: 10, upperTarget: 20 }), [ms('2026-01-01', 5, 8)], '2026-02-01');
  assert.equal(judge(8, s), 'on_track');
  assert.equal(judge(8.5, s), 'off_track');
  assert.equal(judge(4, s), 'off_track');
});

test('milestone validation: unique dates, real days, range ordering', () => {
  const r = (dueDate: string, target = '1', upper = '') => ({ key: dueDate + target, dueDate, target, upper });
  assert.equal(validateMilestones([r('2026-03-01'), r('2026-03-01', '2')], 'at_least').ok, false);
  assert.equal(validateMilestones([r('2026-02-30')], 'at_least').ok, false);
  assert.equal(validateMilestones([r('2026-03-01', '5', '4')], 'range').ok, false);
  const ok = validateMilestones([r('2026-04-01', '0'), r('2026-03-01', '2')], 'at_least');
  assert.ok(ok.ok && ok.value[0].dueDate === '2026-03-01' && ok.value[1].target === 0);
});

test('initials and permissions labels', () => {
  assert.equal(staffInitials('Mary Ann Okafor'), 'MO');
  assert.equal(staffInitials('Cher'), 'CH');
  assert.deepEqual(authorLabel([{ id: 's1', name: 'Dana Lee' }], 's1'), { name: 'Dana Lee', initials: 'DL' });
  assert.equal(authorLabel([], 'gone').name, 'Former staff member');
});

test('edit payload: milestones, version token, cleared event becomes null, KR context kept', () => {
  const m = { ...metric(), updatedAt: '2026-01-05T10:00:00.000Z' } as ScorecardMetric;
  const d: MetricDraft = { ...draftFromMetric(m, [ms('2026-03-01', 50)]), eventId: '' };
  const r = buildMetricPayload(d, m, 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.calendarEventId, null);
  assert.equal(r.value.expectedUpdatedAt, '2026-01-05T10:00:00.000Z');
  assert.deepEqual(r.value.milestones, [{ dueDate: '2026-03-01', target: 50, upperTarget: null }]);
  assert.equal(r.value.linkedKeyResultId, 'kr9');
  assert.equal(r.value.sortOrder, 2);
});

test('blank standing goal falls back to first dated target', () => {
  const d: MetricDraft = { ...draftFromMetric(metric(), []), target: '', milestones: [{ key: 'k', dueDate: '2026-05-01', target: '0', upper: '' }] };
  const r = buildMetricPayload(d, null, 7);
  assert.ok(r.ok && r.value.target === 0 && r.value.expectedUpdatedAt === undefined && r.value.sortOrder === 7);
});

test('archive/reorder payload omits milestones and preserves links', () => {
  const p = structuralPayload(metric(), { active: false });
  assert.equal('milestones' in p, false);
  assert.equal(p.active, false);
  assert.equal(p.calendarEventId, 'ev1');
  assert.equal(p.linkedKeyResultId, 'kr9');
});

test('event prefill only for a real day', () => {
  assert.equal(eventDueDate({ startDate: '2026-06-12', dateStatus: 'confirmed' }), '2026-06-12');
  assert.equal(eventDueDate({ startDate: null, dateStatus: 'proposed' }), null);
  assert.equal(eventDueDate({ startDate: '2026-06-12', dateStatus: 'tbd' }), null);
});

test('long-form CSV keeps zero, legacy context and author labels', () => {
  const csv = buildMeasurementCsv([metric()], { m1: [
    meas({ id: 'b', value: 0, note: '=bad', recordedAt: '2026-02-01T00:00:00Z' }),
    meas({ id: 'a', value: null, sourceWeekStart: '2025-12-29', legacyReason: 'Cleared', recordedAt: '2026-01-01T00:00:00Z' }),
  ] }, [{ id: 's1', name: 'Dana Lee' }]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /,,registrations,,Dana Lee,DL,2025-12-29,Cleared$/);
  assert.match(lines[2], /,0,registrations,'=bad,Dana Lee,DL,,$/);
});

test('editing without a version token is refused', () => {
  const r = buildMetricPayload(draftFromMetric(metric(), []), metric(), 0);
  assert.equal(r.ok, false);
});

test('mixed legacy units are separated, not converted', () => {
  const r = splitByUnit([meas({ id: 'a', unit: 'people' }), meas({ id: 'b' })], 'registrations');
  assert.deepEqual([r.same.length, r.other.length, r.otherUnits], [1, 1, ['people']]);
});
