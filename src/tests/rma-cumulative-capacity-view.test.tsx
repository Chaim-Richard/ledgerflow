import './helpers/dom';
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReturnAuthorizationsPanel from '../components/reporting/ReturnAuthorizationsPanel';
import { createReturnAuthorization } from '../lib/warehouseRecords';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';
import { stubRmaServer, type RmaCall } from './helpers/rmaServer';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import type { Customer, Invoice, InventoryItem } from '../types';

const ws = 'component-workspace';
const item: InventoryItem = {
  id: 'item-1', uid: 'test-user', workspaceId: ws, name: 'Blue Widget', sku: 'BLUE',
  itemType: 'stock', unitPriceCents: 500, unitCostCents: 250, quantityAtHand: 10,
  reorderPoint: 0, createdAt: '2026-10-01',
};
const invoice: Invoice = {
  id: 'invoice-1', uid: 'test-user', workspaceId: ws, customerId: 'customer-1',
  customerName: 'Acme Co', number: 'INV-1', status: 'sent', amountCents: 2500,
  date: '2026-10-01', dueDate: '2026-11-01',
  items: [{ id: 'line-1', itemId: item.id, description: item.name, quantity: 5, rateCents: 500,
    amountCents: 2500, accountId: 'revenue' }],
};
const oldRma = createReturnAuthorization({
  id: 'rma_previous', number: 'RMA-PREVIOUS', workspaceId: ws,
  customerId: 'customer-1', customerName: 'Acme Co',
  invoiceId: invoice.id, invoiceNumber: invoice.number || invoice.id,
  reason: 'Wrong size', lines: [{ invoiceLineId: 'line-1', itemId: item.id,
    description: item.name, quantity: 3, soldQuantity: 5 }],
  actor: { uid: 'previous-user', name: 'Previous', role: 'bookkeeper' },
  at: '2026-10-14T10:00:00.000Z',
});
const originalFetch = globalThis.fetch;
let calls: RmaCall[] = [];

beforeEach(() => {
  setComponentWorkspace('owner');
  markComponentCollectionsLoaded('customers', 'invoices', 'inventory', 'creditNotes');
  useLedgerStore.setState({
    customers: [{ id: 'customer-1', uid: 'test-user', workspaceId: ws, name: 'Acme Co' }],
    invoices: [invoice], inventory: [item], creditNotes: [], truncatedCollections: {},
  });
  // ISS-143: the server answers RMA requests (helpers/rmaServer.ts)
  calls = stubRmaServer({ workspaceId: ws, customerName: 'Acme Co', invoiceNumber: 'INV-1', line: () => ({ itemId: item.id, description: item.name, soldQuantity: 5 }) });
});
afterEach(async () => {
  cleanup();
  globalThis.fetch = originalFetch;
  getSupabase().realtime.disconnect();
  await getSupabase().auth.dispose();
});
const writes = () => calls.filter(call => call.url.includes('/return-authorizations'));
const enter = async (qty: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Return quantity for Blue Widget'), { target: { value: qty } });
    fireEvent.change(screen.getByLabelText('RMA reason'), { target: { value: 'Wrong size' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit RMA request' }));
  });
};

test('warehouse RMA screen blocks a second request exceeding quantity already reserved', async () => {
  const customer: Customer = { id: 'customer-1', uid: 'test-user', workspaceId: ws,
    name: 'Acme Co', metadata: { returnAuthorizationsById: { [oldRma.id]: oldRma } } };
  useLedgerStore.setState({ customers: [customer] });
  render(<ReturnAuthorizationsPanel />);
  await enter('3');
  assert.match(screen.getByRole('alert').textContent || '', /only 2\.00/);
  assert.equal(writes().length, 0);
  await enter('2');
  await waitFor(() => assert.equal(writes().length, 1));
});

test('warehouse RMA screen includes a successful write before the loaded customer cache refreshes', async () => {
  render(<ReturnAuthorizationsPanel />);
  await enter('3');
  await waitFor(() => assert.equal(writes().length, 1));
  await waitFor(() => assert.equal((screen.getByLabelText('RMA reason') as HTMLTextAreaElement).value, ''));
  await enter('3');
  assert.match(screen.getByRole('alert').textContent || '', /only 2\.00/);
  assert.equal(writes().length, 1, 'a stale cached customer must not allow a duplicate overlapping return');
});
