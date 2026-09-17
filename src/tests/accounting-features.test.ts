import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { applyCreditNoteToInvoice, applyVendorCreditToBill } from '../lib/creditNoteEngine';
import { calculateStraightLineDepreciation, generateDepreciationLedgerEntry } from '../lib/depreciationEngine';
import { calculateDueDate, calculateLateFee } from '../lib/paymentTerms';
import { detectDuplicateContacts } from '../lib/contactUtils';
import { convertEstimateToInvoice } from '../lib/estimateConverter';
import { CreditNote, Invoice, VendorCredit, Bill, FixedAsset, Estimate } from '../types';

describe('Accounting Features & Engines Suite (Items 118 - 130)', () => {

  describe('1. Credit Notes & Vendor Credits Application (Item 118 & 119)', () => {
    test('applyCreditNoteToInvoice applies partial credit and updates status and AR line', () => {
      const creditNote: CreditNote = {
        id: 'cn_100',
        workspaceId: 'ws_test',
        customerId: 'cust_1',
        totalAmountCents: 10000,
        remainingAmountCents: 10000,
        status: 'issued'
      };

      const invoice: Invoice = {
        id: 'inv_200',
        workspaceId: 'ws_test',
        invoiceNumber: 'INV-200',
        customerId: 'cust_1',
        date: '2026-09-01',
        dueDate: '2026-10-01',
        totalAmountCents: 25000,
        paidAmountCents: 0,
        status: 'sent'
      };

      const res = applyCreditNoteToInvoice(creditNote, invoice, 10000);

      assert.equal(res.updatedCreditNote.remainingAmountCents, 0);
      assert.equal(res.updatedCreditNote.status, 'applied');
      assert.equal(res.updatedInvoice.paidAmountCents, 10000);
      assert.equal(res.updatedInvoice.status, 'sent');
      assert.equal(res.ledgerTransaction.totalAmountCents, 10000);
      assert.equal(res.ledgerTransaction.lines?.length, 2);
    });

    test('applyVendorCreditToBill applies vendor credit to bill', () => {
      const vendorCredit: VendorCredit = {
        id: 'vc_300',
        workspaceId: 'ws_test',
        vendorId: 'vend_1',
        totalAmountCents: 5000,
        remainingAmountCents: 5000,
        status: 'issued'
      };

      const bill: Bill = {
        id: 'bill_400',
        workspaceId: 'ws_test',
        billNumber: 'BILL-400',
        vendorId: 'vend_1',
        date: '2026-09-01',
        dueDate: '2026-10-01',
        totalAmountCents: 5000,
        paidAmountCents: 0,
        status: 'received'
      };

      const res = applyVendorCreditToBill(vendorCredit, bill, 5000);

      assert.equal(res.updatedVendorCredit.remainingAmountCents, 0);
      assert.equal(res.updatedBill.paidAmountCents, 5000);
      assert.equal(res.updatedBill.status, 'paid');
    });
  });

  describe('2. Fixed Asset Register & Depreciation (Item 121)', () => {
    test('calculateStraightLineDepreciation builds exact monthly schedule and salvage value bound', () => {
      const asset: FixedAsset = {
        id: 'asset_laptop',
        workspaceId: 'ws_test',
        name: 'MacBook Pro M3',
        costCents: 240000, // $2,400
        salvageValueCents: 0,
        usefulLifeYears: 2, // 24 months ($100/mo)
        purchaseDate: '2026-01-01',
        depreciationMethod: 'straight_line'
      };

      const schedule = calculateStraightLineDepreciation(asset, '2026-01-01');

      assert.equal(schedule.length, 24);
      assert.equal(schedule[0].depreciationAmountCents, 10000);
      assert.equal(schedule[23].accumulatedDepreciationCents, 240000);
      assert.equal(schedule[23].bookValueCents, 0);

      const entry = generateDepreciationLedgerEntry(asset, schedule[0]);
      assert.equal(entry.totalAmountCents, 10000);
      assert.equal(entry.lines?.[0].amountCents, 10000); // Expense DR
      assert.equal(entry.lines?.[1].amountCents, -10000); // Accumulated Depreciation CR
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
        workspaceId: 'ws_test',
        estimateNumber: 'EST-001',
        customerId: 'cust_9',
        customerName: 'Wayne Enterprises',
        totalAmountCents: 150000,
        status: 'accepted',
        lines: [
          { description: 'Security Consulting', quantity: 1, unitPriceCents: 150000, amountCents: 150000 }
        ]
      };

      const invoice = convertEstimateToInvoice(estimate);

      assert.equal(invoice.status, 'draft');
      assert.equal(invoice.totalAmountCents, 150000);
      assert.equal(invoice.lines?.length, 1);
    });
  });
});
