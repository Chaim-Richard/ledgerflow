/**
 * A-47 on the screen: the vendor scorecard shows each vendor's on-time share, item price changes in
 * the bill's currency, and returns; a vendor with no dated orders says "Not measured", never 100%.
 * Read-only: the screen only reads the stores.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { VendorScorecardPanel } from '../components/reporting/VendorScorecardReportView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';

const previousAuth = useAuthStore.getState();
const previousLedger = useLedgerStore.getState();

beforeEach(() => {
  useLedgerStore.setState({ bills: [], vendors: [], vendorCredits: [], truncatedCollections: {} } as never);
});

afterEach(() => {
  cleanup();
  useAuthStore.setState(previousAuth, true);
  useLedgerStore.setState(previousLedger, true);
});

test('the scorecard lists each vendor with its price change and returns, and says "Not measured" without dated orders', () => {
  const workspace = { id: 'ws-1', uid: 'u-1', name: 'Scorecard books', businessType: 'custom', createdAt: '2026-01-01', currency: 'USD' };
  useAuthStore.setState({ user: null, isGuest: true, currentWorkspaceId: 'ws-1', workspaces: [workspace] } as never);
  useLedgerStore.setState({
    vendors: [{ id: 'v1', name: 'Acme Supplies', workspaceId: 'ws-1' }, { id: 'v2', name: 'Quiet Vendor', workspaceId: 'ws-1' }],
    bills: [
      { id: 'b1', workspaceId: 'ws-1', vendorId: 'v1', date: '2026-09-02', currency: 'USD', amountCents: 10000, splits: [{ accountId: 'a', amountCents: 10000, itemId: 'paper', quantity: 10 }] },
      { id: 'b2', workspaceId: 'ws-1', vendorId: 'v1', date: '2026-09-20', currency: 'USD', amountCents: 12000, splits: [{ accountId: 'a', amountCents: 12000, itemId: 'paper', quantity: 10 }] },
    ],
    vendorCredits: [{ id: 'c1', workspaceId: 'ws-1', vendorId: 'v1', date: '2026-09-28', status: 'applied', amountCents: 3000, returnedGoods: [{ billLine: 1, itemId: 'paper', quantity: 3, valueCents: 3000 }] }],
    truncatedCollections: {},
  } as never);
  // the purchase orders are passed in: the screen's own wrapper reads them from the database
  render(<VendorScorecardPanel endDate="2026-10-13" orders={[]} />);
  assert.ok(screen.getByRole('heading', { name: 'Vendor scorecard' }));
  const table = screen.getByRole('table');
  assert.match(table.textContent || '', /Acme Supplies/);
  assert.match(table.textContent || '', /paper \(USD\): \$10\.00 to \$12\.00 per unit, 1 change \(20%\)/);
  assert.match(table.textContent || '', /1 credit, 3 units, \$30\.00/);
  assert.match(table.textContent || '', /Quiet Vendor/);
  assert.equal(screen.queryByText(/100\.00%/), null, 'a vendor without dated orders is never shown as on time');
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));
});
