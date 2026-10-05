import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { calculateStraightLineDepreciation, depreciationThrough } from '../lib/depreciationEngine';
import { calculateDueDate, calculateLateFee } from '../lib/paymentTerms';
import { detectDuplicateContacts } from '../lib/contactUtils';
import { convertEstimateToInvoice } from '../lib/estimateConverter';
import { FixedAsset, Estimate } from '../types';

describe('Accounting Features & Engines Suite (Items 118 - 130)', () => {

  // Credit application and refunds: src/tests/credits.test.ts (server, real database)

  describe('2. Fixed Asset Register & Depreciation (Item 121)', () => {
    test('calculateStraightLineDepreciation builds exact monthly schedule and salvage value bound', () => {
      const asset: FixedAsset = {
        id: 'asset_laptop',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        name: 'MacBook Pro M3',
        purchasePriceCents: 240000, // $2,400
        salvageValueCents: 0,
        usefulLifeYears: 2, // 24 months ($100/mo)
        purchaseDate: '2026-01-01',
        depreciationMethod: 'straight-line',
        accumulatedDepreciationCents: 0,
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z'
      };

      const schedule = calculateStraightLineDepreciation(asset);

      assert.equal(schedule.length, 24);
      assert.equal(schedule[0].depreciationAmountCents, 10000);
      assert.equal(schedule[23].accumulatedDepreciationCents, 240000);
      assert.equal(schedule[23].bookValueCents, 0);

      // The month-end run posts the difference to this target (depreciation starts the month after purchase)
      assert.equal(depreciationThrough(asset, '2026-01'), 0);
      assert.equal(depreciationThrough(asset, '2026-02'), 10000);
      assert.equal(depreciationThrough(asset, '2030-01'), 240000);
    });
  });

  describe('3. Payment Terms & Late Fees (Item 123 & 124)', () => {
    test('calculateDueDate calculates correct due date for Net 30 and Net 60', () => {
      const dueNet30 = calculateDueDate('2026-09-01', 'net_30');
      assert.equal(dueNet30, '2026-10-01');

      const dueNet15 = calculateDueDate('2026-09-01', 'net_15');
      assert.equal(dueNet15, '2026-09-16');
    });

    test('calculateLateFee assesses overdue interest and flat fee when past due', () => {
      const feeResult = calculateLateFee(100000, '2026-08-01', '2026-08-31', 18.0, 2500);

      assert.equal(feeResult.isOverdue, true);
      assert.equal(feeResult.daysOverdue, 30);
      assert.ok(feeResult.lateFeeCents > 2500);
    });
  });

  describe('4. Duplicate Contact Detection & Merge (Item 130)', () => {
    test('detectDuplicateContacts identifies matching emails and normalized names', () => {
      const contacts = [
        { id: 'c1', name: 'Acme Corporation', email: 'billing@acme.com' },
        { id: 'c2', name: 'ACME Corp.', email: 'billing@acme.com' },
        { id: 'c3', name: 'Globex Inc', email: 'sales@globex.com' }
      ];

      const duplicates = detectDuplicateContacts(contacts);

      assert.equal(duplicates.length, 1);
      assert.equal(duplicates[0].primaryContact.id, 'c1');
      assert.equal(duplicates[0].duplicates[0].id, 'c2');
    });
  });

  describe('5. Estimate to Invoice Conversion (Item 122)', () => {
    test('convertEstimateToInvoice creates valid draft invoice from estimate', () => {
      const estimate: Estimate = {
        id: 'est_10',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        number: 'EST-001',
        customerId: 'cust_9',
        customerName: 'Wayne Enterprises',
        amountCents: 150000,
        date: '2026-09-01',
        status: 'accepted',
        createdAt: '2026-09-01T00:00:00Z',
        lines: [
          { description: 'Security Consulting', quantity: 1, unitPriceCents: 150000, amountCents: 150000 }
        ]
      };

      const invoice = convertEstimateToInvoice(estimate);

      assert.equal(invoice.status, 'draft');
      assert.equal(invoice.amountCents, 150000);
      assert.equal(invoice.items?.length, 1);
    });
  });
});

test('terms for a customer: their own, else their latest invoice\'s, else none (I-23)', async () => {
  const { termsForCustomer, isFixedTerm } = await import('../lib/paymentTerms');
  const invoices = [
    { customerId: 'c1', date: '2026-01-01', paymentTerms: 'net_15' },
    { customerId: 'c1', date: '2026-02-01', paymentTerms: 'net_45' },
    { customerId: 'c1', date: '2026-03-01', paymentTerms: 'net_60', status: 'void' },
    { customerId: 'c2', date: '2026-04-01', paymentTerms: 'net_30' },
  ];
  assert.equal(termsForCustomer({ id: 'c1' }, invoices), 'net_45');
  assert.equal(termsForCustomer({ id: 'c1', paymentTerms: 'net_30' }, invoices), 'net_30');
  assert.equal(termsForCustomer({ id: 'c3' }, invoices), null);
  assert.equal(termsForCustomer(undefined, invoices), null);
  assert.equal(isFixedTerm('custom'), false);
  assert.equal(isFixedTerm('net_15'), true);
});

test('monthly statements: due on the first run of a month, once (Y-28)', async () => {
  const { statementMonthDue, normalizeReminderSettings } = await import('../lib/reminders');
  assert.equal(statementMonthDue('2026-11-01', '2026-10'), '2026-11');
  assert.equal(statementMonthDue('2026-11-02', null), '2026-11', 'a missed 1st is made up');
  assert.equal(statementMonthDue('2026-11-15', '2026-11'), null);
  assert.equal(normalizeReminderSettings({ monthlyStatements: true }).monthlyStatements, true);
  assert.equal(normalizeReminderSettings(null).monthlyStatements, false);
});
