import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SixPeriod, SixItem } from '@workspace/api-client-react';
import { actualPeriodIndex, adjacentDraft, canCreateFor, columnsFor, periodNameFor, resolveAnchor, sortPeriods, summarize, validatePeriod } from '../src/lib/six-by-six';

const P = (id: string, s: string, e: string): SixPeriod => ({ id, name: id, startDate: s, endDate: e, meetingDate: null, meetingNotes: '', status: 'active', version: 1, moments: [] });
const ps = sortPeriods([P('c', '2026-03-01', '2026-04-11'), P('a', '2026-01-01', '2026-02-11'), P('b', '2026-01-01', '2026-01-02')]);

test('sorts by start then id', () => assert.deepEqual(ps.map((p) => p.id), ['a', 'b', 'c']));
test('anchor: containing, nearest past, first future', () => {
  assert.equal(actualPeriodIndex(ps, '2026-03-10'), 2);
  assert.equal(actualPeriodIndex(ps, '2026-02-20'), 1);
  assert.equal(actualPeriodIndex(ps, '2025-01-01'), 0);
  assert.equal(resolveAnchor(ps, 'a', '2026-03-10'), 0);
  assert.equal(resolveAnchor(ps, 'missing', '2026-03-10'), 2);
});
test('adjacent drafts span 42 days', () => {
  const n = adjacentDraft('next', ps[2], '2026-03-10');
  assert.equal(n.startDate, '2026-04-12'); assert.equal(n.endDate, '2026-05-23');
  const p = adjacentDraft('prev', ps[2], '2026-03-10');
  assert.equal(p.endDate, '2026-02-28'); assert.equal(p.startDate, '2026-01-18');
  assert.equal(periodNameFor('2025-12-10', '2026-01-20'), 'Dec 2025 to Jan 2026');
});
test('validation blocks overlap and inverted dates', () => {
  assert.match(validatePeriod({ ...adjacentDraft('next', null, '2026-03-05') }, ps)!, /overlap/);
  assert.match(validatePeriod({ ...adjacentDraft('next', ps[2], 'x'), endDate: '2026-04-01' }, ps)!, /End date/);
  assert.equal(validatePeriod(adjacentDraft('next', ps[2], 'x'), ps), null);
});
test('columns keep inactive owners with items; permissions', () => {
  const staff = [{ id: 'x', active: true }, { id: 'y', active: false }, { id: 'z', active: false }] as never;
  const items = [{ id: 'i', periodId: 'c', ownerId: 'y', status: 'done' }] as SixItem[];
  assert.deepEqual(columnsFor(staff, items, 'c').map((s) => s.id), ['x', 'y']);
  assert.deepEqual(summarize(items), { total: 1, done: 1, blocked: 0 });
  assert.equal(canCreateFor({ id: 'x', role: 'staff' }, { id: 'x', active: true }), true);
  assert.equal(canCreateFor({ id: 'x', role: 'staff' }, { id: 'q', active: true }), false);
  assert.equal(canCreateFor({ id: 'x', role: 'admin' }, { id: 'y', active: false }), false);
});
