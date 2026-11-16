import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import {
  getGetBrainQueryKey,
  getGetFoundationQueryKey,
  getGetMasterCalendarQueryKey,
  getGetQuarterNarrativeQueryKey,
  type Area,
  type BrainEntry,
  type BrainWorkspace,
  type Foundation,
  type MasterCalendar,
  type QuarterNarrative,
  type SixItem,
  type SixMoment,
  type SixPeriod,
  type Staff,
} from '@workspace/api-client-react';
import { QuarterNarrativePanel } from '../src/components/okr/quarter-narrative';
import { PersonPlan } from '../src/components/six-by-six/person-plan';
import { EmptyState, ReviewBadge } from '../src/components/brain/brain-bits';
import BrainPage from '../src/pages/brain';
import { SessionContext } from '../src/lib/session-context';

const admin: Staff = { id: 'admin', name: 'Test Admin', role: 'admin', areaId: 'area', active: true, roleDescription: '' };
const owner: Staff = { id: 'owner', name: 'Test Owner', role: 'staff', areaId: 'area', active: true, roleDescription: '' };
const teammate: Staff = { id: 'teammate', name: 'Other Staff', role: 'staff', areaId: 'area', active: true, roleDescription: '' };
const areas: Area[] = [{ id: 'area', name: 'Programs', color: '#49B949', sortOrder: 0 }];

function renderNarrative(quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', data?: QuarterNarrative, error = false) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } } });
  const key = getGetQuarterNarrativeQueryKey('cycle-a', quarter);
  if (data) client.setQueryData(key, data);
  if (error) client.getQueryCache().build(client, { queryKey: key })
    .setState({ status: 'error', error: new Error('Narrative unavailable'), fetchStatus: 'idle' });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <QuarterNarrativePanel cycleId="cycle-a" quarter={quarter} cycleName="Annual Cycle" />
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}

const q1Narrative: QuarterNarrative = {
  cycleId: 'cycle-a', quarter: 'Q1', narrative: 'Q1 private direction', version: 1, canEdit: true, updatedAt: null,
};
const q2Narrative: QuarterNarrative = {
  cycleId: 'cycle-a', quarter: 'Q2', narrative: 'Q2 focus\n<script>alert("x")</script>', version: 2, canEdit: false, updatedAt: null,
};

test('quarter narrative shows role-appropriate empty presentation and escaped multiline content scoped to its cycle quarter', () => {
  const staffEmpty = renderNarrative('Q1', { ...q1Narrative, narrative: '', canEdit: false });
  assert.equal(staffEmpty, '');

  const adminEmpty = renderNarrative('Q1', { ...q1Narrative, narrative: '', canEdit: true });
  assert.match(adminEmpty, /data-testid="button-add-quarter-narrative"/);

  const populated = renderNarrative('Q2', q2Narrative);
  assert.match(populated, /Annual Cycle · Q2 direction/);
  assert.match(populated, /data-testid="panel-quarter-narrative"/);
  assert.match(populated, /whitespace-pre-wrap/);
  assert.match(populated, /Q2 focus\n&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(populated, /<script>/);
  assert.doesNotMatch(populated, /Q1 private direction/);
});

test('quarter narrative provides loading and actionable error presentations', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } });
  const loading = renderToStaticMarkup(
    <QueryClientProvider client={client}><QuarterNarrativePanel cycleId="cycle-a" quarter="Q3" /></QueryClientProvider>,
  );
  assert.match(loading, /skeleton-quarter-narrative/);
  client.clear();

  const failed = renderNarrative('Q4', undefined, true);
  assert.match(failed, /role="alert"/);
  assert.match(failed, /error-quarter-narrative/);
  assert.match(failed, /button-retry-quarter-narrative/);
  assert.match(failed, /Could not load the Q4 direction/);
});

const moments: SixMoment[] = Array.from({ length: 6 }, (_, index) => ({
  id: `moment-${index + 1}`, periodId: 'period', position: index + 1,
  title: `Shared company moment ${index + 1}`, eventDate: `2026-0${index + 1}-15`, version: 1,
})).reverse();
const period: SixPeriod = {
  id: 'period', name: 'Company planning period', startDate: '2026-01-01', endDate: '2026-06-30',
  meetingDate: '2026-01-05', meetingNotes: '', status: 'active', version: 1, moments,
};
const ownItems: SixItem[] = [
  { id: 'own-1', periodId: 'period', momentId: 'moment-1', ownerId: owner.id, title: 'Improve intake flow', description: 'Details', status: 'in_progress', version: 1, canEdit: true, updatedAt: new Date('2026-01-01') },
  { id: 'own-2', periodId: 'period', momentId: 'moment-1', ownerId: owner.id, title: 'Train volunteers', description: '', status: 'planned', version: 1, canEdit: true, updatedAt: new Date('2026-01-01') },
  { id: 'other-1', periodId: 'period', momentId: 'moment-2', ownerId: teammate.id, title: 'Other staff confidential plan', description: '', status: 'planned', version: 1, canEdit: false, updatedAt: new Date('2026-01-01') },
];

function renderPlan(actor: Staff, person = owner) {
  return renderToStaticMarkup(
    <PersonPlan period={period} items={ownItems} person={person} areas={areas} actor={actor}
      onOpenItem={() => undefined} onAddItem={() => undefined} />,
  );
}

test('PersonPlan renders six numbered independent slots without exposing shared moment titles or dates', () => {
  const html = renderPlan(owner);
  for (let number = 1; number <= 6; number += 1) {
    assert.match(html, new RegExp(`data-testid="slot-priority-${number}"`));
    assert.match(html, new RegExp(`Priority ${number}`));
  }
  assert.equal((html.match(/data-testid="slot-priority-/g) ?? []).length, 6);
  assert.match(html, /Improve intake flow/);
  assert.match(html, /Train volunteers/);
  assert.match(html, /2 items/);
  assert.doesNotMatch(html, /Shared company moment|2026-0[1-6]-15|Company planning period/);
  assert.doesNotMatch(html, /Other staff confidential plan/);
});

test('PersonPlan add controls follow self/admin/read-only permissions and existing entries remain visible', () => {
  const self = renderPlan(owner);
  assert.equal((self.match(/data-testid="button-add-priority-/g) ?? []).length, 6);
  assert.match(self, /button-add-priority-1/);
  assert.match(self, /Add another/);
  assert.match(self, /Train volunteers/);

  const staffViewingAnother = renderPlan(teammate);
  assert.doesNotMatch(staffViewingAnother, /data-testid="button-add-priority-/);
  assert.match(staffViewingAnother, /view only/);
  assert.match(staffViewingAnother, /Improve intake flow/);
  assert.match(staffViewingAnother, /Train volunteers/);

  const adminViewingAnother = renderPlan(admin);
  assert.equal((adminViewingAnother.match(/data-testid="button-add-priority-/g) ?? []).length, 6);
  assert.match(adminViewingAnother, /Train volunteers/);
});

const foundation: Foundation = { staff: [admin, owner, teammate], areas, cycles: [], periods: [], activity: [] };
const calendar: MasterCalendar = { events: [], timeZone: 'America/Los_Angeles', hasSubscription: false, isPublished: false, programs: [] };

function brainEntry(overrides: Partial<BrainEntry> = {}): BrainEntry {
  return {
    id: 'entry', authorId: owner.id, reviewStatus: 'unreviewed', retired: false, conflict: '',
    mergedIntoId: null, version: 1, via: 'web', reviewedAt: null, reviewerId: null, reviewDueAt: null,
    overdue: true, indexStatus: 'ready', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
    canEdit: false, title: '<img src=x onerror=alert(1)>', summary: 'A reviewable entry', content: 'Secret details',
    kind: 'procedure', programId: null, areaId: 'area', ownerId: owner.id, tags: ['safety'],
    sourceUrls: [], links: [], visibility: 'staff', reviewIntervalDays: 180, expectedVersion: 1,
    ...overrides,
  };
}

function renderBrain(me: Staff, entries: BrainEntry[]) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } } });
  client.setQueryData(getGetFoundationQueryKey(), foundation);
  client.setQueryData(getGetMasterCalendarQueryKey(), calendar);
  const workspace: BrainWorkspace = {
    entries, hits: [], total: entries.length, semanticReady: false, semanticMessage: '', defaultReviewDays: 180,
  };
  client.setQueryData(getGetBrainQueryKey({ status: 'all' }), workspace);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionContext.Provider value={me}><Router ssrPath="/brain"><BrainPage /></Router></SessionContext.Provider>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}

test('Brain review statuses, due state, and entry text render as safe UI', () => {
  const reviewed = brainEntry({ id: 'reviewed', reviewStatus: 'reviewed', overdue: false, reviewedAt: '2026-01-03T00:00:00Z' });
  const html = renderBrain(owner, [brainEntry(), reviewed]);
  assert.match(html, /data-testid="status-brain-entry-entry"[^>]*>.*Unreviewed.*due/s);
  assert.match(html, /data-testid="status-brain-entry-reviewed"[^>]*>.*Reviewed/s);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);

  const badges = renderToStaticMarkup(
    <><ReviewBadge status="unreviewed" overdue testId="review-unreviewed" /><ReviewBadge status="reviewed" testId="review-reviewed" /></>,
  );
  assert.match(badges, /review-unreviewed/);
  assert.match(badges, /review-reviewed/);
  assert.match(badges, /due/);
});

test('Brain empty state and admin-only review controls are role-appropriate', () => {
  const emptyStaff = renderBrain(owner, []);
  assert.match(emptyStaff, /data-testid="empty-brain"/);
  assert.match(emptyStaff, /The Brain is empty/);
  assert.match(emptyStaff, /Contribute the first entry/);
  assert.doesNotMatch(emptyStaff, /button-brain-toggle-admin/);

  const emptyAdmin = renderBrain(admin, []);
  assert.match(emptyAdmin, /data-testid="empty-brain"/);
  assert.match(emptyAdmin, /button-brain-toggle-admin/);

  const empty = renderToStaticMarkup(
    <EmptyState testId="brain-empty-unit" title="Nothing available." body="Check again later." />,
  );
  assert.match(empty, /data-testid="brain-empty-unit"/);
  assert.match(empty, /Nothing available\./);
  assert.match(empty, /Check again later\./);
});
