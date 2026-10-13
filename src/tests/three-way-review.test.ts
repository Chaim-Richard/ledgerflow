/**
 * A-118: the three-way match review. The results must be the purchase-orders engine's own results —
 * this test builds orders, receipts and bills by hand and reads the review's summary, rows and CSV.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { threeWayReview, threeWayReviewCsvRows, THREE_WAY_REVIEW_CSV_HEADERS } from '../lib/threeWayReview';
import { makeBill } from './fixtures';
import type { PurchaseOrder } from '../types';

const po = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po1', uid: 'u1', workspaceId: 'ws-1', poNumber: 'PO-1', vendorId: 'v1', vendorName: 'Acme',
  issueDate: '2026-02-01', status: 'approved', currency: 'USD', totalAmountCents: 10000,
  items: [{ id: 'l1', description: 'Paper', quantity: 10, unitPriceCents: 1000, totalCents: 10000 }],
  createdAt: '2026-02-01T09:00:00.000Z',
  ...overrides,
});

const receipt = (quantity: number, overrides: Record<string, unknown> = {}) => ({
  id: 'gr1', uid: 'u1', workspaceId: 'ws-1', receiptNumber: 'GR-1', poId: 'po1', poNumber: 'PO-1', vendorId: 'v1',
  receivedDate: '2026-02-10', status: 'received' as const, createdAt: '2026-02-10T09:00:00.000Z',
  items: [{ poItemId: 'l1', description: 'Paper', quantityReceived: quantity, unitPriceCents: 1000, condition: 'good' as const }],
  ...overrides,
});

const vendors = [{ id: 'v1', name: 'Acme' }];

describe('A-118 three-way match review', () => {
  test('an order with its receipt and its bill at the ordered amount is a match', () => {
    const orders = [po({ receipts: [receipt(10) as never] })];
    const bills = [makeBill({ id: 'b1', vendorId: 'v1', amountCents: 10000, metadata: { poId: 'po1' } })];
    const report = threeWayReview({ orders, bills, vendors });
    assert.equal(report.summary.orders, 1);
    assert.equal(report.summary.matched, 1);
    assert.equal(report.rows[0].status, 'matched');
    assert.equal(report.rows[0].vendorName, 'Acme');
    assert.equal(report.rows[0].orderedCents, 10000);
    assert.equal(report.rows[0].receivedCents, 10000);
    assert.equal(report.rows[0].billedCents, 10000);
    assert.equal(report.rows[0].varianceCents, 0);
    assert.deepEqual(report.rows[0].findings, []);
  });

  test('a bill above the order is a price variance with the difference in the order’s currency', () => {
    const orders = [po({ receipts: [receipt(10) as never] })];
    const bills = [makeBill({ id: 'b1', vendorId: 'v1', amountCents: 11200, metadata: { poId: 'po1' } })];
    const report = threeWayReview({ orders, bills, vendors });
    assert.equal(report.rows[0].status, 'price_variance');
    assert.equal(report.rows[0].varianceCents, 1200);
    assert.equal(report.rows[0].variancePercent, 12);
    assert.match(report.rows[0].findings.join(' '), /Price variance/);
    assert.equal(report.summary.priceVariance, 1);
    assert.equal(report.summary.varianceCents, 1200);
    assert.deepEqual(report.byCurrency, [{ currency: 'USD', orders: 1, varianceCents: 1200 }]);
  });

  test('a short receipt against its bill is a quantity variance and an order with no receipt is not received', () => {
    const orders = [
      po({ id: 'short', poNumber: 'PO-S', receipts: [receipt(6, { poId: 'short', poNumber: 'PO-S' }) as never] }),
      po({ id: 'none', poNumber: 'PO-N', receipts: [] }),
    ];
    const bills = [makeBill({ id: 'b1', vendorId: 'v1', amountCents: 10000, metadata: { poId: 'short' } })];
    const report = threeWayReview({ orders, bills, vendors });
    const byId = new Map(report.rows.map(row => [row.poId, row]));
    assert.equal(byId.get('short')?.status, 'quantity_variance');
    assert.match(byId.get('short')?.findings.join(' ') || '', /Quantity deficit/);
    assert.equal(byId.get('none')?.status, 'unreceived');
    assert.equal(report.summary.quantityVariance, 1);
    assert.equal(report.summary.unreceived, 1);
    assert.equal(report.summary.missingBill, 0, 'an unreceived order is not also counted as awaiting a bill');
  });

  test('a received order with no bill is waiting for a bill, and the status filter narrows the review', () => {
    // the orders carry different amounts on purpose: the engine also falls back to matching a bill by
    // vendor and amount within the tolerance, so equal amounts would match both orders.
    const orders = [
      po({ receipts: [receipt(10) as never] }),
      po({
        id: 'po2', poNumber: 'PO-2', totalAmountCents: 20000,
        items: [{ id: 'l2', description: 'Paper', quantity: 20, unitPriceCents: 1000, totalCents: 20000 }],
        receipts: [receipt(20, { poId: 'po2', poNumber: 'PO-2' }) as never],
      }),
    ];
    const bills = [makeBill({ id: 'b1', vendorId: 'v1', amountCents: 10000, metadata: { poId: 'po1' } })];
    const all = threeWayReview({ orders, bills, vendors });
    assert.equal(all.summary.matched, 1);
    assert.equal(all.summary.missingBill, 1);
    const onlyWaiting = threeWayReview({ orders, bills, vendors, status: 'missing_bill' });
    assert.deepEqual(onlyWaiting.rows.map(row => row.poId), ['po2']);
    assert.equal(onlyWaiting.summary.orders, 1);
    assert.equal(onlyWaiting.summary.byStatus.find(total => total.status === 'matched')?.orders, 0);
  });

  test('the period filters on the order’s issue date, and cancelled orders are left to the engine', () => {
    const orders = [
      po({ id: 'jan', poNumber: 'PO-J', issueDate: '2026-01-15' }),
      po({ id: 'mar', poNumber: 'PO-M', issueDate: '2026-03-02' }),
      po({ id: 'gone', poNumber: 'PO-X', issueDate: '2026-03-03', status: 'cancelled' }),
    ];
    const report = threeWayReview({ orders, bills: [], vendors, from: '2026-03-01', to: '2026-03-31' });
    assert.deepEqual(report.window, { from: '2026-03-01', to: '2026-03-31' });
    assert.deepEqual(report.rows.map(row => row.poId), ['mar']);
    assert.equal(report.toleranceCents, 0);
  });

  test('the CSV keeps each order’s own currency and the engine’s finding text', () => {
    const orders = [po({ receipts: [receipt(10) as never] }), po({ id: 'eur', poNumber: 'PO-E', currency: 'EUR', receipts: [receipt(10, { poId: 'eur', poNumber: 'PO-E' }) as never] })];
    const bills = [makeBill({ id: 'b1', vendorId: 'v1', amountCents: 11000, metadata: { poId: 'po1' } })];
    const report = threeWayReview({ orders, bills, vendors });
    const csv = threeWayReviewCsvRows(report);
    assert.equal(csv.length, 2);
    assert.equal(csv[0].length, THREE_WAY_REVIEW_CSV_HEADERS.length);
    assert.equal(csv.find(row => row[0] === 'PO-E')?.[3], 'EUR');
    assert.match(String(csv.find(row => row[0] === 'PO-1')?.[12]), /Price variance/);
  });
});
