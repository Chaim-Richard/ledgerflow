/**
 * Purchase orders (BE-11, src/lib/purchaseOrders.ts): numbering and the bill an order becomes.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { addOrderItem, billLinesFromOrder, canChangeOrder, canDeleteOrder, canMoveDelivery, changeOrderItem, lastOrderLines, nextPoNumber, removeOrderItem, vendorsByOrders } from '../lib/purchaseOrders';
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

  test('a stock item ordered: the bill brings in the units received, or ordered when none came yet (J-08)', () => {
    const received = billLinesFromOrder(order([
      { id: 'a', description: 'Desks', quantity: 5, unitPriceCents: 45000, totalCents: 225000, receivedQuantity: 3, itemId: 'desk' },
      { id: 'b', description: 'Install', quantity: 1, unitPriceCents: 5000, totalCents: 5000, receivedQuantity: 1 },
    ]));
    assert.deepEqual(received.map(l => [l.itemId, l.quantity, l.amountCents]), [['desk', 3, 135000], [undefined, undefined, 5000]]);
    const ordered = billLinesFromOrder(order([{ id: 'a', description: 'Desks', quantity: 5, unitPriceCents: 45000, totalCents: 225000, itemId: 'desk' }]));
    assert.deepEqual(ordered.map(l => [l.itemId, l.quantity]), [['desk', 5]]);
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

describe('Changing an order in place (I-22)', () => {
  const desks = { id: 'a', description: 'Desks', quantity: 5, unitPriceCents: 45000, totalCents: 225000 };
  const chairs = { id: 'b', description: 'Chairs', quantity: 2, unitPriceCents: 12050, totalCents: 24100 };

  test('a line change recomputes the line and the order total', () => {
    const po = order([desks, chairs]);
    assert.deepEqual(changeOrderItem(po, 'b', { quantity: 3 }), { items: [desks, { ...chairs, quantity: 3, totalCents: 36150 }], totalAmountCents: 261150 });
    assert.equal(changeOrderItem(po, 'a', { unitPriceCents: 40001 }).totalAmountCents, 200005 + 24100);
    assert.equal(addOrderItem(po, { id: 'c', description: 'Lamp', quantity: 1.5, unitPriceCents: 999 }).totalAmountCents, 249100 + 1499);
    assert.deepEqual(removeOrderItem(po, 'a'), { items: [chairs], totalAmountCents: 24100 });
  });

  test('what can change: vendor and lines until something arrives; delivery until received; delete only with nothing against it', () => {
    const open = order([desks]);
    const partly = { ...order([{ ...desks, receivedQuantity: 2 }]), status: 'partially_received' as const, receipts: [{ id: 'r' } as never] };
    const billed = { ...order([desks]), status: 'billed' as const, billId: 'b1' };
    assert.deepEqual([canChangeOrder(open), canMoveDelivery(open), canDeleteOrder(open)], [true, true, true]);
    assert.deepEqual([canChangeOrder(partly), canMoveDelivery(partly), canDeleteOrder(partly)], [false, true, false]);
    assert.deepEqual([canChangeOrder(billed), canMoveDelivery(billed), canDeleteOrder(billed)], [false, false, false]);
    assert.deepEqual([canChangeOrder({ ...open, status: 'cancelled' }), canDeleteOrder({ ...open, status: 'cancelled' })], [false, true]);
  });

  test('"Same as last order" takes the vendor\'s newest order; vendors ordered from most come first', () => {
    const older = { ...order([desks]), id: 'o1', poNumber: 'PO-2026-001', issueDate: '2026-08-01' };
    const newer = { ...order([chairs]), id: 'o2', poNumber: 'PO-2026-002', issueDate: '2026-09-02' };
    const other = { ...order([desks]), id: 'o3', vendorId: 'v2', issueDate: '2026-10-01' };
    assert.deepEqual(lastOrderLines([older, newer, other], 'v1'), { poNumber: 'PO-2026-002', lines: [{ desc: 'Chairs', qty: '2', unitPrice: '120.50', itemId: '' }] });
    assert.equal(lastOrderLines([older], 'nobody'), null);
    const vendors = [{ id: 'v0', name: 'Alpha' }, { id: 'v2', name: 'Zed' }, { id: 'v1', name: 'Mid' }];
    assert.deepEqual(vendorsByOrders(vendors, [older, newer, other]).map(v => v.id), ['v1', 'v2', 'v0']);
  });
});
