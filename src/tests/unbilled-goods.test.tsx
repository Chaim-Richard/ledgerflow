/**
 * Goods not yet billed (CB-18, CB-19): units delivered and kept above those invoiced, at the order's
 * price; units received on purchase orders without a bill; and the report on screen.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { deliveredNotInvoiced, receivedNotBilled, totalsByCurrency } from '../lib/unbilledGoods';
import GoodsNotBilledReportView from '../components/reporting/GoodsNotBilledReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
import type { Estimate, Invoice, PurchaseOrder, Transaction } from '../types';

const order = {
  id: 'o1', number: 'SO-7', customerName: 'Acme', orderedAt: '2026-09-01', status: 'accepted', amountCents: 100000,
  lines: [{ description: 'Chair', itemId: 'chair', quantity: 10, unitPriceCents: 5000, amountCents: 50000 }, { description: 'Desk', itemId: 'desk', quantity: 2, unitPriceCents: 25000, amountCents: 50000 }],
} as unknown as Estimate;
const delivery = (id: string, line: number, quantity: number, type = 'delivery-cogs-auto') =>
  ({ id, date: '2026-09-05', status: 'completed', type: 'actual', lines: [], metadata: { type, orderId: 'o1', orderLine: line, quantity, deliveryId: `dlv_${id}` } }) as unknown as Transaction;
const entries = [delivery('d1', 0, 6), delivery('d2', 1, 2), delivery('r1', 0, 1, 'delivery-return-auto')];
const invoice = { id: 'i1', status: 'sent', date: '2026-09-06', metadata: { convertedFromEstimateId: 'o1' }, items: [{ quantity: 2, amountCents: 10000, metadata: { orderLine: 0 } }, { quantity: 2, amountCents: 50000, metadata: { orderLine: 1 } }] } as unknown as Invoice;
const po = (id: string, extra: Partial<PurchaseOrder>, received: number) => ({
  id, poNumber: `PO-${id}`, vendorName: 'Supplier', status: 'partially_received', currency: 'EUR', issueDate: '2026-09-01',
  items: [{ id: 'x', description: 'Paper', quantity: 10, unitPriceCents: 1250, totalCents: 12500, receivedQuantity: received }], ...extra,
}) as unknown as PurchaseOrder;

describe('Goods not yet billed', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('delivered and kept, above what is invoiced, at the order\'s price', () => {
    assert.deepEqual(deliveredNotInvoiced([order], [invoice], entries).map(r => [r.number, r.description, r.delivered, r.invoiced, r.units, r.valueCents]), [
      ['SO-7', 'Chair', 5, 2, 3, 15000],
    ], '6 delivered, 1 back, 2 invoiced: 3 to invoice; the desks are invoiced');
    assert.equal(deliveredNotInvoiced([order], [{ ...invoice, status: 'void' } as Invoice], entries).length, 2, 'a void invoice does not count');
    assert.equal(deliveredNotInvoiced([{ ...order, orderedAt: undefined } as Estimate], [], entries).length, 0, 'a quote is not an order');
  });

  test('received on an order without a bill; billed and cancelled orders are not listed', () => {
    const rows = receivedNotBilled([po('1', {}, 4), po('2', { billId: 'b9', status: 'billed' }, 10), po('3', { status: 'cancelled' }, 2), po('4', {}, 0)]);
    assert.deepEqual(rows.map(r => [r.number, r.received, r.valueCents, r.currency]), [['PO-1', 4, 5000, 'EUR']]);
    assert.deepEqual(totalsByCurrency([...rows, { valueCents: 700 }], 'USD'), [{ currency: 'EUR', cents: 5000 }, { currency: 'USD', cents: 700 }]);
  });

  test('on screen: both lists with their totals', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ estimates: [order], invoices: [invoice], transactions: entries });
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const body = String(input).includes('purchaseOrders') ? [{ id: 'p1', data: po('1', {}, 4), updated_at: '2026-09-01' }] : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<GoodsNotBilledReportView />);
    assert.match(screen.getByText(/^Delivered, not invoiced/).textContent || '', /\$150\.00/);
    await waitFor(() => assert.match(screen.getByText(/^Received, not billed/).textContent || '', /€50\.00/));
    assert.ok(screen.getByRole('rowheader', { name: 'PO-1' }));
  });
});
