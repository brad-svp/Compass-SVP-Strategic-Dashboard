import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route } from 'wouter';
import { getGetFoundationQueryKey, getGetOkrWorkspaceQueryKey, type Foundation, type OkrWorkspace, type Staff } from '@workspace/api-client-react';
import { SessionContext } from '../src/lib/session-context';
import Dashboard from '../src/pages/dashboard';
import Okrs from '../src/pages/okrs';
import OkrDetail from '../src/pages/okr-detail';

const staff: Staff[] = [
  { id: 'admin', name: 'Test Admin', role: 'admin', areaId: 'area', active: true, roleDescription: '' },
  { id: 'owner', name: 'Test Owner', role: 'staff', areaId: 'area', active: true, roleDescription: '' },
];
const foundation: Foundation = {
  staff, areas: [{ id: 'area', name: 'Programs', color: '#49B949', sortOrder: 0 }],
  cycles: [{ id: 'cycle', name: 'Test 2025', startDate: '2025-01-01', endDate: '2025-12-31', status: 'active' }],
  periods: [], activity: [],
};
const empty: OkrWorkspace = { objectives: [], keyResults: [], checkIns: [], comments: [] };
const workspace: OkrWorkspace = {
  objectives: [
    { id: 'company', cycleId: 'cycle', level: 'company', ownerId: 'admin', areaId: 'area', title: 'Shared company goal', description: 'For Sacramento', timeScope: 'annual', status: 'active', sortOrder: 0, aiDrafted: false, progress: 0, expectedProgress: 40, health: 'none', canEdit: false, parentObjectiveId: null },
    { id: 'individual', cycleId: 'cycle', level: 'individual', ownerId: 'owner', areaId: 'area', title: 'A personal contribution', description: 'Support the company', timeScope: 'Q2', status: 'active', sortOrder: 0, aiDrafted: false, progress: 50, expectedProgress: 40, health: 'green', canEdit: true, parentObjectiveId: 'company' },
  ],
  keyResults: [{ id: 'kr', objectiveId: 'individual', ownerId: 'owner', title: 'Measurable contribution', measurementType: 'metric', unit: 'people', startValue: 0, targetValue: 10, currentValue: 5, confidence: null, progress: 50, health: 'green', canEdit: true, sortOrder: 0, lastCheckInAt: '2025-04-15T12:00:00Z' }],
  checkIns: [{ id: 'check', keyResultId: 'kr', authorId: 'owner', measurementType: 'metric', value: 5, confidence: null, note: 'Five people joined', progress: 50, createdAt: '2025-04-15T12:00:00Z' }],
  comments: [{ id: 'comment', entityType: 'objective', entityId: 'individual', authorId: 'admin', body: 'Shared context', canEdit: false, createdAt: '2025-04-15T12:00:00Z', editedAt: null }],
};
function render(path: string, ws: OkrWorkspace, me = staff[1]) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(getGetFoundationQueryKey(), foundation);
  qc.setQueryData(getGetOkrWorkspaceQueryKey(), ws);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={qc}><SessionContext.Provider value={me}>
      <Router ssrPath={path}>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/okrs" component={Okrs} />
        <Route path="/okrs/:id" component={OkrDetail} />
      </Router>
    </SessionContext.Provider></QueryClientProvider>,
  );
  qc.clear();
  return html;
}
test('empty dashboard renders honest empty state and cycle-aware My OKRs link', () => {
  const html = render('/dashboard', empty);
  assert.match(html, /Start by adding your company objectives/);
  assert.match(html, /owner=owner&amp;cycle=cycle/);
  assert.match(html, /No check-ins yet/);
});
test('dashboard renders staff progress and last check-in from real query data', () => {
  const html = render('/dashboard', workspace);
  assert.match(html, /Shared company goal/);
  assert.match(html, /50%/);
  assert.match(html, /Last check-in Apr 15/);
  assert.match(html, /Five people joined/);
});
test('staff cannot see company creation controls; admins can', () => {
  assert.doesNotMatch(render('/okrs', empty), /data-testid="button-empty-new-company"/);
  assert.match(render('/okrs', empty, staff[0]), /data-testid="button-empty-new-company"/);
});
test('objective details render owner controls, progress, comment count and cycle-aware navigation', () => {
  const html = render('/okrs/individual', workspace);
  assert.match(html, /A personal contribution/);
  assert.match(html, /button-edit-objective/);
  assert.match(html, /button-checkin-kr/);
  assert.match(html, /Shared context/);
  assert.match(html, /owner=owner&amp;cycle=cycle/);
});
test('read-only objective and key result omit write controls but preserve discussion', () => {
  const readonly = { ...workspace,
    objectives: workspace.objectives.map(o => ({ ...o, canEdit: false })),
    keyResults: workspace.keyResults.map(k => ({ ...k, canEdit: false })),
  };
  const html = render('/okrs/individual', readonly);
  assert.doesNotMatch(html, /button-edit-objective/);
  assert.doesNotMatch(html, /button-checkin-kr/);
  assert.doesNotMatch(html, /button-delete-objective/);
  assert.match(html, /Shared context/);
  assert.match(html, /input-comment-individual/);
});
