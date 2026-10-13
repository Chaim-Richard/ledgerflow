/**
 * A-118 on the screen: the review counts what matched and what did not, shows the check's own
 * sentences and the bill against the order in the order's currency, and the filter narrows it.
 * Read-only: the orders are passed in (the wrapper reads them from the database).
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThreeWayMatchReviewPanel } from '../components/reporting/ThreeWayMatchReviewView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Bill, PurchaseOrder } from '../types';

const previousAuth = useAuthStore.getState();
const previousLedger = useLedgerStore.getState();

beforeEach(() => {
  useLedgerStore.setState({ bills: [], vendors: [], truncatedCollections: {} } as never);
});

afterEach(() => {
  cleanup();
  useAuthStore.setState(previousAuth, true);
  useLedgerStore.setState(previousLedger, true);
});

const order = (overrides: Partial<PurchaseOrder>): PurchaseOrder => ({
  id: 'po1', uid: 'u1', workspaceId: 'ws-1', poNumber: 'PO-1', vendorId: 'v1', vendorName: 'Acme',
  issueDate: '2026-02-01', status: 'approved', currency: 'USD', totalAmountCents: 10000,
  items: [{ id: 'l1', description: 'Paper', quantity: 10, unitPriceCents: 1000, totalCents: 10000 }],
  createdAt: '2026-02-01T09:00:00.000Z',
  ...overrides,
});

const receipt = (poId: string, poNumber: string, quantity: number) => ({
  id: `gr-${poId}`, uid: 'u1', workspaceId: 'ws-1', receiptNumber: 'GR-1', poId, poNumber, vendorId: 'v1',
  receivedDate: '2026-02-10', status: 'received' as const, createdAt: '2026-02-10T09:00:00.000Z',
  items: [{ poItemId: 'l1', description: 'Paper', quantityReceived: quantity, unitPriceCents: 1000, condition: 'good' as const }],
});

test('the review lists what matched and what did not, with the bill against the order', () => {
  const workspace = { id: 'ws-1', uid: 'u-1', name: 'Match books', businessType: 'custom', createdAt: '2026-01-01', currency: 'USD' };
  useAuthStore.setState({ user: null, isGuest: true, currentWorkspaceId: 'ws-1', workspaces: [workspace] } as never);
  useLedgerStore.setState({
    vendors: [{ id: 'v1', name: 'Acme', workspaceId: 'ws-1' }],
    bills: [{ id: 'b1', workspaceId: 'ws-1', vendorId: 'v1', number: 'BILL-1', date: '2026-02-20', dueDate: '2026-03-20', status: 'approved', amountCents: 11200, metadata: { poId: 'po1' } } as unknown as Bill],
    truncatedCollections: {},
  } as never);

  const orders = [
    order({ receipts: [receipt('po1', 'PO-1', 10) as never] }),
    order({ id: 'po2', poNumber: 'PO-2', receipts: [] }),
  ];
  render(<ThreeWayMatchReviewPanel from="2026-01-01" to="2026-12-31" orders={orders} />);
  assert.ok(screen.getByRole('heading', { name: 'Three-way match review' }));
  const text = screen.getByRole('region', { name: 'Three-way match review' }).textContent || '';
  assert.match(text, /2 order\(s\): 0 matched · 0 quantity variance · 1 price variance · 1 not received · 0 awaiting a bill/);
  const table = screen.getByRole('table');
  assert.match(table.textContent || '', /PO-1/);
  assert.match(table.textContent || '', /Price variance/);
  assert.match(table.textContent || '', /\$112\.00/);
  assert.match(table.textContent || '', /\$12\.00 \(\+12\.00%\)/);
  assert.match(table.textContent || '', /billed against the order|Price variance: PO was/);
  assert.match(table.textContent || '', /PO-2/);
  assert.match(table.textContent || '', /Not received/);
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));

  fireEvent.change(screen.getByLabelText('Match result'), { target: { value: 'unreceived' } });
  assert.equal(screen.getAllByRole('row').length, 2, 'the header and the one unreceived order');
  assert.match(screen.getByRole('table').textContent || '', /PO-2/);
});
