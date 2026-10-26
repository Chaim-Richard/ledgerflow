import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import ReportViewsControls from '../components/reporting/ReportViewsControls';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import {
  copyReportLink,
  parseReportViews,
  reportShareUrl,
  reportViewParams,
  reportViewState,
  reportViewsKey,
} from '../lib/reportViews';
import type { ReportUrlState } from '../lib/reportPermalink';

const state: ReportUrlState = {
  report: 'pnl', year: 2026, timeframe: 'quarter', quarter: 2, month: 0,
  compare: 'previous', startDate: '2026-04-01', endDate: '2026-06-30',
};

afterEach(() => { cleanup(); localStorage.clear(); });

test('saved views validate their version, names and query strings without storing report data', () => {
  const params = reportViewParams(state);
  const raw = JSON.stringify({ version: 1, views: [
    { name: 'דוח Quarterly', params, createdAt: '2026-10-26T00:00:00.000Z' },
    { name: 'דוח Quarterly', params },
    { name: '', params },
    { name: 'Bad', params: 'report=no-such-report!&y=bad' },
    { name: 'No data', params: 'report=pnl&amount=1234' },
  ] });
  const views = parseReportViews(raw);
  assert.equal(views.length, 2);
  assert.equal(views[0].name, 'דוח Quarterly');
  assert.equal(views[1].name, 'No data');
  assert.doesNotMatch(views[1].params, /amount=1234/);
  assert.deepEqual(parseReportViews('{bad'), []);
  assert.deepEqual(parseReportViews(JSON.stringify({ version: 2, views })), []);
  assert.deepEqual(reportViewState(views[0].params, state), state);
  assert.notEqual(reportViewsKey('א', 'ב'), reportViewsKey('ב', 'א'));
});

test('the share URL carries every report filter and keeps unrelated query keys', () => {
  const href = 'https://books.example/reports?mode=compact&stale=1#details';
  const url = new URL(reportShareUrl(state, href));
  assert.equal(url.searchParams.get('report'), 'pnl');
  assert.equal(url.searchParams.get('y'), '2026');
  assert.equal(url.searchParams.get('t'), 'quarter');
  assert.equal(url.searchParams.get('q'), '3');
  assert.equal(url.searchParams.get('cmp'), 'prev');
  assert.equal(url.searchParams.get('start'), '2026-04-01');
  assert.equal(url.searchParams.get('end'), '2026-06-30');
  assert.equal(url.searchParams.get('mode'), 'compact');
  assert.equal(url.searchParams.get('stale'), '1');
  assert.equal(url.hash, '#details');
});

test('a refused clipboard is reported instead of throwing', async () => {
  const copies: string[] = [];
  const ok = await copyReportLink(state, 'https://books.example/#/reports', text => { copies.push(text); });
  const refused = await copyReportLink(state, 'https://books.example/#/reports', () => { throw new Error('blocked'); });
  assert.equal(ok.ok, true);
  assert.equal(copies.length, 1);
  assert.equal(refused.ok, false);
  assert.equal(refused.url, ok.url);
});

test('save, restore, duplicate refusal and workspace isolation on the screen', () => {
  const workspace = setComponentWorkspace();
  localStorage.clear();
  let used: ReportUrlState | null = null;
  const view = render(<ReportViewsControls state={state} onUse={next => { used = next; }} />);
  fireEvent.click(view.getByText('Saved report views', { exact: true }));
  fireEvent.change(view.getByLabelText('View name'), { target: { value: 'Q3 compare' } });
  fireEvent.click(view.getByRole('button', { name: 'Save this report view' }));
  assert.ok(view.getByRole('button', { name: 'Use report view Q3 compare' }));
  fireEvent.change(view.getByLabelText('View name'), { target: { value: 'Q3 compare' } });
  fireEvent.click(view.getByRole('button', { name: 'Save this report view' }));
  assert.match(view.getByRole('alert').textContent || '', /already exists/);

  const stored = JSON.parse(localStorage.getItem(reportViewsKey(useAuthStore.getState().user!.uid, workspace.id)) || 'null');
  assert.equal(stored.version, 1);
  assert.equal(stored.views.length, 1);
  assert.equal(stored.views[0].name, 'Q3 compare');

  fireEvent.click(view.getByRole('button', { name: 'Use report view Q3 compare' }));
  assert.deepEqual(used, state, 'the restored view carries the report, period and comparison');

  act(() => { useAuthStore.setState({ currentWorkspaceId: 'other-workspace' }); });
  assert.equal(view.queryByRole('button', { name: 'Use report view Q3 compare' }), null,
    'another workspace cannot read this workspace’s saved views');
});
