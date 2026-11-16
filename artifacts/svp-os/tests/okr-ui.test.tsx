import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route } from 'wouter';
import { getGetFoundationQueryKey, getGetOkrWorkspaceQueryKey, type Foundation, type OkrWorkspace, type Staff } from '@workspace/api-client-react';
import { SessionContext } from '../src/lib/session-context';
import { currentQuarter } from '../src/lib/qbo';
import Dashboard from '../src/pages/dashboard';
import Qbos from '../src/pages/qbos';
import QboDetail from '../src/pages/qbo-detail';

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
test('quarter selection uses calendar quarters even for partial-year cycles', () => {
  const cycle = { id: 'partial', name: 'Partial year', startDate: '2026-04-01', endDate: '2026-06-30', status: 'planning' as const };
  assert.equal(currentQuarter(cycle, new Date('2026-05-15T00:00:00Z')), 'Q2');
  assert.equal(currentQuarter(cycle, new Date('2026-01-01T00:00:00Z')), 'Q2');
  assert.equal(currentQuarter(cycle, new Date('2026-11-15T00:00:00Z')), 'Q2');
});
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
        <Route path="/qbos" component={Qbos} />
        <Route path="/qbos/:id" component={QboDetail} />
      </Router>
    </SessionContext.Provider></QueryClientProvider>,
  );
  qc.clear();
  return html;
}
const qbo = { ...workspace.objectives[0], id: 'qbo', title: 'Quarterly shared goal', timeScope: 'Q2' as const };
const qboWs: OkrWorkspace = { ...workspace, objectives: [...workspace.objectives, qbo],
  keyResults: [...workspace.keyResults, { ...workspace.keyResults[0], id: 'qkr', objectiveId: 'qbo', title: 'Quarter metric' }] };

test('empty dashboard renders honest QBO empty state and no My OKRs framing', () => {
  const html = render('/dashboard', empty);
  assert.match(html, /No QBOs for Q\d yet/);
  assert.match(html, /href="\/qbos\?cycle=cycle&amp;q=Q\d"/);
  assert.doesNotMatch(html, /My OKRs/);
  assert.doesNotMatch(html, /data-testid="filter-cycle"|data-testid="filter-quarter"/);
  assert.doesNotMatch(html, /aria-label="Cycle"|aria-label="Quarter"/);
});
test('dashboard shows quarter QBOs, not legacy annual objectives', () => {
  const html = render('/dashboard', qboWs);
  assert.doesNotMatch(html, /Shared company goal/);
  assert.doesNotMatch(html, /Who carries|Recent check-ins|legacy objective/);
});
test('staff cannot see QBO creation controls; admins can', () => {
  assert.doesNotMatch(render('/qbos?q=Q2', empty), /data-testid="button-empty-new-qbo"/);
  assert.match(render('/qbos?q=Q2', empty, staff[0]), /data-testid="button-empty-new-qbo"/);
  assert.doesNotMatch(render('/qbos?q=Q2', workspace, staff[0]), /button-new-individual|Individual objective<\/button/);
});
test('QBO list renders quarter objectives; legacy view keeps annual and individual objectives', () => {
  assert.match(render('/qbos?cycle=cycle&q=Q2', qboWs), /Quarterly shared goal/);
  const legacy = render('/qbos?cycle=cycle&view=legacy', qboWs);
  assert.match(legacy, /Shared company goal/);
  assert.match(legacy, /A personal contribution/);
  assert.doesNotMatch(legacy, /Quarterly shared goal/);
});
test('legacy objective details render owner controls, progress, comments and legacy navigation', () => {
  const html = render('/qbos/individual', workspace);
  assert.match(html, /A personal contribution/);
  assert.match(html, /Legacy individual objective/);
  assert.match(html, /button-edit-objective/);
  assert.match(html, /button-checkin-kr/);
  assert.match(html, /Shared context/);
  assert.match(html, /view=legacy&amp;owner=owner/);
});
test('read-only objective and key result omit write controls but preserve discussion', () => {
  const readonly = { ...workspace,
    objectives: workspace.objectives.map(o => ({ ...o, canEdit: false })),
    keyResults: workspace.keyResults.map(k => ({ ...k, canEdit: false })),
  };
  const html = render('/qbos/individual', readonly);
  assert.doesNotMatch(html, /button-edit-objective/);
  assert.doesNotMatch(html, /button-checkin-kr/);
  assert.doesNotMatch(html, /button-delete-objective/);
  assert.match(html, /Shared context/);
  assert.match(html, /input-comment-individual/);
});
