import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  validateReceiptPayload, 
  mapReceiptToCoordinates, 
  buildBalancedReceiptTransaction,
  isReceiptAggregateRow,
  ParsedReceiptData
} from '../lib/receiptIngestion';
import { ChartAccount } from '../types';
import { MatchingEngine } from '../lib/MatchingEngine';

describe('Receipt Ingestion & Coordinate Labeling Pipeline', () => {
  const mockAccounts: ChartAccount[] = [
    {
      id: 'acc-cash',
      workspaceId: 'ws-1',
      name: 'Checking Operating Cash',
      accountNumber: '1000',
      type: 'asset',
      category: 'Cash',
      balance: 100000,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-groceries',
      workspaceId: 'ws-1',
      name: 'Groceries',
      accountNumber: '5100',
      type: 'expense',
      category: 'Operating Expense',
      balance: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-dairy',
      workspaceId: 'ws-1',
      name: 'Dairy',
      accountNumber: '5110',
      type: 'expense',
      category: 'Groceries',
      balance: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-bakery',
      workspaceId: 'ws-1',
      name: 'Bakery',
      accountNumber: '5120',
      type: 'expense',
      category: 'Groceries',
      balance: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-produce',
      workspaceId: 'ws-1',
      name: 'Produce',
      accountNumber: '5130',
      type: 'expense',
      category: 'Groceries',
      balance: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-tax',
      workspaceId: 'ws-1',
      name: 'Sales Tax Expense',
      accountNumber: '5800',
      type: 'expense',
      category: 'Taxes',
      balance: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-review',
      workspaceId: 'ws-1',
      name: 'Manual Review',
      accountNumber: '9999',
      type: 'expense',
      category: 'Suspense',
      balance: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    }
  ];

  it('correctly processes a receipt with 3 items + tax satisfying all financial and dimensional invariants', () => {
    // 3 grocery items: $5.49 + $6.99 + $6.00 = $18.48. Tax = $1.52. Total Paid = $20.00
    const receiptData: ParsedReceiptData = {
      vendorName: 'ShopRite Supermarket',
      date: '2026-09-08',
      totalAmountCents: 2000,
      taxAmountCents: 152,
      tipAmountCents: 0,
      categorySuggestion: 'Groceries',
      lines: [
        {
          description: 'Organic Whole Milk 1 Gallon',
          amountCents: 549,
          category: 'Groceries/Dairy/Milk',
          quantity: 1,
          unitPriceCents: 549
        },
        {
          description: 'Artisanal Sourdough Bread',
          amountCents: 699,
          category: 'Groceries/Bakery',
          quantity: 1,
          unitPriceCents: 699
        },
        {
          description: 'Fresh Honeycrisp Apples 3lb',
          amountCents: 600,
          category: 'Groceries/Produce',
          quantity: 1,
          unitPriceCents: 600
        }
      ]
    };

    const engine = new MatchingEngine([], {}, 'user-1', 0.8, []);
    const transaction = buildBalancedReceiptTransaction(receiptData, mockAccounts, engine, { world: 'entity-main' });

    // (1) sum(debit lines) === totalAmountCents including tax line
    const debitLines = transaction.lines.filter(l => l.amountCents > 0);
    const sumDebits = debitLines.reduce((acc, l) => acc + l.amountCents, 0);
    assert.strictEqual(sumDebits, 2000, 'Sum of debit lines must equal totalAmountCents (2000 cents)');
    assert.strictEqual(transaction.totalAmountCents, 2000, 'Stored totalAmountCents must match header');

    // Tax line verification
    const taxLine = debitLines.find(l => l.description === 'Sales Tax');
    assert.ok(taxLine, 'Tax line must exist as a distinct line item');
    assert.strictEqual(taxLine.amountCents, 152, 'Tax line amount must equal taxAmountCents (152 cents)');
    assert.strictEqual(taxLine.accountId, 'acc-tax', 'Tax line must resolve to the sales tax account');

    // (2) Cash/card credit line equals the amount actually paid (-$20.00)
    const creditLines = transaction.lines.filter(l => l.amountCents < 0);
    assert.strictEqual(creditLines.length, 1, 'Exactly one settlement credit line should exist');
    assert.strictEqual(creditLines[0].amountCents, -2000, 'Credit line must match amount actually paid (-$20.00)');
    assert.strictEqual(creditLines[0].accountId, 'acc-cash', 'Credit line must resolve to the cash/asset account');

    // Double-entry zero balance check
    const totalBalance = transaction.lines.reduce((acc, l) => acc + l.amountCents, 0);
    assert.strictEqual(totalBalance, 0, 'Transaction lines must perfectly balance to 0');

    // (4) Every item line has non-empty dimensions.category and dimensions.location
    const itemLines = debitLines.filter(l => l !== taxLine);
    assert.strictEqual(itemLines.length, 3, 'Must have 3 itemized lines');

    for (const line of itemLines) {
      assert.ok(line.dimensions, `Line "${line.description}" must have dimensions`);
      assert.ok(line.dimensions.category, `Line "${line.description}" must have dimensions.category`);
      assert.strictEqual(
        line.dimensions.location, 
        'ShopRite Supermarket', 
        `Line "${line.description}" dimensions.location must equal vendor name`
      );
      assert.strictEqual(
        line.dimensions.world, 
        'entity-main', 
        `Line "${line.description}" dimensions.world must carry workspace context`
      );
    }

    assert.strictEqual(itemLines[0].dimensions?.category, 'Groceries/Dairy/Milk');
    assert.strictEqual(itemLines[1].dimensions?.category, 'Groceries/Bakery');
    assert.strictEqual(itemLines[2].dimensions?.category, 'Groceries/Produce');

    // Synchronized account mapping verification
    assert.strictEqual(itemLines[0].accountId, 'acc-dairy');
    assert.strictEqual(itemLines[1].accountId, 'acc-bakery');
    assert.strictEqual(itemLines[2].accountId, 'acc-produce');
  });

  it('(3) rejects payloads containing SUBTOTAL/TAX/TOTAL rows instead of silently absorbing them', () => {
    // Detect summary rows helper
    assert.strictEqual(isReceiptAggregateRow('SUBTOTAL'), true);
    assert.strictEqual(isReceiptAggregateRow('Sub Total $18.48'), true);
    assert.strictEqual(isReceiptAggregateRow('TAX: 1.52'), true);
    assert.strictEqual(isReceiptAggregateRow('TOTAL $20.00'), true);
    assert.strictEqual(isReceiptAggregateRow('Balance Due'), true);
    assert.strictEqual(isReceiptAggregateRow('Organic Whole Milk 1 Gallon'), false);

    // Payload containing SUBTOTAL and TOTAL inside lines
    const corruptedPayload: ParsedReceiptData = {
      vendorName: 'Corrupted Market',
      totalAmountCents: 2000,
      taxAmountCents: 152,
      lines: [
        { description: 'Milk', amountCents: 549 },
        { description: 'SUBTOTAL', amountCents: 549 },
        { description: 'TAX', amountCents: 152 },
        { description: 'TOTAL', amountCents: 701 }
      ]
    };

    const validation = validateReceiptPayload(corruptedPayload);
    assert.strictEqual(validation.valid, false, 'Payload with summary rows must fail validation');
    assert.ok(
      validation.error?.includes('summary row "SUBTOTAL"'),
      `Error must specifically flag summary row: ${validation.error}`
    );

    assert.throws(() => {
      buildBalancedReceiptTransaction(corruptedPayload, mockAccounts);
    }, /summary row/);
  });

  it('rejects mathematical mismatches where sum(lines) + tax !== totalAmountCents', () => {
    const mismatchedPayload: ParsedReceiptData = {
      vendorName: 'ShopRite Supermarket',
      totalAmountCents: 2000, // Header claims $20.00
      taxAmountCents: 152,
      lines: [
        { description: 'Milk', amountCents: 500 },
        { description: 'Bread', amountCents: 500 }
        // 500 + 500 + 152 = 1152 !== 2000
      ]
    };

    const validation = validateReceiptPayload(mismatchedPayload);
    assert.strictEqual(validation.valid, false, 'Payload with arithmetic mismatch must fail');
    assert.ok(
      validation.error?.includes('Receipt reconciliation mismatch'),
      `Error must describe reconciliation mismatch: ${validation.error}`
    );
  });

  it('falls through to review bucket with synchronized accountId and accountName when unmapped', () => {
    const unmappedPayload: ParsedReceiptData = {
      vendorName: 'Unknown Boutique',
      totalAmountCents: 1500,
      taxAmountCents: 0,
      lines: [
        { description: 'Mysterious Antiquated Gadget', amountCents: 1500, category: 'Unobtanium/Relic' }
      ]
    };

    const transaction = buildBalancedReceiptTransaction(unmappedPayload, mockAccounts);
    const itemLine = transaction.lines[0];

    // Must resolve to fallback review bucket
    assert.strictEqual(itemLine.accountId, 'acc-review');
    assert.strictEqual(itemLine.accountName, 'Manual Review');
    assert.strictEqual(itemLine.dimensions?.category, 'Unobtanium/Relic');
    assert.strictEqual(itemLine.dimensions?.location, 'Unknown Boutique');
  });
});
