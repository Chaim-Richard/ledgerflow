/**
 * A-50: reorder suggestions. Items below their reorder point, grouped by the last vendor they were
 * bought from (bills first, then purchase orders), whole packages, drafts that never post.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { reorderDraftOrders, reorderSuggestions } from '../lib/reorderSuggestions';

const item = (overrides: Record<string, unknown>) => ({
  id: 'it_x', uid: 'u', workspaceId: 'w', name: 'Item', sku: 'SKU', unitPriceCents: 500, unitCostCents: 300,
  quantityAtHand: 0, reorderPoint: 0, createdAt: '2026-01-01', ...overrides,
}) as never;

const items = [
  item({ id: 'paper', name: 'A4 paper', sku: 'P-1', quantityAtHand: 3, reorderPoint: 10, unitCostCents: 400, measurementUnit: 'ream' }),
  item({ id: 'toner', name: 'Toner', sku: 'T-1', quantityAtHand: 0, reorderPoint: 4, unitCostCents: 900, unitsPerPackage: 2 }),
  item({ id: 'pens', name: 'Pens', sku: 'PE-1', quantityAtHand: 50, reorderPoint: 20 }),
  item({ id: 'consult', name: 'Consulting', sku: 'C-1', itemType: 'service', quantityAtHand: 0, reorderPoint: 5 }),
  item({ id: 'theirs', name: 'Supplier stock', sku: 'S-1', quantityAtHand: 0, reorderPoint: 5, consignment: 'from-supplier' }),
  item({ id: 'mystery', name: 'Gasket', sku: 'G-1', quantityAtHand: 1, reorderPoint: 3, unitCostCents: 250 }),
];

const input = {
  items: items as never,
  vendors: [{ id: 'v_paper', name: 'Paper Co' }, { id: 'v_tech', name: 'Tech Ltd' }],
  bills: [
    { vendorId: 'v_paper', date: '2026-09-01', splits: [{ accountId: 'a', amountCents: 4200, itemId: 'paper', quantity: 10 }] },
    { vendorId: 'v_paper', date: '2026-09-20', splits: [{ accountId: 'a', amountCents: 4500, itemId: 'paper', quantity: 10 }] },
    { vendorId: 'v_tech', date: '2026-08-15', splits: [{ accountId: 'a', amountCents: 1800, itemId: 'toner', quantity: 2 }] },
  ],
  orders: [
    { vendorId: 'v_tech', issueDate: '2026-09-25', items: [{ id: 'l', description: 'Gasket', quantity: 2, unitPriceCents: 260, totalCents: 520, itemId: 'mystery' }] },
  ],
};

describe('A-50 reorder suggestions', () => {
  test('only stock items below their reorder point are suggested', () => {
    const lines = reorderSuggestions(input).flatMap(g => g.lines).map(l => l.itemId).sort();
    assert.deepEqual(lines, ['mystery', 'paper', 'toner']);
  });

  test('the suggested quantity brings the item back to its reorder point, in whole packages', () => {
    const groups = reorderSuggestions(input);
    const all = Object.fromEntries(groups.flatMap(g => g.lines).map(l => [l.itemId, l.suggestedQuantity]));
    assert.equal(all.paper, 7, 'reorder point 10 less 3 on hand');
    assert.equal(all.toner, 4, 'four short, already a multiple of two');
    assert.equal(all.mystery, 2);
  });

  test('grouped by the last vendor the item was bought from, with the vendor\'s own last unit cost', () => {
    const groups = reorderSuggestions(input);
    const paper = groups.find(g => g.vendorId === 'v_paper');
    assert.ok(paper);
    assert.equal(paper.vendorName, 'Paper Co');
    assert.equal(paper.lines[0].unitCostCents, 450, 'the most recent bill, not the item price');
    assert.equal(paper.lines[0].costSource, 'vendor-history');
    assert.equal(paper.totalCents, 450 * 7);
  });

  test('a purchase order line counts as history when the item was never billed', () => {
    const gasket = reorderSuggestions(input).flatMap(g => g.lines).find(l => l.itemId === 'mystery');
    assert.ok(gasket);
    const group = reorderSuggestions(input).find(g => g.lines.some(l => l.itemId === 'mystery'));
    assert.equal(group?.vendorId, 'v_tech');
    assert.equal(gasket.unitCostCents, 260);
  });

  test('an item with no purchase history is grouped apart, at the item cost, and is not turned into an order', () => {
    const solo = [item({ id: 'new', name: 'New thing', sku: 'N', quantityAtHand: 0, reorderPoint: 2, unitCostCents: 700 })];
    const groups = reorderSuggestions({ ...input, items: solo as never, bills: [], orders: [] });
    assert.equal(groups.length, 1);
    assert.equal(groups[0].vendorId, undefined);
    assert.equal(groups[0].vendorName, 'No preferred vendor yet');
    assert.equal(groups[0].lines[0].costSource, 'item');
    assert.deepEqual(reorderDraftOrders(groups, [], '2026-10-13'), []);
  });

  test('the latest bill wins regardless of the order the bills are listed in', () => {
    const reversed = { ...input, bills: [...input.bills].reverse() };
    assert.equal(reorderSuggestions(reversed).find(g => g.vendorId === 'v_paper')?.lines[0].unitCostCents, 450);
  });

  test('a service and a consignment item are never suggested', () => {
    const ids = reorderSuggestions(input).flatMap(g => g.lines).map(l => l.itemId);
    assert.ok(!ids.includes('consult'));
    assert.ok(!ids.includes('theirs'));
  });

  test('draft orders: one per vendor group, numbered on from the existing series, status draft, nothing posted', () => {
    const groups = reorderSuggestions(input);
    const drafts = reorderDraftOrders(groups, [{ poNumber: 'PO-2026-004' }], '2026-10-13', 'ws_1');
    assert.equal(drafts.length, 2);
    assert.deepEqual(drafts.map(d => d.poNumber), ['PO-2026-005', 'PO-2026-006']);
    assert.ok(drafts.every(d => d.status === 'draft' && d.workspaceId === 'ws_1' && d.issueDate === '2026-10-13'));
    const paper = drafts.find(d => d.vendorId === 'v_paper');
    assert.equal(paper?.totalAmountCents, 450 * 7);
    assert.equal(paper?.items[0].totalCents, 450 * 7);
  });
});
