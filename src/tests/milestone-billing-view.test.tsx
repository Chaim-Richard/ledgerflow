/**
 * A-73 screen (task A-177): milestone billing view. Hand-checked: an accepted order with a 30/40/30
 * schedule shows its amounts (30% of 1,000.00 = 300.00), the past-due milestone is "due", a fully
 * converted order joins only under "all", and an order without a schedule is never listed.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import MilestoneBillingReportView from '../components/reporting/MilestoneBillingReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const estimates = [
  {
    id: 'o1', workspaceId: 'w1', customerId: 'c1', customerName: 'Acme Ltd', number: 'SO-101',
    amountCents: 100_000, date: '2026-03-01', status: 'accepted',
    milestones: [
      { id: 'm1', label: 'Signing', percent: 30, invoicedAt: '2026-03-05' },
      { id: 'm2', label: 'Halfway', percent: 40, due: '2020-01-01' },
      { id: 'm3', label: 'End', percent: 30, due: '2999-01-01' },
    ],
  },
  {
    id: 'o2', workspaceId: 'w1', customerId: 'c2', customerName: 'Beta GmbH', number: 'SO-099',
    amountCents: 60_000, date: '2026-02-01', status: 'converted', convertedInvoiceId: 'i9',
    milestones: [{ id: 'm8', label: 'Everything', percent: 100, invoicedAt: '2026-02-10' }],
  },
  { id: 'o3', workspaceId: 'w1', customerId: 'c1', amountCents: 5_000, date: '2026-04-01', status: 'sent' },
];

const orderRow = (name: RegExp) => within(screen.getByRole('table', { name }))
  .getAllByRole('row').slice(1).map(r => r.textContent || '');

describe('Milestone billing screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ isGuest: true, user: null, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' }] } as never);
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({ estimates: estimates as never, truncatedCollections: {} as never });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('an accepted order shows its invoiced and left amounts and the due milestone', () => {
    render(<MilestoneBillingReportView />);
    assert.match(screen.getByText(/order\(s\) with a schedule/).textContent || '',
      /1 order\(s\) with a schedule · 1 milestone\(s\) due to bill · left to bill \$700\.00/);
    const rows = orderRow(/Sales orders with a milestone schedule/);
    assert.equal(rows.length, 1, 'only the order still being billed');
    assert.match(rows[0], /^SO-1012026-03-01Acme Ltd\$1,000\.00\$300\.00\$700\.00Halfway \(due\) · 2020-01-01/);
    assert.ok(!rows[0].includes('Beta GmbH'), 'the converted order waits for the all filter');
  });

  test('the breakdown hand-checks the milestone shares of the order total', () => {
    render(<MilestoneBillingReportView />);
    const rows = orderRow(/Milestones of SO-101/);
    assert.match(rows[0], /^Signing30%\$300\.00—Invoiced2026-03-05$/);
    assert.match(rows[1], /^Halfway40%\$400\.002020-01-01Due—$/);
    assert.match(rows[2], /^End30%\$300\.002999-01-01Upcoming—$/);
    const foot = within(screen.getByRole('table', { name: /Milestones of SO-101/ })).getAllByRole('row').at(-1)!;
    assert.match(foot.textContent || '', /Total100%\$1,000\.00invoiced \$300\.00 · left \$700\.00/);
  });

  test('a converted order shows only under "all", and an order without a schedule is never listed', () => {
    render(<MilestoneBillingReportView />);
    assert.equal(orderRow(/Sales orders with a milestone schedule/).length, 1, 'the open list keeps the converted order out');
    fireEvent.change(screen.getByLabelText('Which orders'), { target: { value: 'all' } });
    assert.match(screen.getByText(/order\(s\) with a schedule/).textContent || '', /2 order\(s\) with a schedule · 1 milestone\(s\) due to bill · left to bill \$700\.00/, 'the converted order adds its history and the due milestone still counts');
    const rows = orderRow(/Sales orders with a milestone schedule/);
    assert.equal(rows.length, 2);
    assert.ok(rows.some(text => text.includes('SO-099')));
    assert.ok(!rows.some(text => text.includes('o3')), 'the quote without a schedule stays out');
  });
});
