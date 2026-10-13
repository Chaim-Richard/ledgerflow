/**
 * A-68 on the screen: the plans list shows MRR and ARR per currency, marks a weekly plan's monthly
 * value approximate, and never adds two currencies together. Read-only: the screen only reads.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { SubscriptionPlansPanel } from '../components/reporting/SubscriptionPlansReportView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';

const previousAuth = useAuthStore.getState();
const previousLedger = useLedgerStore.getState();

beforeEach(() => {
  useLedgerStore.setState({ recurring: [], customers: [], truncatedCollections: {} } as never);
});

afterEach(() => {
  cleanup();
  useAuthStore.setState(previousAuth, true);
  useLedgerStore.setState(previousLedger, true);
});

test('the plans list totals each currency on its own and says which month a stopped plan left', () => {
  const workspace = { id: 'ws-1', uid: 'u-1', name: 'Plan books', businessType: 'custom', createdAt: '2026-01-01', currency: 'USD' };
  useAuthStore.setState({ user: null, isGuest: true, currentWorkspaceId: 'ws-1', workspaces: [workspace] } as never);
  useLedgerStore.setState({
    customers: [{ id: 'c1', name: 'Alpha Ltd', workspaceId: 'ws-1' }],
    recurring: [
      { id: 'p1', workspaceId: 'ws-1', description: 'Care plan', amountCents: 12000, frequency: 'monthly', nextOccurrence: '2026-11-01', isActive: true, status: 'active', createdAt: '2026-01-15T10:00:00.000Z', generatedCount: 9, invoiceTemplate: { customerId: 'c1' } },
      { id: 'p2', workspaceId: 'ws-1', description: 'Support', amountCents: 6000, frequency: 'yearly', nextOccurrence: '2026-12-01', isActive: true, status: 'active', createdAt: '2026-02-01T10:00:00.000Z', generatedCount: 1, invoiceTemplate: { customerId: 'c1', currency: 'ILS' } },
      { id: 'p3', workspaceId: 'ws-1', description: 'Stopped plan', amountCents: 9000, frequency: 'monthly', nextOccurrence: '2026-03-01', isActive: false, status: 'completed', lastOccurrence: '2026-02-01', createdAt: '2026-01-01T10:00:00.000Z', generatedCount: 2, invoiceTemplate: { customerId: 'c1' } },
      { id: 'journal', workspaceId: 'ws-1', description: 'Not a subscription', amountCents: 5000, frequency: 'monthly', nextOccurrence: '2026-11-01', isActive: true, status: 'active', createdAt: '2026-01-01T10:00:00.000Z', generatedCount: 1 },
    ],
    truncatedCollections: {},
  } as never);

  render(<SubscriptionPlansPanel from="2026-01" to="2026-10" />);
  assert.ok(screen.getByRole('heading', { name: 'Subscription plans' }));
  const text = screen.getByRole('region', { name: 'Subscription plans' }).textContent || '';
  assert.match(text, /USD/);
  assert.match(text, /\$120\.00/);
  assert.match(text, /ILS/);
  assert.match(text, /₪5\.00/, 'the yearly ILS plan is a twelfth of 60.00 a month');
  assert.match(text, /Stopped plan/);
  assert.match(text, /Stopped/);
  assert.ok(!text.includes('Not a subscription'), 'an ordinary recurring journal is not a plan');
  const monthlyTable = screen.getAllByRole('table')[0];
  assert.match(monthlyTable.textContent || '', /Support/);
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));
  assert.ok(screen.getByRole('img', { name: /Monthly value running each month in ILS/ }), 'the chart starts on the first currency of the list, and the reader can change it');
  assert.ok(screen.getByRole('option', { name: 'USD' }));
});

test('a weekly plan says its monthly value is approximate', () => {
  const workspace = { id: 'ws-1', uid: 'u-1', name: 'Plan books', businessType: 'custom', createdAt: '2026-01-01', currency: 'USD' };
  useAuthStore.setState({ user: null, isGuest: true, currentWorkspaceId: 'ws-1', workspaces: [workspace] } as never);
  useLedgerStore.setState({
    customers: [{ id: 'c1', name: 'Alpha Ltd', workspaceId: 'ws-1' }],
    recurring: [
      { id: 'w1', workspaceId: 'ws-1', description: 'Weekly care', amountCents: 1000, frequency: 'weekly', nextOccurrence: '2026-11-01', isActive: true, status: 'active', createdAt: '2026-01-01T10:00:00.000Z', generatedCount: 40, invoiceTemplate: { customerId: 'c1' } },
    ],
    truncatedCollections: {},
  } as never);

  render(<SubscriptionPlansPanel from="2026-01" to="2026-10" />);
  const text = screen.getByRole('region', { name: 'Subscription plans' }).textContent || '';
  assert.match(text, /\$43\.33 \(approx\.\)/);
  assert.match(text, /1 plan\(s\) priced per week or day/);
});
