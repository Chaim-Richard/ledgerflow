/**
 * A-113 screen: lots with expiry dates. Hand-checked against receipts passed as a prop: the
 * expired lot sorts first with its receipts and vendors, the status filter and the search narrow
 * the rows, sale units show as a reference, and with no lots the screen says where to record one.
 * Nothing is written.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ExpiringLotsReportView from '../components/reporting/ExpiringLotsReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const inventory = [{ id: 'i1', name: 'Milk', sku: 'MLK', workspaceId: 'w1' }];
const invoices = [{
  id: 'inv1', workspaceId: 'w1', date: day(-1), status: 'posted',
  items: [{ id: 'li1', itemId: 'i1', description: 'Milk', quantity: 2, lotNumber: 'L1' }],
}];
const purchaseOrders = [{
  id: 'po1', workspaceId: 'w1', poNumber: 'PO-1', vendorId: 'v1', vendorName: 'Vendor One',
  items: [{ id: 'poi1', description: 'Milk', quantity: 20, itemId: 'i1' }],
  receipts: [{
    receiptNumber: 'GR-PO-1-1', receivedDate: day(-10), vendorName: 'Vendor One',
    items: [
      { poItemId: 'poi1', description: 'Milk', quantityReceived: 10, lotNumber: 'L1', lotExpiryDate: day(5) },
      { poItemId: 'poi1', description: 'Milk', quantityReceived: 3, lotNumber: 'L0', lotExpiryDate: day(-3) },
      { poItemId: 'poi1', description: 'Milk', quantityReceived: 4, lotNumber: 'LN' },
    ],
  }],
}];

describe('Expiring lots screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({
      isGuest: true, user: null, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' }] as never,
    });
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      inventory: inventory as never, invoices: invoices as never, truncatedCollections: {} as never,
    });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the expired lot sorts first with its expiry, receipts, vendors and sale reference', async () => {
    render(<ExpiringLotsReportView purchaseOrders={purchaseOrders as never} />);
    await waitFor(() => assert.ok(screen.getByRole('table', { name: 'Lots with their expiry, receipts and recorded sales' })));
    assert.match(screen.getByText(/expired,/).textContent || '', /1 expired, 1 expiring/);
    const rows = within(screen.getByRole('table', { name: 'Lots with their expiry, receipts and recorded sales' })).getAllByRole('row').slice(1);
    assert.equal(rows.length, 3);
    assert.match(rows[0].textContent || '', /L0/);
    assert.match(rows[0].textContent || '', /Expired/);
    assert.match(rows[0].textContent || '', /-3/);
    assert.match(rows[1].textContent || '', /L1/);
    assert.match(rows[1].textContent || '', /Expiring soon/);
    assert.match(rows[1].textContent || '', /GR-PO-1-1/);
    assert.match(rows[1].textContent || '', /Vendor One/);
    assert.match(rows[1].textContent || '', /2/, 'two units recorded at sale');
    assert.match(rows[2].textContent || '', /No expiry recorded/);
  });

  test('the status filter and the search narrow the rows', async () => {
    render(<ExpiringLotsReportView purchaseOrders={purchaseOrders as never} />);
    await waitFor(() => assert.ok(screen.getByRole('table', { name: 'Lots with their expiry, receipts and recorded sales' })));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'expired' } });
    assert.equal(within(screen.getByRole('table', { name: 'Lots with their expiry, receipts and recorded sales' })).getAllByRole('row').slice(1).length, 1);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Find item or lot'), { target: { value: 'l1' } });
    const rows = within(screen.getByRole('table', { name: 'Lots with their expiry, receipts and recorded sales' })).getAllByRole('row').slice(1);
    assert.equal(rows.length, 1);
    assert.match(rows[0].textContent || '', /L1/);
    fireEvent.change(screen.getByLabelText('Find item or lot'), { target: { value: 'nothing-like-this' } });
    await waitFor(() => assert.ok(screen.getByText('No lots match these filters.')));
  });

  test('with no lots the screen says where to record one', async () => {
    useLedgerStore.setState({ invoices: [] as never });
    render(<ExpiringLotsReportView purchaseOrders={[]} />);
    await waitFor(() => assert.ok(screen.getByText(/No lots are recorded yet/)));
    assert.equal(screen.getByRole('button', { name: 'Download CSV' }).matches(':disabled'), true);
  });
});
