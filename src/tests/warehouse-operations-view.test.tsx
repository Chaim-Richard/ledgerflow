/**
 * A-64–A-67 on the existing Inventory Cycle Count host: bin metadata, an open-pick/packing-slip
 * view and tracking annotation, two-person return workflow, and serial-linked warranty dates.
 * Writes are asserted at the existing nested-field RPC boundary; none posts stock or money.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WarehouseOperationsReportView from '../components/reporting/WarehouseOperationsReportView';
import CycleCountReportView from '../components/reporting/CycleCountReportView';
import { DELIVERY_COGS_TYPE } from '../lib/deliveries';
import { binLocationKey } from '../lib/warehouseWorkflows';
import { getLocalDateISO } from '../lib/utils';
import { getSupabase } from '../lib/db/client';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Customer, Estimate, Invoice, InventoryItem, Transaction } from '../types';

const workspaceId = 'component-workspace';
const location = { id: 'warehouse-1', dimensionId: 'location', description: 'Main warehouse', status: 'active' as const };
const customer: Customer = { id: 'customer-1', uid: 'test-user', workspaceId, name: 'Acme Co' };
const item: InventoryItem = {
  id: 'item-1', uid: 'test-user', workspaceId, name: 'Blue Widget', sku: 'W-100', itemType: 'stock',
  unitPriceCents: 1000, unitCostCents: 400, quantityAtHand: 20, reorderPoint: 2,
  createdAt: '2026-01-01',
  binLocations: { [binLocationKey(location.id)]: { locationId: location.id, bin: 'A-03' } },
};
const order: Estimate = {
  id: 'order-1', uid: 'test-user', workspaceId, customerId: customer.id, customerName: customer.name,
  number: 'SO-001', amountCents: 5000, date: '2026-10-10', status: 'accepted', orderedAt: '2026-10-11',
  createdAt: '2026-10-10', lines: [{ itemId: item.id, description: item.name, quantity: 5, unitPriceCents: 1000, amountCents: 5000 }],
};
const invoice: Invoice = {
  id: 'invoice-1', uid: 'test-user', workspaceId, customerId: customer.id, customerName: customer.name,
  number: 'INV-001', amountCents: 5000, date: '2026-10-12', dueDate: '2026-11-11', status: 'sent',
  metadata: { convertedFromEstimateId: order.id },
  items: [{
    id: 'invoice-line-1', itemId: item.id, description: item.name, quantity: 5,
    rateCents: 1000, amountCents: 5000, accountId: 'income', metadata: { orderLine: 0 },
    serialNumbers: ['SN-001'],
  }],
};
const deliveryEntry: Transaction = {
  id: 'delivery-entry-1', uid: 'test-user', workspaceId, date: '2026-10-13', description: 'Delivery', lines: [],
  totalAmountCents: 0, currency: 'USD', status: 'completed', type: 'actual',
  metadata: {
    type: DELIVERY_COGS_TYPE, orderId: order.id, deliveryId: 'dlv_0123456789abcdef',
    inventoryItemId: item.id, orderLine: 0, quantity: 2,
  },
};

const realFetch = globalThis.fetch;
let calls: ReturnType<typeof stubFetchWithBodies> = [];

function prepare(role: 'owner' | 'accountant' | 'bookkeeper' | 'viewer' = 'owner') {
  const workspace = setComponentWorkspace(role);
  useAuthStore.setState({ workspaces: [{ ...workspace, goodsLeaveWith: 'delivery' }] });
  markComponentCollectionsLoaded('inventory', 'estimates', 'invoices', 'transactions', 'customers', 'creditNotes');
  useLedgerStore.setState({
    inventory: [item], estimates: [order], invoices: [invoice], transactions: [deliveryEntry],
    customers: [customer], creditNotes: [], dimensionNodes: [location], truncatedCollections: {},
  });
  calls = stubFetchWithBodies(200, null);
}

function rpcWrites() {
  return calls.filter(call => call.url.includes('/rpc/lf_update'));
}

describe('Warehouse operations views (A-64–A-67)', () => {
  beforeEach(() => prepare());
  afterEach(async () => {
    cleanup();
    document.body.classList.remove('warehouse-packing-print');
    globalThis.fetch = realFetch;
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
  });

  test('warehouse workflows are reachable from the existing Inventory Cycle Count report', async () => {
    render(<CycleCountReportView loadMoves={async () => []} />);
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Warehouse operations' })); });
    await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Warehouse operations' })));
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Return authorizations' })); });
    assert.ok(screen.getByRole('heading', { name: 'Return authorizations' }));
  });

  test('bin assignment persists only an item Location/bin annotation', async () => {
    render(<WarehouseOperationsReportView />);
    const editButton = await screen.findByRole('button', { name: 'Edit Bin for Blue Widget at Main warehouse' });
    await act(async () => { fireEvent.click(editButton); });
    const input = screen.getByLabelText('Bin for Blue Widget at Main warehouse');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'B-08' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => assert.equal(rpcWrites().length, 1));
    const body = rpcWrites()[0].body as { p_table: string; p_id: string; p_set: Record<string, unknown> };
    assert.equal(body.p_table, 'inventory');
    assert.equal(body.p_id, item.id);
    const binPath = `binLocations.${binLocationKey(location.id)}`;
    const savedBin = body.p_set[binPath] as { locationId: string; bin: string; updatedByUid: string; updatedByName: string; updatedAt: string };
    assert.deepEqual({ locationId: savedBin.locationId, bin: savedBin.bin, updatedByUid: savedBin.updatedByUid, updatedByName: savedBin.updatedByName }, {
      locationId: location.id, bin: 'B-08', updatedByUid: 'test-user', updatedByName: 'Test',
    });
    assert.match(savedBin.updatedAt, /^\d{4}-\d\d-/);
    assert.equal('quantityAtHand' in body.p_set, false);
  });

  test('pick list is sorted by bin, prints goods-only quantities, and shipment marking patches order metadata only', async () => {
    render(<WarehouseOperationsReportView />);
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Pick, pack and ship' })); });
    await waitFor(() => assert.match(screen.getByRole('table', { name: /Open pick list/ }).textContent || '', /A-03/));
    assert.match(screen.getByRole('table', { name: /Open pick list/ }).textContent || '', /3/);

    const originalPrint = window.print;
    let printCalls = 0;
    window.print = () => { printCalls += 1; };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Print packing slip' })); });
    await waitFor(() => assert.ok(screen.getByRole('article', { name: 'Warehouse packing slip' })));
    assert.equal(printCalls, 1);
    assert.match(screen.getByRole('article', { name: 'Warehouse packing slip' }).textContent || '', /Blue Widget/);
    assert.doesNotMatch(screen.getByRole('article', { name: 'Warehouse packing slip' }).textContent || '', /\$10\.00/);
    window.print = originalPrint;

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Shipment carrier'), { target: { value: 'ParcelCo' } });
      fireEvent.change(screen.getByLabelText('Shipment tracking number'), { target: { value: 'TRACK-001' } });
      fireEvent.change(screen.getByLabelText('Shipment date'), { target: { value: getLocalDateISO() } });
      fireEvent.click(screen.getByRole('button', { name: 'Mark shipped' }));
    });
    await waitFor(() => assert.equal(rpcWrites().length, 1));
    const body = rpcWrites()[0].body as { p_table: string; p_id: string; p_set: Record<string, unknown> };
    assert.equal(body.p_table, 'estimates');
    assert.equal(body.p_id, order.id);
    const path = 'metadata.warehouseShipmentsBySource.delivery_dlv_0123456789abcdef';
    const saved = body.p_set[path] as { carrier: string; trackingNumber: string; shippedDate: string; lines: Array<{ quantity: number }> };
    assert.equal(saved.carrier, 'ParcelCo');
    assert.equal(saved.trackingNumber, 'TRACK-001');
    assert.equal(saved.lines[0].quantity, 2);
    assert.equal('quantityAtHand' in body.p_set, false);
    assert.equal(calls.some(call => call.url.includes('/rpc/lf_batch') || call.url.includes('stockMoves')), false);
  });

  test('RMA request stores selected invoice lines and reason on the customer, not a credit or stock movement', async () => {
    render(<WarehouseOperationsReportView />);
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Return authorizations' })); });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Return quantity for Blue Widget'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('RMA reason'), { target: { value: 'Customer ordered the wrong size' } });
      fireEvent.click(screen.getByRole('button', { name: 'Submit RMA request' }));
    });
    await waitFor(() => assert.equal(rpcWrites().length, 1));
    const body = rpcWrites()[0].body as { p_table: string; p_id: string; p_set: Record<string, unknown> };
    assert.equal(body.p_table, 'customers');
    assert.equal(body.p_id, customer.id);
    const path = Object.keys(body.p_set).find(key => key.startsWith('metadata.returnAuthorizationsById.'));
    assert.ok(path);
    const saved = body.p_set[path!] as { number: string; status: string; reason: string; invoiceId: string; lines: Array<{ quantity: number; invoiceLineId: string }>; events: unknown[] };
    assert.match(saved.number, /^RMA-\d{4}-[A-HJ-NP-Z2-9]{12}$/);
    assert.equal(saved.status, 'requested');
    assert.equal(saved.reason, 'Customer ordered the wrong size');
    assert.equal(saved.invoiceId, invoice.id);
    assert.deepEqual(saved.lines.map(line => [line.invoiceLineId, line.quantity]), [['invoice-line-1', 1]]);
    assert.equal(saved.events.length, 1);
    assert.equal('amountCents' in saved, false);
    assert.equal(calls.some(call => (call.body as { p_table?: string } | undefined)?.p_table === 'creditNotes'), false);
  });

  test('warranty end date is keyed to the issued invoice serial and keeps its editor history', async () => {
    render(<WarehouseOperationsReportView />);
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Warranty register' })); });
    await act(async () => { fireEvent.change(screen.getByLabelText('Warranty status filter'), { target: { value: 'all' } }); });
    assert.ok(screen.getByText('SN-001'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Edit Warranty end date for SN-001/ })); });
    const input = screen.getByLabelText(/Warranty end date for SN-001/);
    await act(async () => {
      fireEvent.change(input, { target: { value: '2027-10-15' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => assert.equal(rpcWrites().length, 1));
    const body = rpcWrites()[0].body as { p_table: string; p_id: string; p_set: Record<string, unknown> };
    assert.equal(body.p_table, 'customers');
    assert.equal(body.p_id, customer.id);
    const path = Object.keys(body.p_set).find(key => key.startsWith('metadata.warrantiesById.w_'));
    assert.ok(path);
    const saved = body.p_set[path!] as { serial: string; endDate: string; changeLog: Array<{ previousEndDate: string | null }> };
    assert.equal(saved.serial, 'SN-001');
    assert.equal(saved.endDate, '2027-10-15');
    assert.equal(saved.changeLog.length, 1);
    assert.equal(saved.changeLog[0].previousEndDate, null);
    assert.equal('amountCents' in saved, false);
  });
});
