/**
 * Purchase orders (BE-11, src/lib/purchaseOrders.ts): numbering and the bill an order becomes.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { billLinesFromOrder, nextPoNumber } from '../lib/purchaseOrders';
import { performThreeWayMatch } from '../lib/threeWayMatchEngine';
import type { Bill, PurchaseOrder } from '../types';

const order = (items: PurchaseOrder['items']): PurchaseOrder => ({
  id: 'po1', uid: 'u', workspaceId: 'w', poNumber: 'PO-2026-004', vendorId: 'v1', vendorName: 'Supplier', issueDate: '2026-09-01',
  status: 'approved', items, totalAmountCents: items.reduce((s, i) => s + i.totalCents, 0), createdAt: '2026-09-01T00:00:00Z',
});

describe('Purchase orders', () => {
  test('numbers continue from the highest this year', () => {
    assert.equal(nextPoNumber([], '2026'), 'PO-2026-001');
    assert.equal(nextPoNumber([{ poNumber: 'PO-2026-009' }, { poNumber: 'PO-2026-002' }, { poNumber: 'PO-2025-040' }], '2026'), 'PO-2026-010');
  });

  test('the bill uses what was ordered when nothing was received yet', () => {
    const lines = billLinesFromOrder(order([
      { id: 'a', description: 'Desks', quantity: 5, unitPriceCents: 45000, totalCents: 225000 },
      { id: 'b', description: 'Chairs', quantity: 1, unitPriceCents: 12050, totalCents: 12050, accountId: 'furniture' },
    ]));
    assert.deepEqual(lines.map(l => l.amountCents), [225000, 12050]);
    assert.equal(lines[1].accountId, 'furniture');
    assert.match(lines[0].description || '', /PO-2026-004: Desks \(5 ×/);
  });

  test('once goods arrived, the bill uses the received quantities (nothing for items not received)', () => {
    const lines = billLinesFromOrder(order([
      { id: 'a', description: 'Desks', quantity: 5, unitPriceCents: 45000, totalCents: 225000, receivedQuantity: 3 },
      { id: 'b', description: 'Chairs', quantity: 2, unitPriceCents: 12050, totalCents: 24100, receivedQuantity: 0 },
    ]));
    assert.deepEqual(lines.map(l => l.amountCents), [135000]);
  });

  test('a bill made from the order matches it in the 3-way match', () => {
    const po = order([{ id: 'a', description: 'Desks', quantity: 2, unitPriceCents: 1000, totalCents: 2000, receivedQuantity: 2 }]);
    const receipt = { id: 'r1', uid: 'u', workspaceId: 'w', receiptNumber: 'GR-1', poId: 'po1', poNumber: po.poNumber, vendorId: 'v1', receivedDate: '2026-09-05', status: 'verified' as const, createdAt: '',
      items: [{ poItemId: 'a', description: 'Desks', quantityReceived: 2, unitPriceCents: 1000, condition: 'good' as const }] };
    const bill = { id: 'b1', uid: 'u', workspaceId: 'w', vendorId: 'v1', amountCents: 2000, dueDate: '2026-10-01', status: 'pending', splits: billLinesFromOrder(po), metadata: { poId: 'po1' } } as Bill;
    const summary = performThreeWayMatch([po], [receipt], [bill]);
    assert.equal(summary.results[0].status, 'matched', JSON.stringify(summary.results[0]));
  });
});
