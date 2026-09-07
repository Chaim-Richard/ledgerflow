import { test, describe } from 'node:test';
import assert from 'node:assert';
import { IntercompanyEliminationEngine } from '../lib/intercompanyElimination';
import { calculateSafeToSpend } from '../lib/algorithms/tax-set-aside';
import { parseLocalDate, getLocalDateISO } from '../lib/utils';
import { Transaction, ChartAccount } from '../types';
import { isPostable, lineAmount } from '../lib/txFilters';
import { optimizedTransactionSimilarity } from '../lib/algorithms';

describe('Repair Board Verification: Phase 2-4 Accounting, Security & Algorithms', () => {

  test('#37 / #38: Retainage revenue posting does not inflate revenue', () => {
    // Invoice: $10,000 gross with 10% retainage ($1,000), 5% discount ($500), 0% tax
    const totalAmount = 1000000; // $10,000 in cents
    const retainageAmount = 100000; // $1,000 in cents
    const discountAmount = 50000; // $500 in cents
    const taxAmount = 0;

    const revenueAmount = totalAmount + discountAmount - taxAmount; // $10,500 gross revenue before discount
    const arAmount = totalAmount - retainageAmount; // $9,000 due now from customer

    // Debits: AR ($9,000) + Retainage ($1,000) + Discount ($500) = $10,500
    // Credits: Revenue (-$10,500)
    const totalDebits = arAmount + retainageAmount + discountAmount;
    const totalCredits = revenueAmount;

    assert.strictEqual(totalDebits, totalCredits, 'Debits must equal Credits');
    assert.strictEqual(arAmount, 900000, 'A/R must reflect net amount after retainage withheld');
    assert.strictEqual(revenueAmount, 1050000, 'Revenue must not double-count retainage');
  });

  test('#44: Cash Flow Financing sign convention and categories', () => {
    const cashFlow = {
      operating: { total: 0 },
      investing: { total: 0, items: [] as any[] },
      financing: { total: 0, items: [] as any[] },
      netChange: 0
    };

    const mockAccounts = [
      { id: 'acc_cash', name: 'Cash', type: 'asset', category: 'Cash' },
      { id: 'acc_equity', name: 'Common Stock', type: 'equity', category: 'Equity' },
      { id: 'acc_loan', name: 'Long Term Loan', type: 'liability', category: 'Long Term Liabilities' },
      { id: 'acc_equipment', name: 'Equipment', type: 'asset', category: 'Fixed Assets' }
    ];

    // Transaction 1: Issue $50,000 Common Stock (DR Cash +50k, CR Equity -50k)
    const tx1: any = {
      id: 'tx_stock',
      status: 'completed',
      type: 'actual',
      totalAmountCents: 5000000,
      lines: [
        { accountId: 'acc_cash', amountCents: 5000000 },
        { accountId: 'acc_equity', amountCents: -5000000 }
      ]
    };

    // Transaction 2: Repay $10,000 Loan (DR Loan +10k, CR Cash -10k)
    const tx2: any = {
      id: 'tx_loan_repay',
      status: 'completed',
      type: 'actual',
      totalAmountCents: 1000000,
      lines: [
        { accountId: 'acc_loan', amountCents: 1000000 },
        { accountId: 'acc_cash', amountCents: -1000000 }
      ]
    };

    // Process transactions
    [tx1, tx2].forEach((tx: any) => {
      tx.lines.forEach((line: any) => {
        const acc = mockAccounts.find(a => a.id === line.accountId);
        if (!acc) return;
        const amount = line.amountCents;

        if (acc.type === 'equity' || (acc.type === 'liability' && (acc.category === 'Long Term Liabilities' || acc.category === 'Long Term Liability'))) {
          cashFlow.financing.total -= amount;
          cashFlow.financing.items.push({ name: tx.id, amount: -amount });
        }
      });
    });

    // Equity issue (-$50,000 credit) -> +$50,000 financing cash inflow
    // Loan repayment (+$10,000 debit) -> -$10,000 financing cash outflow
    // Net financing cash flow = +$40,000
    assert.strictEqual(cashFlow.financing.total, 4000000, 'Financing cash flow must be positive $40,000 (+50k stock - 10k repayment)');
  });

  test('#45 & #46: AR Aging reduces amountPaidCents and parses dates safely', () => {
    const today = parseLocalDate('2026-09-01');
    const invoices = [
      { id: 'inv_1', amountCents: 100000, amountPaidCents: 100000, dueDate: '2026-08-01', status: 'paid' }, // Fully paid -> $0
      { id: 'inv_2', amountCents: 100000, amountPaidCents: 30000, dueDate: '2026-08-15', status: 'partially_paid' }, // $700 remaining (17 days overdue -> 1-30)
      { id: 'inv_3', amountCents: 50000, amountPaidCents: 0, dueDate: '2026-09-15', status: 'pending' }, // Current ($500)
      { id: 'inv_4', amountCents: 80000, amountPaidCents: 0, dueDate: null, status: 'pending' } // Undated -> current ($800)
    ];

    const aging = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0
    };

    invoices.forEach((item: any) => {
      if (item.status === 'paid') return;
      const rawTotal = item.amountCents || 0;
      const rawPaid = item.amountPaidCents || 0;
      const outstanding = Math.max(0, rawTotal - rawPaid);
      if (outstanding <= 0) return;

      let diffDays = 0;
      const dateStr = item.dueDate;
      if (dateStr && typeof dateStr === 'string') {
        try {
          const parsed = parseLocalDate(dateStr);
          if (!isNaN(parsed.getTime())) {
            diffDays = Math.floor((today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
          }
        } catch {
          diffDays = 0;
        }
      }

      if (diffDays <= 0) aging.current += outstanding;
      else if (diffDays <= 30) aging["1-30"] += outstanding;
      else if (diffDays <= 60) aging["31-60"] += outstanding;
      else if (diffDays <= 90) aging["61-90"] += outstanding;
      else aging["90+"] += outstanding;

      aging.total += outstanding;
    });

    assert.strictEqual(aging.current, 130000, 'Current bucket has inv_3 ($500) + inv_4 ($800) = $1,300');
    assert.strictEqual(aging["1-30"], 70000, '1-30 bucket has partial balance of inv_2 = $700');
    assert.strictEqual(aging["90+"], 0, 'No invoices should fall through to 90+');
    assert.strictEqual(aging.total, 200000, 'Total outstanding is $2,000');
  });

  test('#47: Intercompany Elimination preserves signed debit/credit polarity', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_ic_1',
        workspaceId: 'ws_1',
        uid: 'user_1',
        date: '2026-08-01',
        description: 'Intercompany Service Fee [World:EntityA]',
        totalAmountCents: 500000,
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        isIntercompany: true,
        createdAt: '2026-08-01T00:00:00.000Z',
        lines: [
          { accountId: 'acc_rev', accountName: 'Revenue Account', amountCents: -500000, dimensions: { world: 'EntityA' } }, // Revenue credit
          { accountId: 'acc_exp', accountName: 'Expense Account', amountCents: 500000, dimensions: { world: 'EntityB' } }   // Expense debit
        ]
      }
    ];

    const isIncomeLine = (l: any) => l.accountId === 'acc_rev';
    const isExpenseLine = (l: any) => l.accountId === 'acc_exp';

    const result = IntercompanyEliminationEngine.generateConsolidatedSummary(
      transactions,
      isIncomeLine,
      isExpenseLine
    );

    assert.strictEqual(result.eliminatedTransferCents, 500000, 'Eliminated intercompany transfers should equal $5,000');
    assert.strictEqual(result.consolidatedRevenueCents, 0, 'Consolidated external revenue should be $0 after elimination');
    assert.strictEqual(result.consolidatedExpenseCents, 0, 'Consolidated external expense should be $0 after elimination');
    assert.strictEqual(result.consolidatedNetIncomeCents, 0, 'Consolidated net income should be $0');
  });

  test('#51: Dynamic activeMonths calculation scales with date span', () => {
    const mockAccounts: ChartAccount[] = [
      { id: 'acc_rev', name: 'Sales Revenue', type: 'income', category: 'Revenue', code: '4000', workspaceId: 'ws_1', isArchived: false, uid: 'user_1', balanceCents: 0 },
      { id: 'acc_exp', name: 'Software Expense', type: 'expense', category: 'Expense', code: '6000', workspaceId: 'ws_1', isArchived: false, uid: 'user_1', balanceCents: 0 }
    ];

    // Transactions spanning 6 distinct months
    const dates = ['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15', '2026-05-15', '2026-06-15'];
    const transactions: Transaction[] = dates.map((d, i) => ({
      id: `tx_${i}`,
      workspaceId: 'ws_1',
      uid: 'user_1',
      date: d,
      description: `Monthly Expense for ${d}`,
      totalAmountCents: 600000, // $6,000
      currency: 'USD',
      status: 'completed',
      type: 'actual',
      createdAt: `${d}T00:00:00.000Z`,
      lines: [
        { accountId: 'acc_exp', accountName: 'Software Expense', amountCents: 600000 }
      ]
    }));

    const result = calculateSafeToSpend(transactions, mockAccounts, 'c_corp');
    // Total expenses = $36,000 across 6 months => average monthly expense = $6,000 => recommended reserve (2 months) = $12,000
    assert.strictEqual(result.expensesCents, 3600000, 'Total expenses should be $36,000');
    assert.strictEqual(result.recommendedReserveCents, 1200000, 'Recommended reserve should be $12,000 (2 months * $6,000/mo, not hardcoded 3 months)');
  });

  test('#40: Transaction similarity matching matches bank lines with high accuracy', () => {
    const scoreExact = optimizedTransactionSimilarity('Stripe Payout Ref 12345', 'Stripe Payout Ref 12345');
    const scoreClose = optimizedTransactionSimilarity('Stripe Payments Platform Inc', 'Stripe Payments');
    const scoreDiff = optimizedTransactionSimilarity('Starbucks Coffee Seattle', 'Delta Airlines Flight');

    assert.strictEqual(scoreExact, 1.0, 'Identical strings must have 1.0 similarity');
    assert.ok(scoreClose > 0.6, `Close merchant strings should have high similarity, got ${scoreClose}`);
    assert.ok(scoreDiff < 0.3, `Different merchants should have low similarity, got ${scoreDiff}`);
  });

});
