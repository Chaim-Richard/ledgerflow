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
