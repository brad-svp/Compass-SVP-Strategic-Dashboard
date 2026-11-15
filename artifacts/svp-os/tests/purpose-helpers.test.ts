import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SvpPurpose } from '@workspace/api-client-react';
import { draftFromPurpose, hasErrors, isDirty, moveValue, newValue, safeHttpUrl, toPurposeInput, validatePurpose } from '../src/lib/purpose';

const p: SvpPurpose = { mission: 'M', vision: '', values: [{ id: 'a', title: 'A', description: 'x' }, { id: 'b', title: 'B', description: '' }], version: 4, canEdit: true, sourceUrls: [], updatedAt: '' };

test('blank statements are allowed, blank value titles are not', () => {
  assert.equal(hasErrors(validatePurpose({ mission: '', vision: '', values: [] })), false);
  const e = validatePurpose({ mission: '', vision: '', values: [newValue(() => 'n1')] });
  assert.ok(e.byId.n1?.title);
});
test('duplicate ids and limits are caught', () => {
  assert.ok(validatePurpose({ mission: '', vision: '', values: [{ id: 'a', title: 'A', description: '' }, { id: 'a', title: 'B', description: '' }] }).values);
  assert.ok(validatePurpose({ mission: 'x'.repeat(6001), vision: '', values: [] }).mission);
  assert.ok(validatePurpose({ mission: '', vision: '', values: Array.from({ length: 31 }, (_, i) => ({ id: `v${i}`, title: 't', description: '' })) }).values);
});
test('reorder swaps and ignores edges', () => {
  assert.deepEqual(moveValue(p.values, 0, 1).map((v) => v.id), ['b', 'a']);
  assert.equal(moveValue(p.values, 0, -1), p.values);
});
test('full replace input carries version and order; dirty tracking', () => {
  const d = draftFromPurpose(p);
  assert.equal(isDirty(d, p), false);
  d.values = moveValue(d.values, 1, -1);
  assert.equal(isDirty(d, p), true);
  assert.deepEqual(toPurposeInput(d, p.version), { mission: 'M', vision: '', values: [{ id: 'b', title: 'B', description: '' }, { id: 'a', title: 'A', description: 'x' }], expectedVersion: 4 });
});
test('only http(s) source links render', () => {
  assert.ok(safeHttpUrl('https://svpsacramento.org/about'));
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
});
