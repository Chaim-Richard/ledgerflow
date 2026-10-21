/**
 * DIM-2 phase 1 (GitHub #132): each stock change of an item is followed to its document and party; a missing link is
 * named; stock whose origin was never recorded is never given a vendor.
 *
 * Worked units. Widget, 4 on hand when the stock history began:
 *   1  bought        +10   bill B-1 from Acme, made from purchase order PO-7 (received GR-1 on 2026-06-02)
 *   2  sold           −3   invoice INV-1 to Dune
 *   3  delivered      −2   sales order SO-1 to Elm (the delivery's entry names the order)
 *   4  returned       +1   credit note CN-1 from Dune
 *   5  bought         +5   bill B-9, which is not in the books → missing link
 *   6  opening stock  +6   origin not recorded
 *   7  adjusted       −1   inside the business
 *   8  sent back      −2   vendor credit VC-1 to Acme
 *   on hand: 4 + 10 − 3 − 2 + 1 + 5 + 6 − 1 − 2 = 18
 *   in:  recorded 10 + 1 = 11; origin not recorded 4 (before the history) + 6 = 10; document missing 5   (11 + 10 + 5 = 26 = 4 + 22 in)
 *   out: recorded 3 + 2 + 2 = 7; inside the business 1                                               (on hand 26 − 8 = 18)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { stockTrail, stockTrailSummary, type StockTrailDocs } from '../lib/stockTrail';
import type { StockMove } from '../lib/stockMoves';

let before = 4;
let n = 0;
const move = (kind: StockMove['kind'], quantity: number, extra: Partial<StockMove> = {}): StockMove => {
  const m: StockMove = { id: `m${++n}`, workspaceId: 'ws', itemId: 'widget', date: `2026-06-${String(n).padStart(2, '0')}`, kind, quantity, quantityBefore: before, quantityAfter: before + quantity, unitCostCents: 500, valueCents: quantity * 500, seq: String(n).padStart(4, '0'), uid: 'u', createdAt: '', ...extra };
  before += quantity;
  return m;
};
const moves = [
  move('purchase', 10, { documentType: 'bill', documentId: 'B-1' }),
  move('sale', -3, { documentType: 'invoice', documentId: 'INV-1' }),
  move('sale', -2, { documentType: 'delivery', documentId: 'DEL-1', transactionId: 'tx-del' }),
  move('return', 1, { documentType: 'credit-note', documentId: 'CN-1' }),
  move('purchase', 5, { documentType: 'bill', documentId: 'B-9' }),
  move('opening', 6),
  move('adjustment', -1, { documentType: 'adjustment' }),
  move('purchase-return', -2, { documentType: 'vendor-credit', documentId: 'VC-1' }),
];
const docs: StockTrailDocs = {
  bills: [{ id: 'B-1', number: 'B-1', vendorId: 'acme' }],
  invoices: [{ id: 'INV-1', number: 'INV-1', customerId: 'dune' }],
  creditNotes: [{ id: 'CN-1', number: 'CN-1', customerId: 'dune' }],
  vendorCredits: [{ id: 'VC-1', number: 'VC-1', vendorId: 'acme' }],
  orders: [{ id: 'SO-1', number: 'SO-1', customerId: 'elm' }],
  purchaseOrders: [{ id: 'po7', poNumber: 'PO-7', vendorId: 'acme', billId: 'B-1', receipts: [{ receiptNumber: 'GR-1', receivedDate: '2026-06-02' }] }],
  transactions: [{ id: 'tx-del', metadata: { orderId: 'SO-1', deliveryId: 'DEL-1' } }],
  vendors: [{ id: 'acme', name: 'Acme Supplies' }],
  customers: [{ id: 'dune', name: 'Dune LLC' }, { id: 'elm', name: 'Elm Co' }],
};

test('DIM-2 worked units: every change is followed to its document and party', () => {
  const trail = stockTrail(moves, docs);
  assert.equal(moves[moves.length - 1].quantityAfter, 18);
  const rows = trail.steps.map(s => [s.move.kind, s.direction, s.origin, s.party?.name, s.document?.label]);
  assert.deepEqual(rows, [
    ['purchase', 'in', 'known', 'Acme Supplies', 'Bill B-1'],
    ['sale', 'out', 'known', 'Dune LLC', 'Invoice INV-1'],
    ['sale', 'out', 'known', 'Elm Co', 'Order SO-1'],
    ['return', 'in', 'known', 'Dune LLC', 'Credit note CN-1'],
    ['purchase', 'in', 'missing', undefined, undefined],
    ['opening', 'in', 'not-recorded', undefined, undefined],
    ['adjustment', 'out', 'internal', undefined, undefined],
    ['purchase-return', 'out', 'known', 'Acme Supplies', 'Vendor credit VC-1'],
  ]);
  assert.deepEqual(trail.steps[0].purchaseOrder, { id: 'po7', label: 'Purchase order PO-7', receipts: ['GR-1 · 2026-06-02'] });
  assert.deepEqual(trail.steps[4].missing, ['The bill it names (B-9) is not in the books.']);
  assert.equal(trail.beforeHistory, 4);
  assert.deepEqual(trail.unitsIn, { known: 11, notRecorded: 10, adjusted: 0, missingLink: 5, notLoaded: 0 });
  assert.deepEqual(trail.unitsOut, { known: 7, missingLink: 0, notLoaded: 0, internal: 1 });
  assert.equal(stockTrailSummary(trail), '11 came in on a document with its vendor or customer; 10 with no recorded origin (opening stock, an import, or on hand before the history began); 5 whose document is missing.');
});

test('DIM-2: imported opening stock is "origin not recorded" and never given a vendor', () => {
  const imported = move('purchase', 3, { documentType: 'import', documentId: 'batch-1' });
  const trail = stockTrail([{ ...imported, kind: 'opening' }], docs);
  assert.deepEqual([trail.steps[0].origin, trail.steps[0].party], ['not-recorded', undefined]);
});

test('DIM-2: missing links are named — no document, a document with no party, a delivery with no order', () => {
  const noDoc = stockTrail([move('sale', -1)], docs).steps[0];
  assert.deepEqual([noDoc.origin, noDoc.missing], ['missing', ['No invoice is linked to this change.']]);
  const noVendor = stockTrail([move('purchase', 1, { documentId: 'B-2' })], { ...docs, bills: [{ id: 'B-2', number: 'B-2' }] }).steps[0];
  assert.deepEqual(noVendor.missing, ['Bill B-2 names no vendor.']);
  const noOrder = stockTrail([move('sale', -1, { documentType: 'delivery', transactionId: 'tx-none' })], docs).steps[0];
  assert.deepEqual(noOrder.missing, ['No sales order is linked to this delivery.']);
});

test('DIM-2: with capped or loading document lists a document not found is not called missing from the books', () => {
  const trail = stockTrail([move('purchase', 1, { documentType: 'bill', documentId: 'B-9' })], { ...docs, partial: { bills: true } });
  assert.deepEqual([trail.steps[0].origin, trail.steps[0].missing], ['not-loaded', ['The bill it names (B-9) is not among the documents loaded.']]);
  // #260 review: not counted as a missing document
  assert.deepEqual([trail.unitsIn.missingLink, trail.unitsIn.notLoaded], [0, 1]);
  assert.match(stockTrailSummary(trail), /1 whose document is not loaded\./);
});

// ---- #260 review ----
test('#260 review: only the list searched decides "not loaded" — a capped entry list does not hide a missing bill', () => {
  const step = stockTrail([move('purchase', 1, { documentType: 'bill', documentId: 'B-9' })], { ...docs, partial: { transactions: true } }).steps[0];
  assert.deepEqual([step.origin, step.missing], ['missing', ['The bill it names (B-9) is not in the books.']]);
});

test('#260 review: goods returned against a delivery follow its sales order to the customer', () => {
  const back = move('return', 1, { documentType: 'delivery', documentId: 'DEL-1', transactionId: 'tx-ret' });
  const step = stockTrail([back], { ...docs, transactions: [...docs.transactions, { id: 'tx-ret', metadata: { orderId: 'SO-1' } }] }).steps[0];
  assert.deepEqual([step.origin, step.party?.name, step.document?.label], ['known', 'Elm Co', 'Order SO-1']);
});

test('#260 review: stock received with Adjust stock is a stock adjustment, not a missing bill', () => {
  const trail = stockTrail([move('purchase', 4, { documentType: 'adjustment' })], docs);
  assert.deepEqual([trail.steps[0].origin, trail.steps[0].missing, trail.unitsIn.adjusted, trail.unitsIn.missingLink], ['internal', [], 4, 0]);
  assert.match(stockTrailSummary(trail), /4 by a stock adjustment \(no bill\)/);
});

test('#260 review: a bill that names its purchase order (metadata.poId) shows the order even when the order does not name the bill', () => {
  const trail = stockTrail([move('purchase', 2, { documentType: 'bill', documentId: 'B-3' })], {
    ...docs, bills: [...docs.bills, { id: 'B-3', number: 'B-3', vendorId: 'acme', metadata: { poId: 'po8' } }],
    purchaseOrders: [...docs.purchaseOrders, { id: 'po8', poNumber: 'PO-8', vendorId: 'acme' }],
  });
  assert.equal(trail.steps[0].purchaseOrder?.label, 'Purchase order PO-8');
});

test('#260 review: an undone sale coming back in counts as recorded and the summary says so truthfully', () => {
  const trail = stockTrail([move('sale-reversal', 3, { documentType: 'invoice', documentId: 'INV-1' })], docs);
  assert.deepEqual([trail.steps[0].origin, trail.unitsIn.known], ['known', 3]);
  assert.match(stockTrailSummary(trail), /^3 came in on a document with its vendor or customer/);
});

test('#260 review: a long history is worked out from indexed lists (5,000 moves against 10,000 invoices)', () => {
  const invoices = Array.from({ length: 10_000 }, (_, i) => ({ id: `inv${i}`, number: String(i), customerId: 'dune' }));
  const many = Array.from({ length: 5_000 }, (_, i) => ({ ...move('sale', -1, { documentType: 'invoice', documentId: `inv${i * 2}` }) }));
  const started = Date.now();
  const trail = stockTrail(many, { ...docs, invoices });
  assert.equal(trail.unitsOut.known, 5_000);
  assert.ok(Date.now() - started < 1_000, 'well under a second');
});
