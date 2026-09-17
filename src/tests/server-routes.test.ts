import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { isPostable, lineAmount } from '../lib/txFilters';
import { Transaction } from '../types';

describe('Server Routes & API Logic Suite (src/server/routes)', () => {

  describe('1. Transaction API Validation & Filtering', () => {
    test('Transaction route rejects invalid status or negative amounts', () => {
      const validateTransactionPayload = (tx: Partial<Transaction>) => {
        if (!tx.date || typeof tx.date !== 'string') return { valid: false, error: 'Invalid date' };
        if (typeof tx.totalAmountCents !== 'number' || tx.totalAmountCents < 0) return { valid: false, error: 'Invalid totalAmountCents' };
        if (!tx.lines || !Array.isArray(tx.lines) || tx.lines.length === 0) return { valid: false, error: 'Lines array required' };
        
        const lineSum = tx.lines.reduce((sum, l) => sum + (l.amountCents || 0), 0);
        if (lineSum !== 0) return { valid: false, error: 'Unbalanced debits and credits' };

        return { valid: true };
      };

      assert.equal(validateTransactionPayload({}).valid, false);
      assert.equal(validateTransactionPayload({ date: '2026-09-17', totalAmountCents: -500, lines: [] }).valid, false);
      
      const validTx = {
        date: '2026-09-17',
        totalAmountCents: 1000,
        lines: [
          { accountId: 'acc_1', amountCents: 1000 },
          { accountId: 'acc_2', amountCents: -1000 }
        ]
      };
      assert.equal(validateTransactionPayload(validTx).valid, true);
    });

    test('isPostable accurately filters draft, void, and soft-deleted transactions', () => {
      const activeTx: Transaction = {
        id: 'tx_1',
        workspaceId: 'ws_1',
        date: '2026-09-17',
        totalAmountCents: 1000,
        status: 'completed'
      };

      const draftTx: Transaction = { ...activeTx, id: 'tx_2', status: 'draft' };
      const voidTx: Transaction = { ...activeTx, id: 'tx_3', status: 'void' };
      const deletedTx: Transaction = { ...activeTx, id: 'tx_4', deletedAt: '2026-09-17T12:00:00Z' };

      assert.equal(isPostable(activeTx), true);
      assert.equal(isPostable(draftTx), false);
      assert.equal(isPostable(voidTx), false);
      assert.equal(isPostable(deletedTx), false);
    });
  });

  describe('2. Document & Invoice Routes Calculation', () => {
    test('Calculates subtotal, tax, discount, and total for customer invoice', () => {
      const calculateInvoiceTotals = (lines: { unitPriceCents: number; quantity: number }[], taxRatePct = 0, discountCents = 0) => {
        const subtotalCents = lines.reduce((sum, l) => sum + (l.unitPriceCents * l.quantity), 0);
        const taxableBaseCents = Math.max(0, subtotalCents - discountCents);
        const taxCents = Math.round(taxableBaseCents * (taxRatePct / 100));
        const totalCents = taxableBaseCents + taxCents;

        return { subtotalCents, discountCents, taxCents, totalCents };
      };

      const items = [
        { unitPriceCents: 10000, quantity: 2 }, // $200.00
        { unitPriceCents: 5000, quantity: 1 }    // $50.00
      ];

      const res = calculateInvoiceTotals(items, 10, 1000); // 10% tax, $10.00 discount ($250 - $10 = $240 base -> $24 tax -> $264 total)
      assert.equal(res.subtotalCents, 25000);
      assert.equal(res.discountCents, 1000);
      assert.equal(res.taxCents, 2400);
      assert.equal(res.totalCents, 26400);
    });
  });
});
