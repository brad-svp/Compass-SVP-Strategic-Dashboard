import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CalendarProgram } from '@workspace/api-client-react';
import { buildProgramInput, filterProgramNames, indexPrograms, programChoices, programFor, programInitials, validateLogoFile, LOGO_MAX_BYTES } from '../src/lib/calendar-programs';

const prog = (o: Partial<CalendarProgram>) => ({ id: 'p1', name: 'Fast Pitch', logoId: null, logoUrl: null, active: true, version: 1, canEdit: true, eventCount: 0, updatedAt: '', ...o }) as CalendarProgram;
const list = [prog({}), prog({ id: 'p2', name: 'Think Tank', logoId: 'l2', logoUrl: '/api/svp/program-logos/l2' }), prog({ id: 'p3', name: 'Board', active: false })];

test('lookup prefers programId, falls back to name, else null', () => {
  const idx = indexPrograms(list);
  assert.equal(programFor({ program: 'Old Name', programId: 'p2' }, idx)?.logoUrl, '/api/svp/program-logos/l2');
  assert.equal(programFor({ program: ' fast pitch ', programId: null }, idx)?.id, 'p1');
  assert.equal(programFor({ program: 'Legacy Gala' }, idx), null);
  assert.equal(programFor({ program: '' }, indexPrograms(undefined)), null);
});
test('filter names = programs (incl. retired) + used legacy names, no static list', () => {
  assert.deepEqual(filterProgramNames(list, [{ program: 'Legacy Gala' }, { program: 'board' }, { program: '' }]), ['Board', 'Fast Pitch', 'Legacy Gala', 'Think Tank']);
  assert.deepEqual(filterProgramNames(undefined, []), []);
});
test('form choices: active only, current retired/unmanaged retained and flagged', () => {
  assert.deepEqual(programChoices(list, '').map((c) => c.value), ['Fast Pitch', 'Think Tank']);
  const r = programChoices(list, 'Board');
  assert.equal(r[0].value, 'Board'); assert.equal(r[0].inactive, true); assert.equal(r[0].unmanaged, false);
  assert.equal(programChoices(list, 'Legacy Gala')[0].unmanaged, true);
  assert.equal(programChoices(list, 'Fast Pitch').length, 2);
});
test('logo validation before presign', () => {
  assert.deepEqual(validateLogoFile({ name: 'a.png', size: 10, type: 'image/png' }), { ok: true, contentType: 'image/png' });
  assert.equal(validateLogoFile({ name: 'a.gif', size: 10, type: 'image/gif' }).ok, false);
  assert.equal(validateLogoFile({ name: 'a.svg', size: 10, type: 'image/svg+xml' }).ok, false);
  assert.equal(validateLogoFile({ name: 'a.png', size: LOGO_MAX_BYTES + 1, type: 'image/png' }).ok, false);
  assert.equal(validateLogoFile({ name: 'a.png', size: LOGO_MAX_BYTES, type: 'image/png' }).ok, true);
  assert.equal(validateLogoFile({ name: 'a.png', size: 0, type: 'image/png' }).ok, false);
});
test('program input: trims, version, duplicate names rejected', () => {
  assert.deepEqual(buildProgramInput({ name: '  AI  for Good ', logoId: null, logoUrl: null, active: true }, 0, list, null), { ok: true, input: { name: 'AI for Good', logoId: null, active: true, expectedVersion: 0 } });
  assert.equal(buildProgramInput({ name: 'think tank', logoId: null, logoUrl: null, active: true }, 0, list, null).ok, false);
  assert.equal(buildProgramInput({ name: 'Think Tank', logoId: 'l2', logoUrl: null, active: false }, 4, list, 'p2').ok, true);
  assert.equal(buildProgramInput({ name: ' ', logoId: null, logoUrl: null, active: true }, 0, list, null).ok, false);
});
test('initials', () => { assert.equal(programInitials('Fast Pitch'), 'FP'); assert.equal(programInitials('100x'), '10'); });
