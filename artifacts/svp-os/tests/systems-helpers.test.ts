import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SvpSystem } from '@workspace/api-client-react';
import { blankSystem, categoriesOf, filterSystems, toInput, urlError, validateSystem } from '../src/lib/systems';

const sys = (p: Partial<SvpSystem>): SvpSystem => ({ ...blankSystem(), id: 'x', version: 1, canEdit: false, createdAt: '', updatedAt: '', expectedVersion: 1, name: 'A', url: 'https://a.org', ...p });

test('url validation', () => {
  assert.equal(urlError('https://app.example.org/x'), null);
  assert.ok(urlError(''));
  assert.ok(urlError('ftp://x.org'));
  assert.ok(urlError('example.org'));
  assert.ok(urlError('https://user:pw@x.org'));
});
test('blank defaults are active with no rows invented', () => {
  const b = blankSystem();
  assert.equal(b.status, 'active'); assert.deepEqual(b.usedByIds, []); assert.equal(b.ownerId, null);
  assert.ok(validateSystem(b).name);
});
test('secret-looking access notes are flagged', () => {
  assert.ok(validateSystem({ ...blankSystem(), name: 'n', url: 'https://x.org', accessInstructions: 'password: hunter2' }).accessInstructions);
  assert.equal(validateSystem({ ...blankSystem(), name: 'n', url: 'https://x.org', accessInstructions: 'Ask Dana for an invite' }).accessInstructions, undefined);
});
test('toInput trims and carries version', () => {
  const i = toInput({ ...blankSystem(), name: ' Salesforce ', url: ' https://x.org ' }, 3);
  assert.equal(i.name, 'Salesforce'); assert.equal(i.url, 'https://x.org'); assert.equal(i.expectedVersion, 3);
});
test('filter hides retired by default, searches people, sorts by name', () => {
  const list = [sys({ id: '1', name: 'zoom' }), sys({ id: '2', name: 'Asana', status: 'retired' }), sys({ id: '3', name: 'Box', usedByIds: ['s1'], category: 'Files' })];
  assert.deepEqual(filterSystems(list, { text: '', category: '', showRetired: false }).map((s) => s.id), ['3', '1']);
  assert.deepEqual(filterSystems(list, { text: '', category: '', showRetired: true }).map((s) => s.id), ['2', '3', '1']);
  assert.deepEqual(filterSystems(list, { text: 'dana', category: '', showRetired: true }, (id) => (id === 's1' ? 'Dana' : '')).map((s) => s.id), ['3']);
  assert.deepEqual(categoriesOf(list), ['Files']);
});
