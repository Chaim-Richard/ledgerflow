import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateReceiptPayload, buildBalancedReceiptTransaction, isReceiptAggregateRow, ParsedReceiptData } from '../lib/receiptIngestion';
import { ChartAccount } from '../types';
import { MatchingEngine } from '../lib/MatchingEngine';

describe('Receipt Ingestion & Coordinate Labeling Pipeline', () => {
  const mockAccounts: ChartAccount[] = [
    {
      id: 'acc-cash',
      uid: 'user-1',
      workspaceId: 'ws-1',
      name: 'Checking Operating Cash',
      code: '1000',
      type: 'asset',
      category: 'Cash',
      balanceCents: 100000
    },
    {
      id: 'acc-groceries',
      uid: 'user-1',
      workspaceId: 'ws-1',
      name: 'Groceries',
      code: '5100',
      type: 'expense',
      category: 'Operations',
      balanceCents: 0
    },
    {
      id: 'acc-dairy',
      uid: 'user-1',
      workspaceId: 'ws-1',
      name: 'Dairy',
      code: '5110',
      type: 'expense',
      category: 'Food',
      balanceCents: 0
    },
    {
      id: 'acc-bakery',
      uid: 'user-1',
      workspaceId: 'ws-1',
      name: 'Bakery',
      code: '5120',
      type: 'expense',
      category: 'Food',
      balanceCents: 0
    },
    {
      id: 'acc-produce',
      uid: 'user-1',
      workspaceId: 'ws-1',
      name: 'Produce',
      code: '5130',
      type: 'expense',
      category: 'Food',
      balanceCents: 0
    },
    {
      id: 'acc-tax',
      uid: 'user-1',
      workspaceId: 'ws-1',
      name: 'Sales Tax Expense',
      code: '5800',
      type: 'expense',
      category: 'Tax',
      balanceCents: 0
    },
    {
      id: 'acc-review',
      uid: 'user-1',
      workspaceId: 'ws-1',
      name: 'Manual Review',
      code: '9999',
      type: 'expense',
      category: 'Overhead',
      balanceCents: 0
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

  it('rejects invalid/negative amounts or non-finite numbers', () => {
    const negativeTotal: ParsedReceiptData = {
      vendorName: 'Bad Vendor',
      totalAmountCents: -500,
      lines: [{ description: 'Item 1', amountCents: -500 }]
    };
    const res1 = validateReceiptPayload(negativeTotal);
    assert.strictEqual(res1.valid, false);
    assert.ok(res1.error?.includes('Invalid receipt total amount'));

    const negativeTax: ParsedReceiptData = {
      vendorName: 'Bad Vendor',
      totalAmountCents: 500,
      taxAmountCents: -50,
      lines: [{ description: 'Item 1', amountCents: 550 }]
    };
    const res2 = validateReceiptPayload(negativeTax);
    assert.strictEqual(res2.valid, false);
    assert.ok(res2.error?.includes('Invalid receipt tax amount'));

    const negativeLine: ParsedReceiptData = {
      vendorName: 'Bad Vendor',
      totalAmountCents: 500,
      lines: [{ description: 'Item 1', amountCents: -500 }]
    };
    const res3 = validateReceiptPayload(negativeLine);
    assert.strictEqual(res3.valid, false);
    assert.ok(res3.error?.includes('invalid amountCents'));
  });

  it('enforces per-item semantic arithmetic between quantity, unitPriceCents, and amountCents', () => {
    // Correct item math: 3 * 400 = 1200 + tax 100 = 1300
    const validItemMath: ParsedReceiptData = {
      vendorName: 'Office Depot',
      totalAmountCents: 1300,
      taxAmountCents: 100,
      lines: [
        {
          description: 'Gel Pens 12-pack',
          amountCents: 1200,
          quantity: 3,
          unitPriceCents: 400,
          category: 'Office/Supplies/Pens'
        }
      ]
    };
    const validRes = validateReceiptPayload(validItemMath);
    assert.strictEqual(validRes.valid, true);

    // Contradictory item math: quantity 3 * unit price $4.00 = $12.00, but amountCents claims $20.00
    const corruptedItemMath: ParsedReceiptData = {
      vendorName: 'Office Depot',
      totalAmountCents: 2100,
      taxAmountCents: 100,
      lines: [
        {
          description: 'Gel Pens 12-pack',
          amountCents: 2000, // Contradicts 3 * 400 = 1200
          quantity: 3,
          unitPriceCents: 400,
          category: 'Office/Supplies/Pens'
        }
      ]
    };
    const invalidRes = validateReceiptPayload(corruptedItemMath);
    assert.strictEqual(invalidRes.valid, false);
    assert.ok(
      invalidRes.error?.includes('Receipt item arithmetic mismatch on "Gel Pens 12-pack"'),
      `Error should specifically report item arithmetic mismatch: ${invalidRes.error}`
    );
  });

  it('correctly accepts and balances receipts with coupon discounts, service charges, and rounding adjustments', () => {
    // 1. Coupon discount: items $18.48 - $3.00 coupon + $1.30 tax = $16.78
    const couponReceipt: ParsedReceiptData = {
      vendorName: 'Supermarket Store',
      totalAmountCents: 1678,
      taxAmountCents: 130,
      discountAmountCents: 300,
      lines: [
        { description: 'Grocery Item 1', amountCents: 1000 },
        { description: 'Grocery Item 2', amountCents: 848 }
      ]
    };

    const res1 = validateReceiptPayload(couponReceipt);
    assert.strictEqual(res1.valid, true, `Coupon receipt should validate: ${res1.error}`);

    const txn1 = buildBalancedReceiptTransaction(couponReceipt, mockAccounts);
    const netBalance1 = txn1.lines.reduce((sum, l) => sum + l.amountCents, 0);
    assert.strictEqual(netBalance1, 0, 'Coupon receipt transaction lines must balance to zero');
    const discountLine = txn1.lines.find(l => l.amountCents < 0 && l.description?.includes('Discount'));
    assert.ok(discountLine, 'Discount contra line must be posted');
    assert.strictEqual(discountLine?.amountCents, -300);

    // 2. Restaurant service charge: items $40.00 + $4.00 fee + $3.52 tax = $47.52
    const serviceChargeReceipt: ParsedReceiptData = {
      vendorName: 'Bistro Dining',
      totalAmountCents: 4752,
      taxAmountCents: 352,
      serviceChargeAmountCents: 400,
      lines: [
        { description: 'Entree Meal', amountCents: 4000 }
      ]
    };

    const res2 = validateReceiptPayload(serviceChargeReceipt);
    assert.strictEqual(res2.valid, true, `Service charge receipt should validate: ${res2.error}`);

    const txn2 = buildBalancedReceiptTransaction(serviceChargeReceipt, mockAccounts);
    const netBalance2 = txn2.lines.reduce((sum, l) => sum + l.amountCents, 0);
    assert.strictEqual(netBalance2, 0, 'Service charge transaction lines must balance to zero');
    const feeLine = txn2.lines.find(l => l.description?.includes('Service Charge'));
    assert.ok(feeLine, 'Service charge line must be posted');
    assert.strictEqual(feeLine?.amountCents, 400);

    // 3. Cash rounding adjustment: items $10.00 + $0.80 tax + $0.02 rounding = $10.82
    const roundingReceipt: ParsedReceiptData = {
      vendorName: 'Corner Store',
      totalAmountCents: 1082,
      taxAmountCents: 80,
      roundingAdjustmentCents: 2,
      lines: [
        { description: 'Coffee Beans', amountCents: 1000 }
      ]
    };

    const res3 = validateReceiptPayload(roundingReceipt);
    assert.strictEqual(res3.valid, true, `Rounding receipt should validate: ${res3.error}`);

    const txn3 = buildBalancedReceiptTransaction(roundingReceipt, mockAccounts);
    const netBalance3 = txn3.lines.reduce((sum, l) => sum + l.amountCents, 0);
    assert.strictEqual(netBalance3, 0, 'Rounding transaction lines must balance to zero');
    const roundLine = txn3.lines.find(l => l.description?.includes('Rounding'));
    assert.ok(roundLine, 'Rounding line must be posted');
    assert.strictEqual(roundLine?.amountCents, 2);
  });

  it('rejects fractional cent payloads failing Number.isInteger', () => {
    const fractionalReceipt: any = {
      vendorName: 'Hardware Store',
      totalAmountCents: 1000.5,
      taxAmountCents: 80,
      lines: [
        { description: 'Nails', amountCents: 920.5 }
      ]
    };

    const res = validateReceiptPayload(fractionalReceipt);
    assert.strictEqual(res.valid, false, 'Fractional cent payloads must be rejected by validator');
    assert.ok(res.error?.includes('Must be an integer number of cents'), `Error should mention integer cents requirement: ${res.error}`);
  });

  it('correctly calculates unitemized fallback expense amount with discounts and service charges', () => {
    // Unitemized receipt: total $42.30, tax $1.30, service charge $4.00, discount $3.00
    // Expected fallback item expense: $42.30 - $1.30 - $4.00 + $3.00 = $40.00
    const unitemizedReceipt: ParsedReceiptData = {
      vendorName: 'Wholesale Supplier',
      totalAmountCents: 4230,
      taxAmountCents: 130,
      serviceChargeAmountCents: 400,
      discountAmountCents: 300,
      categorySuggestion: 'Office/Supplies',
      lines: []
    };

    const res = validateReceiptPayload(unitemizedReceipt);
    assert.strictEqual(res.valid, true, `Unitemized fallback receipt should validate: ${res.error}`);

    const txn = buildBalancedReceiptTransaction(unitemizedReceipt, mockAccounts);
    const netBalance = txn.lines.reduce((sum, l) => sum + l.amountCents, 0);
    assert.strictEqual(netBalance, 0, 'Unitemized fallback transaction lines must balance to zero');

    const itemLine = txn.lines.find(l => l.description === 'Wholesale Supplier');
    assert.ok(itemLine, 'Fallback item line must be generated');
    assert.strictEqual(itemLine?.amountCents, 4000, 'Derived pre-tax item expense must equal 4000 cents ($40.00)');
  });
});
