import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyInventoryItem, findInventoryItem, lineAmountCents, setLineDescription } from '../lib/invoiceLines';
import type { InvoiceLineDraft } from '../lib/invoiceLines';

const widget = { id: 'item-1', name: 'Widget', sku: 'W-1', unitPriceCents: 1250, unitCostCents: 400 };
const gadget = { id: 'item-2', name: 'Gadget', sku: '', unitPriceCents: 999, unitCostCents: 300 };
const line = (over: Partial<InvoiceLineDraft> = {}): InvoiceLineDraft => ({
  id: 'l1', description: '', quantity: 3, rateCents: 0, amountCents: 0, accountId: 'acc-sales', ...over,
});

describe('invoice lines', () => {
  test('picking an item links it and fills name, price, cost and amount', () => {
    const filled = applyInventoryItem(line(), widget);
    assert.equal(filled.itemId, 'item-1');
    assert.equal(filled.description, 'Widget');
    assert.equal(filled.rateCents, 1250);
    assert.equal(filled.unitCostCents, 400);
    assert.equal(filled.amountCents, 3750);
    assert.equal(filled.accountId, 'acc-sales');
  });

  test('typing the SKU links the item too', () => {
    assert.equal(setLineDescription(line(), 'W-1', [widget, gadget]).itemId, 'item-1');
  });

  test('free text is an unlinked line with no cost, and clears a stale link', () => {
    const linked = applyInventoryItem(line(), widget);
    const edited = setLineDescription(linked, 'Consulting hours', [widget, gadget]);
    assert.equal(edited.itemId, undefined);
    assert.equal(edited.unitCostCents, undefined);
    assert.equal(edited.description, 'Consulting hours');
    assert.equal(edited.rateCents, 1250);
  });

  test('an empty SKU never matches empty text', () => {
    assert.equal(findInventoryItem([gadget], ''), undefined);
    assert.equal(findInventoryItem([gadget], '  '), undefined);
  });

  test('amounts round to whole cents and ignore bad quantities', () => {
    assert.equal(lineAmountCents(3, 1250), 3750);
    assert.equal(lineAmountCents(1.5, 999), 1499);
    assert.equal(lineAmountCents(Number.NaN, 999), 0);
  });
});
