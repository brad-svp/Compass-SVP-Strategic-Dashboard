import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CalendarEvent } from '@workspace/api-client-react';
import { zonedToUtc, utcToZoned, isValidIsoDate } from '../src/lib/calendar-time';
import { blankDraft, buildInput, eventToDraft, inYear, monthWeeks, notesOn, timedOn, weekBars, parseAudience } from '../src/lib/calendar';

test('winter PST and summer PDT conversion', () => {
  assert.deepEqual(zonedToUtc('2026-01-15', '18:30'), { ok: true, iso: '2026-01-16T02:30:00.000Z', ambiguous: false });
  assert.deepEqual(zonedToUtc('2026-07-01', '09:00'), { ok: true, iso: '2026-07-01T16:00:00.000Z', ambiguous: false });
  assert.equal(utcToZoned(Date.parse('2026-01-16T02:30:00Z')).date, '2026-01-15');
});
test('nonexistent spring-forward and ambiguous fall-back', () => {
  assert.deepEqual(zonedToUtc('2026-03-08', '02:30'), { ok: false, reason: 'nonexistent' });
  assert.deepEqual(zonedToUtc('2026-11-01', '01:30'), { ok: true, iso: '2026-11-01T08:30:00.000Z', ambiguous: true });
  assert.equal(isValidIsoDate('2026-02-30'), false);
  assert.equal(isValidIsoDate('1899-12-31'), false);
});
const ev = (o: Partial<CalendarEvent>) => ({ id: 'e', title: 't', program: 'Board', planningYear: 2026, startDate: null, endDate: null, allDay: true, startsAt: null, endsAt: null,
  location: '', dateStatus: 'confirmed', locationStatus: 'tbd', audience: [], wixUrl: '', notes: '', ownerId: null, expectedVersion: 1, version: 1, sourceUrl: null, imported: false, canEdit: true, updatedAt: '', ...o }) as CalendarEvent;
test('planning notes retain their type and date without entering event lanes', () => {
  const draft = { ...blankDraft(2027, '2027-04-05', 'planning_note'), title: 'Applications open', notes: 'Share instructions.' };
  const built = buildInput(draft, 0);
  assert.ok(built.ok);
  if (!built.ok) return;
  assert.equal(built.input.kind, 'planning_note'); assert.equal(built.input.endDate, '2027-04-05');
  assert.equal(built.input.allDay, true); assert.equal(built.input.startsAt, null);
  assert.equal(buildInput({ ...draft, startDate: '' }, 0).ok, false);
  const note = ev({ ...built.input, id: 'note' });
  assert.equal(eventToDraft(note).kind, 'planning_note');
  assert.equal(notesOn('2027-04-05', [note]).length, 1);
  assert.equal(notesOn('2027-04-06', [note]).length, 0);
  assert.equal(timedOn('2027-04-05', [note]).length, 0);
  assert.equal(weekBars(monthWeeks(2027, 3).find(w => w.includes('2027-04-05'))!, [note]).bars.length, 0);
});
test('cross-year all-day overlaps both years; TBD uses planning year', () => {
  const x = ev({ startDate: '2026-12-30', endDate: '2027-01-02', planningYear: 2026 });
  assert.equal(inYear(x, 2026), true); assert.equal(inYear(x, 2027), true); assert.equal(inYear(x, 2028), false);
  assert.equal(inYear(ev({ planningYear: 2027 }), 2027), true);
  assert.equal(inYear(ev({ planningYear: 2027 }), 2026), false);
});
test('inclusive multi-day bars split across weeks', () => {
  const weeks = monthWeeks(2026, 4);
  const e = ev({ startDate: '2026-05-17', endDate: '2026-05-21' });
  const w = weeks.find((wk) => wk.includes('2026-05-17'))!;
  const { bars } = weekBars(w, [e]);
  assert.equal(bars[0].span, 5);
  assert.equal(weeks[0][0] <= '2026-05-01' && weeks.at(-1)![6] >= '2026-05-31', true);
});
test('buildInput timed, tbd and validation', () => {
  const d = { ...blankDraft(2026), title: 'Fast Pitch', mode: 'timed' as const, startDate: '2026-03-08', endDate: '2026-03-08', startTime: '02:15', endTime: '04:00' };
  assert.equal(buildInput(d, 0).ok, false);
  const ok = buildInput({ ...d, startTime: '18:00', endTime: '20:00', startDate: '2026-06-01', endDate: '2026-06-01' }, 3);
  assert.ok(ok.ok && ok.input.startsAt === '2026-06-02T01:00:00.000Z' && ok.input.expectedVersion === 3 && ok.input.planningYear === 2026);
  const tbd = buildInput({ ...blankDraft(2027), title: 'Gala', audience: 'Partners, Board, Partners' }, 0);
  assert.ok(tbd.ok && tbd.input.startDate === null && tbd.input.allDay && tbd.input.planningYear === 2027 && tbd.input.audience.length === 2);
  assert.equal(buildInput({ ...blankDraft(2026), title: 'x', wixUrl: 'javascript:alert(1)' }, 0).ok, false);
  assert.deepEqual(parseAudience('a, b\nc'), ['a', 'b', 'c']);
});

import { EVENT_PRESETS, presetTitle, targetError, quarterRange, calendarHref, isEligible } from '../src/lib/event-metric';
test('event metric presets, target and quarter rules', () => {
  assert.equal(presetTitle('registrations', 'Fast Pitch'), 'Fast Pitch: Registrations');
  assert.ok(presetTitle('attendance', 'x'.repeat(400)).length <= 300);
  assert.equal(EVENT_PRESETS.revenue.unit, 'USD');
  assert.ok(targetError('', '0')); assert.ok(targetError('0', '0')); assert.ok(targetError('abc', '0'));
  assert.equal(targetError('120', '0'), null);
  const cycle = { id: 'c', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' as const };
  assert.deepEqual(quarterRange(cycle, 'Q2'), { from: '2026-04-01', to: '2026-06-30' });
  assert.equal(quarterRange(cycle, 'annual'), null);
  assert.equal(isEligible(ev({ startDate: '2026-05-17', endDate: '2026-05-21' }), cycle, 'Q2'), true);
  assert.equal(isEligible(ev({ startDate: '2026-08-01', endDate: '2026-08-01' }), cycle, 'Q2'), false);
  assert.equal(isEligible(ev({ planningYear: 2026 }), cycle, 'Q2'), true);
  assert.equal(isEligible(ev({ planningYear: 2027 }), cycle, 'Q2'), false);
  assert.equal(calendarHref(ev({ id: 'a b', planningYear: 2027 })), '/calendar?event=a%20b&year=2027');
});
