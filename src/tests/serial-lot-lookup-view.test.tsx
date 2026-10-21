/**
 * A-33 screen (A-112 fix): serial and lot lookup. Hand-checked from the loaded documents in their
 * real shapes: the search is case-insensitive and shows every placement of a matching serial
 * (document, line, lot) from invoice lines and goods receipts, one item's lots add the lines and
 * units and the first/last dates, and the same serial on two documents for one item is listed as
 * a duplicate to look at. Nothing is written.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SerialLotLookupReportView from '../components/reporting/SerialLotLookupReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const inventory = [
  { id: 'i1', name: 'Widget', workspaceId: 'w1' },
  { id: 'i2', name: 'Gadget', workspaceId: 'w1' },
];
const invoices = [
  {
    id: 'inv1', workspaceId: 'w1', date: '2026-10-01', number: 'INV-1',
    items: [{ id: 'li1', itemId: 'i1', description: 'Widget', quantity: 2, rateCents: 1500, amountCents: 3000, accountId: 'a1', serialNumbers: ['SN-001', 'SN-002'], lotNumber: 'L1' }],
  },
];
const purchaseOrders = [
  {
    id: 'po1', workspaceId: 'w1', poNumber: 'PO-1', vendorId: 'v1', vendorName: 'Vendor One',
    issueDate: '2026-09-28', status: 'received', totalAmountCents: 4000, createdAt: '2026-09-28T00:00:00Z',
    items: [{ id: 'poi1', description: 'Widget', quantity: 4, unitPriceCents: 1000, totalCents: 4000, receivedQuantity: 4, itemId: 'i1' }],
    receipts: [{
      id: 'gr1', uid: 'u1', workspaceId: 'w1', receiptNumber: 'GR-PO-1-1', poId: 'po1', poNumber: 'PO-1',
      vendorId: 'v1', vendorName: 'Vendor One', receivedDate: '2026-10-02',
      items: [{ poItemId: 'poi1', description: 'Widget', quantityReceived: 4, unitPriceCents: 1000, condition: 'good', serialNumbers: ['SN-002'], lotNumber: 'L1' }],
      status: 'verified', createdAt: '2026-10-02T00:00:00Z',
    }],
  },
];

describe('Serial & lot lookup screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({
      isGuest: true, user: null, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' }] as never,
    });
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      inventory: inventory as never, invoices: invoices as never,
      truncatedCollections: {} as never,
    });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('a serial search is case-insensitive and shows every placement', async () => {
    render(<SerialLotLookupReportView purchaseOrders={purchaseOrders as never} />);
    await waitFor(() => assert.match(screen.getByText(/3 serial number placement\(s\) recorded/).textContent || '', /1 tracked item\(s\)/));
    fireEvent.change(screen.getByLabelText('Find a serial number'), { target: { value: 'sn-00' } });
    const rows = within(screen.getByRole('table', { name: 'Documents carrying a matching serial' })).getAllByRole('row').slice(1);
    assert.equal(rows.length, 3, 'SN-001 and SN-002 on inv1, and SN-002 on the goods receipt');
    assert.match(rows[0].textContent || '', /SN-001/);
    assert.match(rows[0].textContent || '', /inv1/);
    assert.match(rows[0].textContent || '', /invoice/);
    assert.match(rows[1].textContent || '', /SN-002/);
    assert.match(rows[2].textContent || '', /GR-PO-1-1/);
    assert.match(rows[2].textContent || '', /goods receipt/);
    assert.match(rows[2].textContent || '', /L1/);
  });

  test('one item’s lots add the lines, units and dates', async () => {
    render(<SerialLotLookupReportView purchaseOrders={purchaseOrders as never} />);
    await waitFor(() => assert.ok(screen.getByRole('region', { name: 'Serial and lot lookup' })));
    const lotsTable = screen.getByRole('table', { name: 'Lots recorded for this item' });
    const lotRow = within(lotsTable).getAllByRole('row')[1];
    assert.match(lotRow.textContent || '', /L1/);
    assert.match(lotRow.textContent || '', /2/, 'two lines carry the lot');
    assert.match(lotRow.textContent || '', /6/, 'two units sold, four units received');
    assert.match(lotRow.textContent || '', /2026-10-01/);
    assert.match(lotRow.textContent || '', /2026-10-02/);
    const serialsTable = screen.getByRole('table', { name: 'Serial numbers recorded for this item' });
    assert.equal(within(serialsTable).getAllByRole('row').slice(1).length, 3);
  });

  test('the same serial twice for one item is listed to look at', async () => {
    render(<SerialLotLookupReportView purchaseOrders={purchaseOrders as never} />);
    await waitFor(() => assert.ok(screen.getByRole('table', { name: 'Serials recorded twice for one item' })));
    const dupRow = within(screen.getByRole('table', { name: 'Serials recorded twice for one item' })).getAllByRole('row')[1];
    assert.match(dupRow.textContent || '', /SN-002/);
    assert.match(dupRow.textContent || '', /inv1/);
    assert.match(dupRow.textContent || '', /GR-PO-1-1/);
  });

  test('a search with nothing behind it says so in words', async () => {
    render(<SerialLotLookupReportView purchaseOrders={purchaseOrders as never} />);
    fireEvent.change(screen.getByLabelText('Find a serial number'), { target: { value: 'SN-999' } });
    await waitFor(() => assert.ok(screen.getByText('No serial on a loaded document matches this search.')));
    assert.equal(screen.queryByRole('button', { name: 'Export CSV' })?.matches(':disabled'), true);
  });

  test('lines on shapes without serials are never read', async () => {
    useLedgerStore.setState({
      inventory: inventory as never,
      invoices: [{ id: 'inv9', workspaceId: 'w1', date: '2026-10-03', items: [{ id: 'x', description: 'Widget', quantity: 1 }] }] as never,
      bills: [{ id: 'b9', workspaceId: 'w1', date: '2026-10-03', lines: [{ itemId: 'i1', serialNumbers: ['GHOST'] }] }] as never,
      truncatedCollections: {} as never,
    });
    render(<SerialLotLookupReportView purchaseOrders={[]} />);
    await waitFor(() => assert.ok(screen.getByText(/No loaded invoice or receipt line carries a serial number or a lot yet/)));
  });
});

describe('Serial & lot lookup with no recorded numbers', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the screen says the numbers appear when documents carry them', () => {
    stubFetch(404);
    useAuthStore.setState({
      isGuest: true, user: null, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' }] as never,
    });
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      inventory: [{ id: 'i1', name: 'Widget', workspaceId: 'w1' }] as never,
      invoices: [] as never, bills: [] as never, creditNotes: [] as never, vendorCredits: [] as never,
      truncatedCollections: {} as never,
    });
    render(<SerialLotLookupReportView purchaseOrders={[]} />);
    assert.ok(screen.getByText(/No loaded invoice or receipt line carries a serial number or a lot yet/));
    assert.ok(screen.getByText('No serial is recorded twice for one item.'));
  });
});
