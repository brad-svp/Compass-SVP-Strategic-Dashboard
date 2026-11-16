import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CalendarEvent } from '@workspace/api-client-react';
import { buildTimeline, scrollDeltaTo } from '../src/lib/calendar-timeline';
import { blankDraft, buildInput, eventToDraft, whenLabel } from '../src/lib/calendar';

const ev = (id: string, startDate: string | null, endDate: string | null = startDate, planningYear = 2026, planningMonth: number | null = null) => ({
  id, title: id, program: '', planningYear, planningMonth, startDate, endDate, allDay: true, startsAt: null, endsAt: null, location: '',
  dateStatus: 'confirmed', locationStatus: 'tbd', audience: [], wixUrl: '', notes: '', ownerId: null, expectedVersion: 1,
  version: 1, sourceUrl: null, imported: false, canEdit: true, updatedAt: '',
}) as CalendarEvent;

test('cross-year chronology splits past, ongoing, upcoming without duplicates', () => {
  const t = buildTimeline([
    ev('old', '2025-11-02'), ev('run', '2026-06-01', '2026-06-20'), ev('today', '2026-06-10'),
    ev('next', '2027-02-01'), ev('span', '2026-12-30', '2027-01-02'), ev('tbd', null, null, 2027),
  ], '2026-06-10');
  assert.deepEqual(t.past.map((m) => m.key), ['2025-11']);
  assert.deepEqual(t.ongoing.map((e) => e.id), ['run']);
  assert.deepEqual(t.upcoming.map((m) => m.key), ['2026-06', '2026-12', '2027-02']);
  assert.deepEqual(t.undated, [{ year: 2027, events: [t.undated[0].events[0]] }]);
  const ids = [...t.past, ...t.upcoming].flatMap((m) => m.events.map((e) => e.id)).concat(t.ongoing.map((e) => e.id));
  assert.equal(new Set(ids).size, 5);
  assert.equal(t.total, 6);
});
test('all-past records still produce a today anchor position', () => {
  const t = buildTimeline([ev('a', '2024-01-01')], '2026-06-10');
  assert.equal(t.upcoming.length, 0);
  assert.equal(t.past.length, 1);
});
test('scroll delta uses bounding rects', () => {
  assert.equal(scrollDeltaTo(100, 900, 12), 788);
  assert.equal(scrollDeltaTo(100, 50, 0), -50);
});

test('month-only TBD events join their planning month; current month is upcoming', () => {
  const t = buildTimeline([
    ev('mPast', null, null, 2026, 3), ev('mNow', null, null, 2026, 6), ev('mNext', null, null, 2027, 1),
    ev('yOnly', null, null, 2027), ev('dated', '2026-03-05'),
  ], '2026-06-10');
  assert.deepEqual(t.past.map((m) => [m.key, m.events.map((e) => e.id)]), [['2026-03', ['dated', 'mPast']]]);
  assert.deepEqual(t.upcoming.map((m) => [m.key, m.events.map((e) => e.id)]), [['2026-06', ['mNow']], ['2027-01', ['mNext']]]);
  assert.deepEqual(t.undated.map((g) => g.events.map((e) => e.id)), [['yOnly']]);
  assert.equal(t.ongoing.length, 0);
});
test('month-only label is honest and dated events ignore planningMonth', () => {
  assert.equal(whenLabel(ev('a', null, null, 2027, 2)), 'February 2027 · Day TBD');
  assert.equal(whenLabel(ev('b', null, null, 2027)), 'Date TBD · 2027');
  assert.match(whenLabel(ev('c', '2026-05-01', '2026-05-01', 2026, 9)), /May 1, 2026/);
});
test('draft round-trips planning month and clears it for dated events', () => {
  const d = eventToDraft(ev('a', null, null, 2027, 11));
  assert.equal(d.planningMonth, '11');
  const r = buildInput(d, 1);
  assert.ok(r.ok && r.input.planningMonth === 11 && r.input.startDate === null);
  const none = buildInput({ ...blankDraft(2027), title: 'x' }, 0);
  assert.ok(none.ok && none.input.planningMonth === null);
  const dated = buildInput({ ...d, mode: 'allday', startDate: '2027-11-03', endDate: '2027-11-03' }, 1);
  assert.ok(dated.ok && dated.input.planningMonth === null);
  assert.equal(buildInput({ ...d, planningMonth: '13' }, 1).ok, false);
});
