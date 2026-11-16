import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { getGetSvpPurposeQueryKey, type SvpPurpose } from '@workspace/api-client-react';
import Landing from '../src/pages/landing';
import { MissionPanel } from '../src/components/home/mission-panel';
import { COMMUNITY_PHOTOS } from '../src/components/home/community';

const purpose: SvpPurpose = {
  mission: 'Our administrator-configured mission.',
  vision: 'Our administrator-configured vision.',
  values: [{ id: 'collective-effort', title: 'Collective Effort', description: 'Work together.' }],
  version: 3,
  canEdit: false,
  sourceUrls: [],
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderPanel(data?: SvpPurpose, error = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } });
  if (data) client.setQueryData(getGetSvpPurposeQueryKey(), data);
  if (error) {
    client.getQueryCache().build(client, { queryKey: getGetSvpPurposeQueryKey() })
      .setState({ status: 'error', error: new Error('Unavailable'), fetchStatus: 'idle' });
  }
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}><Router ssrPath="/dashboard"><MissionPanel /></Router></QueryClientProvider>,
  );
  client.clear();
  return html;
}

test('staff welcome has a working sign-in destination without misleading protected links', () => {
  const html = renderToStaticMarkup(<Router ssrPath="/"><Landing /></Router>);
  assert.match(html, /SVP Compass/);
  assert.match(html, /href="\/sign-in"/);
  assert.match(html, /data-testid="text-mission"/);
  assert.match(html, /data-testid="text-vision"/);
  assert.doesNotMatch(html, /href="\/(?:qbos|six-by-six|scorecard|team|purpose)"/);
  assert.doesNotMatch(html, /Become a partner|Get tickets|Donate now/i);
});

test('staff welcome uses three real photos and a safe external library link', () => {
  const html = renderToStaticMarkup(<Router ssrPath="/"><Landing /></Router>);
  for (const photo of COMMUNITY_PHOTOS) {
    assert.ok(photo.alt.length > 25);
    assert.ok(html.includes(photo.src));
    assert.ok(html.includes(photo.program));
  }
  assert.match(html, /href="https:\/\/photos\.svpsacramento\.org\/" target="_blank" rel="noopener noreferrer"/);
});

test('dashboard displays the configured statements, values and purpose link', () => {
  const html = renderPanel(purpose);
  assert.match(html, /Our administrator-configured mission/);
  assert.match(html, /Our administrator-configured vision/);
  assert.match(html, /Collective Effort/);
  assert.match(html, /href="\/purpose"/);
  assert.doesNotMatch(html, /status-mission-empty|status-mission-error/);
});

test('dashboard has explicit loading, error and empty states without showing static fallback statements', () => {
  assert.match(renderPanel(), /status-mission-loading/);
  const failed = renderPanel(undefined, true);
  assert.match(failed, /status-mission-error/);
  assert.match(failed, /button-mission-retry/);
  assert.doesNotMatch(failed, /We unite the collective power/);
  const empty = renderPanel({ ...purpose, mission: '', vision: '', values: [] });
  assert.match(empty, /status-mission-empty/);
  assert.match(empty, /An admin can add them/);
});

test('configured mission text is escaped rather than executed as markup', () => {
  const html = renderPanel({ ...purpose, mission: '<script>alert("x")</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
