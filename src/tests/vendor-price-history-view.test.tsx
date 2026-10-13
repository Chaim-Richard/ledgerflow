/**
 * A-71 on the screen: the price history lists each item per vendor with its first and last unit
 * cost, the change between them, and says "One purchase so far" when there is nothing to compare.
 * Read-only: the screen only reads the stores.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { VendorPriceHistoryPanel } from '../components/reporting/VendorPriceHistoryReportView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';

const previousAuth = useAuthStore.getState();
const previousLedger = useLedgerStore.getState();

beforeEach(() => {
  useLedgerStore.setState({ bills: [], vendors: [], inventory: [], truncatedCollections: {} } as never);
});

afterEach(() => {
  cleanup();
  useAuthStore.setState(previousAuth, true);
  useLedgerStore.setState(previousLedger, true);
});

test('the screen compares the vendor’s own bill lines and keeps each currency apart', () => {
  const workspace = { id: 'ws-1', uid: 'u-1', name: 'Price books', businessType: 'custom', createdAt: '2026-01-01', currency: 'USD' };
  useAuthStore.setState({ user: null, isGuest: true, currentWorkspaceId: 'ws-1', workspaces: [workspace] } as never);
  useLedgerStore.setState({
    vendors: [{ id: 'v1', name: 'Acme Supplies', workspaceId: 'ws-1' }],
    inventory: [{ id: 'paper', name: 'Paper', sku: 'P-1', workspaceId: 'ws-1' }],
    bills: [
      { id: 'b1', workspaceId: 'ws-1', vendorId: 'v1', number: 'B-1', date: '2026-02-02', currency: 'USD', status: 'approved', splits: [{ accountId: 'a', amountCents: 10000, itemId: 'paper', quantity: 10 }] },
      { id: 'b2', workspaceId: 'ws-1', vendorId: 'v1', number: 'B-2', date: '2026-03-02', currency: 'USD', status: 'approved', splits: [{ accountId: 'a', amountCents: 12000, itemId: 'paper', quantity: 10 }] },
      { id: 'b3', workspaceId: 'ws-1', vendorId: 'v1', number: 'B-3', date: '2026-03-03', currency: 'EUR', status: 'approved', splits: [{ accountId: 'a', amountCents: 20000, itemId: 'paper', quantity: 10 }] },
      { id: 'b4', workspaceId: 'ws-1', vendorId: 'v1', number: 'B-4', date: '2026-03-04', currency: 'USD', status: 'draft', splits: [{ accountId: 'a', amountCents: 99000, itemId: 'paper', quantity: 10 }] },
    ],
    truncatedCollections: {},
  } as never);

  render(<VendorPriceHistoryPanel from="2026-01-01" to="2026-12-31" />);
  assert.ok(screen.getByRole('heading', { name: 'Vendor price history' }));
  const table = screen.getByRole('table');
  assert.match(table.textContent || '', /Acme Supplies/);
  assert.match(table.textContent || '', /Paper \(P-1\)/);
  assert.match(table.textContent || '', /\+20\.00%/);
  assert.match(table.textContent || '', /Higher/);
  assert.match(table.textContent || '', /One purchase so far/, 'the EUR series holds one point of its own');
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));
  assert.ok(screen.getByRole('img', { name: /Unit cost of Paper from Acme Supplies/ }));
  const tableText = table.textContent || '';
  assert.ok(!tableText.includes('$990.00'), 'a draft bill is not a price paid');
});
