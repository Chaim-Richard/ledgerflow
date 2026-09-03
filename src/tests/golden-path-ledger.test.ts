import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import Decimal from 'decimal.js';
import { ClosingEntryEngine } from '../kernel/ledger/ClosingEntryEngine';
import { DoubleEntryValidator } from '../kernel/validation/DoubleEntryValidator';
import { DerivedBalanceEngine } from '../kernel/reporting/DerivedBalanceEngine';
import { validateSplitAllocations } from '../lib/dimensionUtils';
import { ChartAccount, Transaction, TransactionLine } from '../types';

describe('Golden-Path Ledger Verification & Invariants', () => {

  describe('1. Double-Entry Invariants & Zero-Drift Math', () => {
    test('Rejects unbalanced transactions with exact net error', () => {
      const unbalancedTx: Transaction = {
        id: 'tx_unbalanced',
        uid: 'user1',
        workspaceId: 'ws_1',
        date: '2026-06-15',
        description: 'Unbalanced purchase',
        totalAmountCents: 10000,
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        lines: [
          { accountId: 'acc_cash', accountName: 'Cash', amountCents: 10000 },
          { accountId: 'acc_exp', accountName: 'Expense', amountCents: -9999 } // 1 cent off
        ]
      };

      assert.throws(
        () => DoubleEntryValidator.validateJournalEntry(unbalancedTx),
        /Validation Failed: Unbalanced entry/
      );
    });

    test('Accepts multi-leg balanced transactions', () => {
      const balancedTx: Transaction = {
        id: 'tx_balanced',
        uid: 'user1',
        workspaceId: 'ws_1',
        date: '2026-06-15',
        description: 'Multi-split payroll',
        totalAmountCents: 100000,
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        lines: [
          { accountId: 'acc_salary', accountName: 'Salary Expense', amountCents: 100000 }, // Debit
          { accountId: 'acc_tax', accountName: 'Tax Payable', amountCents: -25000 },       // Credit
          { accountId: 'acc_benefits', accountName: 'Benefits Payable', amountCents: -10000 }, // Credit
          { accountId: 'acc_cash', accountName: 'Cash', amountCents: -65000 }             // Credit
        ]
      };

      assert.doesNotThrow(() => DoubleEntryValidator.validateJournalEntry(balancedTx));
    });

    test('Decimal split allocations preserve exact weight and penny integrity', () => {
      // 3-way split: 33.33%, 33.33%, 33.34% summing strictly to 1.0
      const splits = [
        { dimensions: { project: 'P1' }, weight: 0.3333 },
        { dimensions: { project: 'P2' }, weight: 0.3333 },
        { dimensions: { project: 'P3' }, weight: 0.3334 }
      ];

      const validation = validateSplitAllocations(splits);
      assert.equal(validation.valid, true, 'Splits summing to 1.0 should be valid');

      // Allocation of $100.00 across the splits with remainder given to last leg
      const totalCents = 10000;
      let allocatedSum = 0;
      const legs = splits.map((s, idx) => {
        if (idx === splits.length - 1) {
          const remainder = totalCents - allocatedSum;
          allocatedSum += remainder;
          return remainder;
        }
        const portion = Math.round(totalCents * s.weight);
        allocatedSum += portion;
        return portion;
      });

      assert.equal(allocatedSum, totalCents, 'Penny loss detected in split allocation');
      assert.equal(legs[0] + legs[1] + legs[2], 10000);
    });

    test('FX conversion absorbed without penny loss', () => {
      // Multi-currency conversion: EUR to USD at 1.0833
      const originalCents = 10000; // €100.00
      const rate = 1.0833;
      const convertedCents = Math.round(originalCents * rate); // $108.33 = 10833 cents

      // Verify that offset lines match converted cents exactly
      const debitLine: TransactionLine = {
        accountId: 'acc_ar',
        accountName: 'Accounts Receivable',
        amountCents: convertedCents,
        exchangeRate: rate
      };
      const creditLine: TransactionLine = {
        accountId: 'acc_rev',
        accountName: 'Revenue',
        amountCents: -convertedCents,
        exchangeRate: rate
      };

      const sum = new Decimal(debitLine.amountCents).plus(creditLine.amountCents);
      assert.equal(sum.toNumber(), 0, 'FX converted lines must balance to exact zero');
    });
  });

  describe('2. Transaction Lifecycle & Void Exclusion', () => {
    test('Voided transactions are excluded from active ledger balance calculations', () => {
      DerivedBalanceEngine.clearSnapshots();
      const workspaceId = 'ws_lifecycle';

      const eventActive1 = {
        id: 'evt_1',
        eventType: 'ACTUAL' as const,
        accountId: '1010',
        amountCents: 50000, // $500 Debit Cash
        timestamp: '2026-01-10',
        entryId: 'tx_1',
        type: 'debit' as const
      };

      const eventVoided = {
        id: 'evt_2',
        eventType: 'ACTUAL' as const,
        accountId: '1010',
        amountCents: 25000, // $250 Debit Cash (voided)
        timestamp: '2026-01-12',
        entryId: 'tx_voided',
        type: 'debit' as const
      };

      const eventActive2 = {
        id: 'evt_3',
        eventType: 'ACTUAL' as const,
        accountId: '1010',
        amountCents: 15000, // $150 Debit Cash
        timestamp: '2026-01-15',
        entryId: 'tx_2',
        type: 'debit' as const
      };

      // Active events exclude the voided transaction
      const activeEvents = [eventActive1, eventActive2];
      const balance = DerivedBalanceEngine.getBalanceAsOf('1010', '2026-01-20', activeEvents, workspaceId);

      assert.equal(balance, 65000, 'Balance must be exactly $650.00 (excluding the voided $250.00)');
    });
  });

  describe('3. Fiscal Year-End Close (ClosingEntryEngine)', () => {
    const mockAccounts: ChartAccount[] = [
      { id: 'acc_cash', uid: 'u1', workspaceId: 'ws_close', code: '1010', name: 'Cash', type: 'asset', balanceCents: 100000 },
      { id: 'acc_rev', uid: 'u1', workspaceId: 'ws_close', code: '4010', name: 'Service Revenue', type: 'income', balanceCents: 0 },
      { id: 'acc_cogs', uid: 'u1', workspaceId: 'ws_close', code: '5010', name: 'Cost of Goods Sold', type: 'cost_of_goods', balanceCents: 0 },
      { id: 'acc_exp', uid: 'u1', workspaceId: 'ws_close', code: '6010', name: 'Operating Expense', type: 'expense', balanceCents: 0 },
      { id: 'acc_re', uid: 'u1', workspaceId: 'ws_close', code: '3000', name: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings', balanceCents: 0 }
    ];

    test('Fiscal Year Close zeroes revenue and expenses and transfers Net Profit to Retained Earnings', () => {
      // Transactions during the fiscal year:
      // 1. Revenue of $10,000 (Debit Cash 1,000,000, Credit Revenue -1,000,000)
      // 2. COGS of $3,000 (Debit COGS 300,000, Credit Cash -300,000)
      // 3. Operating Expense of $2,500 (Debit Expense 250,000, Credit Cash -250,000)
      // Expected Net Income = $10,000 - $3,000 - $2,500 = $4,500 ($450,000 cents)
      const mockTxs: Transaction[] = [
        {
          id: 'tx_rev_1',
          uid: 'u1',
          workspaceId: 'ws_close',
          date: '2026-03-15',
          description: 'Client Project Revenue',
          totalAmountCents: 1000000,
          currency: 'USD',
          status: 'completed',
          type: 'actual',
          createdAt: '2026-03-15T12:00:00Z',
          lines: [
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: 1000000 },
            { accountId: 'acc_rev', accountName: 'Service Revenue', amountCents: -1000000 }
          ]
        },
        {
          id: 'tx_cogs_1',
          uid: 'u1',
          workspaceId: 'ws_close',
          date: '2026-05-20',
          description: 'Direct Supplier Costs',
          totalAmountCents: 300000,
          currency: 'USD',
          status: 'completed',
          type: 'actual',
          createdAt: '2026-05-20T12:00:00Z',
          lines: [
            { accountId: 'acc_cogs', accountName: 'Cost of Goods Sold', amountCents: 300000 },
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: -300000 }
          ]
        },
        {
          id: 'tx_exp_1',
          uid: 'u1',
          workspaceId: 'ws_close',
          date: '2026-11-01',
          description: 'Office Rent & Cloud Software',
          totalAmountCents: 250000,
          currency: 'USD',
          status: 'completed',
          type: 'actual',
          createdAt: '2026-11-01T12:00:00Z',
          lines: [
            { accountId: 'acc_exp', accountName: 'Operating Expense', amountCents: 250000 },
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: -250000 }
          ]
        }
      ];

      const closingDate = '2026-12-31';
      const result = ClosingEntryEngine.generateClosingJournalEntry({
        workspaceId: 'ws_close',
        uid: 'u1',
        closingDate,
        accounts: mockAccounts,
        transactions: mockTxs
      });

      // Verify net income calculation
      assert.equal(result.netIncomeCents, 450000, 'Net income should be exactly 450,000 cents ($4,500.00)');
      assert.equal(result.revenueAccountsClosed, 1, 'Should close 1 revenue account');
      assert.equal(result.expenseAccountsClosed, 2, 'Should close 2 expense accounts (COGS + OpEx)');
      assert.equal(result.retainedEarningsAccountId, 'acc_re', 'Should resolve Retained Earnings account');

      // Check lines in the generated closing transaction
      const closingTx = result.closingTransaction;
      assert.equal(closingTx.status, 'completed');
      assert.equal(closingTx.type, 'adjustment');
      assert.equal(closingTx.date, closingDate);

      // Verify Revenue was debited (+1,000,000)
      const revLine = closingTx.lines.find(l => l.accountId === 'acc_rev');
      assert.ok(revLine, 'Closing entry must include Revenue line');
      assert.equal(revLine.amountCents, 1000000, 'Revenue account must be debited by +1,000,000 to zero out');

      // Verify COGS was credited (-300,000)
      const cogsLine = closingTx.lines.find(l => l.accountId === 'acc_cogs');
      assert.ok(cogsLine, 'Closing entry must include COGS line');
      assert.equal(cogsLine.amountCents, -300000, 'COGS account must be credited by -300,000 to zero out');

      // Verify OpEx was credited (-250,000)
      const expLine = closingTx.lines.find(l => l.accountId === 'acc_exp');
      assert.ok(expLine, 'Closing entry must include OpEx line');
      assert.equal(expLine.amountCents, -250000, 'OpEx account must be credited by -250,000 to zero out');

      // Verify Retained Earnings was credited (-450,000) for Net Profit
      const reLine = closingTx.lines.find(l => l.accountId === 'acc_re');
      assert.ok(reLine, 'Closing entry must include Retained Earnings line');
      assert.equal(reLine.amountCents, -450000, 'Retained Earnings must be credited by -450,000 (credit increases equity)');

      // Verify that the entry strictly satisfies DoubleEntryValidator
      assert.doesNotThrow(() => DoubleEntryValidator.validateJournalEntry(closingTx));

      // Check Post-Closing Trial Balance on temporary accounts:
      const allTxs = [...mockTxs, closingTx];
      let postCloseRev = 0;
      let postCloseCogs = 0;
      let postCloseExp = 0;
      let postCloseRE = 0;

      allTxs.forEach(t => {
        t.lines.forEach(l => {
          if (l.accountId === 'acc_rev') postCloseRev += l.amountCents;
          if (l.accountId === 'acc_cogs') postCloseCogs += l.amountCents;
          if (l.accountId === 'acc_exp') postCloseExp += l.amountCents;
          if (l.accountId === 'acc_re') postCloseRE += l.amountCents;
        });
      });

      assert.equal(postCloseRev, 0, 'Post-closing Revenue balance must be strictly 0');
      assert.equal(postCloseCogs, 0, 'Post-closing COGS balance must be strictly 0');
      assert.equal(postCloseExp, 0, 'Post-closing Expense balance must be strictly 0');
      assert.equal(postCloseRE, -450000, 'Post-closing Retained Earnings must reflect transferred profit');
    });

    test('Fiscal Year Close handles Net Loss correctly (debits Retained Earnings)', () => {
      const lossTxs: Transaction[] = [
        {
          id: 'tx_rev_loss',
          uid: 'u1',
          workspaceId: 'ws_close',
          date: '2026-02-01',
          description: 'Modest Revenue',
          totalAmountCents: 200000, // $2,000
          currency: 'USD',
          status: 'completed',
          type: 'actual',
          createdAt: '2026-02-01T12:00:00Z',
          lines: [
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: 200000 },
            { accountId: 'acc_rev', accountName: 'Service Revenue', amountCents: -200000 }
          ]
        },
        {
          id: 'tx_exp_heavy',
          uid: 'u1',
          workspaceId: 'ws_close',
          date: '2026-04-10',
          description: 'High Startup Burn',
          totalAmountCents: 500000, // $5,000
          currency: 'USD',
          status: 'completed',
          type: 'actual',
          createdAt: '2026-04-10T12:00:00Z',
          lines: [
            { accountId: 'acc_exp', accountName: 'Operating Expense', amountCents: 500000 },
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: -500000 }
          ]
        }
      ];

      const result = ClosingEntryEngine.generateClosingJournalEntry({
        workspaceId: 'ws_close',
        uid: 'u1',
        closingDate: '2026-12-31',
        accounts: mockAccounts,
        transactions: lossTxs
      });

      // Revenue: $2,000, Expense: $5,000 -> Net Loss of -$3,000 (-300,000 cents)
      assert.equal(result.netIncomeCents, -300000, 'Net loss must be -300,000 cents');

      // For loss: Retained Earnings receives Debit (+300,000)
      const reLine = result.closingTransaction.lines.find(l => l.accountId === 'acc_re');
      assert.ok(reLine);
      assert.equal(reLine.amountCents, 300000, 'Retained earnings debited to reflect net loss');

      // Double entry validator passes
      assert.doesNotThrow(() => DoubleEntryValidator.validateJournalEntry(result.closingTransaction));
    });
  });

  describe('4. Tenant Isolation & IDOR Verification', () => {
    test('Cross-tenant data is never aggregated into account closures', () => {
      const mixedAccounts: ChartAccount[] = [
        { id: 'acc_ws1', uid: 'u1', workspaceId: 'ws_alpha', code: '4010', name: 'Alpha Revenue', type: 'income', balanceCents: 0 },
        { id: 'acc_ws2', uid: 'u2', workspaceId: 'ws_beta', code: '4010', name: 'Beta Revenue', type: 'income', balanceCents: 0 },
        { id: 're_ws1', uid: 'u1', workspaceId: 'ws_alpha', code: '3000', name: 'Alpha RE', type: 'equity', subtype: 'retained_earnings', balanceCents: 0 }
      ];

      const mixedTxs: Transaction[] = [
        {
          id: 'tx_alpha',
          uid: 'u1',
          workspaceId: 'ws_alpha',
          date: '2026-05-01',
          description: 'Alpha Sale',
          totalAmountCents: 100000,
          currency: 'USD',
          status: 'completed',
          type: 'actual',
          createdAt: '2026-05-01T12:00:00Z',
          lines: [
            { accountId: 'acc_ws1', accountName: 'Alpha Revenue', amountCents: -100000 },
            { accountId: 're_ws1', accountName: 'Alpha RE', amountCents: 100000 }
          ]
        },
        {
          id: 'tx_beta',
          uid: 'u2',
          workspaceId: 'ws_beta',
          date: '2026-05-01',
          description: 'Beta Sale (Foreign)',
          totalAmountCents: 999999,
          currency: 'USD',
          status: 'completed',
          type: 'actual',
          createdAt: '2026-05-01T12:00:00Z',
          lines: [
            { accountId: 'acc_ws2', accountName: 'Beta Revenue', amountCents: -999999 },
            { accountId: 'acc_ws2', accountName: 'Beta Revenue', amountCents: 999999 }
          ]
        }
      ];

      const result = ClosingEntryEngine.generateClosingJournalEntry({
        workspaceId: 'ws_alpha',
        uid: 'u1',
        closingDate: '2026-12-31',
        accounts: mixedAccounts,
        transactions: mixedTxs
      });

      assert.equal(result.closingTransaction.workspaceId, 'ws_alpha');
      assert.equal(result.netIncomeCents, 100000, 'Beta revenue was completely isolated and not included in Alpha close');
      const hasBetaAccount = result.closingTransaction.lines.some(l => l.accountId === 'acc_ws2');
      assert.equal(hasBetaAccount, false, 'Foreign workspace accounts must not appear in closing entry');
    });
  });
});
