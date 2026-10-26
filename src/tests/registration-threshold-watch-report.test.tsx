import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import RegistrationThresholdWatchReportView from '../components/reporting/RegistrationThresholdWatchReportView';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Workspace } from '../types';

const previousAuth = useAuthStore.getState();
const previousData = useDataNeedsStore.getState();
const previousLedger = useLedgerStore.getState();
const workspace: Workspace = {
  id: 'threshold-workspace', uid: 'test-user', name: 'Threshold books', businessType: 'custom', createdAt: '2026-01-01', currency: 'ILS',
  dimensions: [
    { id: 'world', name: 'World / Entity', isWorld: true },
    { id: 'activity', name: 'Activity' },
  ],
  taxProfiles: { labels: { 'world:E1': { name: 'Israel entity', place: { country: 'IL' } } } },
};
const sales = makeChartAccount({ id: 'sales', workspaceId: workspace.id, name: 'Sales', type: 'revenue', category: 'Income' });

beforeEach(() => {
  useAuthStore.setState({ user: null, isGuest: true, currentWorkspaceId: workspace.id, workspaces: [workspace] });
  useDataNeedsStore.setState({ loaded: { accounts: true, transactions: true }, failed: {} });
  useLedgerStore.setState({
    accounts: [sales],
    transactions: [makeTransaction({
      id: 'sale', workspaceId: workspace.id, date: '2026-12-31', totalAmountCents: 12_283_300,
      lines: [{ accountId: sales.id, amountCents: -12_283_300, dimensions: { world: 'E1', activity: 'OSEK' } }],
    })],
    dimensionNodes: [
      { id: 'E1', dimensionId: 'world', description: 'Israeli entity' },
      { id: 'OSEK', dimensionId: 'activity', description: 'Israel osek patur qualifying turnover' },
    ],
    truncatedCollections: {},
  });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState(previousAuth, true);
  useDataNeedsStore.setState(previousData, true);
  useLedgerStore.setState(previousLedger, true);
});

test('A-39 report renders a read-only posted-sales comparison, native currency, source and date controls', () => {
  render(<RegistrationThresholdWatchReportView endDate="2026-12-31" />);
  assert.ok(screen.getByRole('heading', { name: 'Registration threshold watch' }));
  assert.ok(screen.getByRole('table', { name: /Posted-sales threshold comparisons as of 2026-12-31/ }));
  assert.ok(screen.getByText('Israel entity'));
  assert.ok(screen.getByText('At threshold — review scope and dates'));
  assert.ok(screen.getByText('Effective 2026-01-01 onward'));
  assert.ok(screen.getByRole('link', { name: 'Rule source' }));
  assert.equal((screen.getByLabelText('Threshold watch as of date') as HTMLInputElement).value, '2026-12-31');
  assert.ok(screen.getByRole('combobox', { name: 'Threshold watch entity dimension' }));
  assert.ok(screen.getByRole('combobox', { name: 'Threshold watch activity dimension' }));

  fireEvent.change(screen.getByLabelText('Threshold watch as of date'), { target: { value: '2026-12-30' } });
  assert.equal((screen.getByLabelText('Threshold watch as of date') as HTMLInputElement).value, '2026-12-30');
  assert.ok(screen.getByText(/No threshold comparison can be made/));
});

test('report exposes missing country and incomplete loaded history instead of implying a complete zero', () => {
  useAuthStore.setState({ workspaces: [{ ...workspace, taxProfiles: { labels: {} } }] });
  useLedgerStore.setState({ truncatedCollections: { transactions: true } });
  render(<RegistrationThresholdWatchReportView endDate="2026-12-31" />);
  assert.ok(screen.getByText(/history is incomplete/i));
  assert.ok(screen.getByText(/No country fact is set in the Tax profile/));
  assert.ok(screen.getByText(/No threshold comparison can be made/));
});

test('A-100: the osek patur ceiling history is on the screen, year by year, with the page it was read from', () => {
  render(<RegistrationThresholdWatchReportView endDate="2026-12-31" />);
  const block = screen.getByText('Israel: the osek patur ceiling, year by year (A-100)').closest('details')!;
  const cells = Array.from(block.querySelectorAll('tbody > tr')).map(row => Array.from(row.children).map(cell => cell.textContent || ''));
  assert.equal(cells.length, 10, 'one row per year the table answers for');
  const row2021 = cells.find(row => row[0] === '2021')!;
  assert.equal(row2021[1], '₪998.93'.replace('998.93', '99,893.00'), 'the 2021 figure is the year that came down with the index');
  assert.equal(row2021[2], '2021-01-01', 'and it starts on 1 January of that year');
  assert.equal(row2021[3], '2021-12-31', 'and ends on 31 December');
  assert.match(row2021[4], /consumer price index/, 'the screen says how the year’s figure came about');
  const row2026 = cells.find(row => row[0] === '2026')!;
  assert.equal(row2026[1], '₪122,833.00');
  assert.equal(row2026[3], 'open — the Authority sets each year', 'the newest year is not closed off');
  const links = Array.from(block.querySelectorAll('a')).map(link => link.getAttribute('href'));
  const parsedLinks = links.filter((href): href is string => Boolean(href)).map(href => new URL(href));
  assert.ok(parsedLinks.every(url => url.protocol === 'https:'), 'every year cites an https page');
  assert.ok(
    parsedLinks.some(
      url => url.host === 'www.gov.il' && url.pathname === '/he/service/request-open-exempt-dealer-via-internet'
    ),
    'the Tax Authority’s own page is one of them'
  );
  assert.match(block.textContent || '', /unknown,\\s*,?|never zero/, 'and the screen states that a year without a row is unknown');
});
