import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { TransactionQueryEngine } from '../lib/TransactionQueryEngine.js';
import { normalizeTaxRate, SALES_TAX_LIABILITY_ALGO } from '../lib/algorithms/sales-tax-liability.js';
import { assetAmortizer } from '../lib/algorithms/asset-amortizer.js';
import { BankLineUpdateSchema } from '../schemas.js';
import { LedgerEngine } from '../kernel/ledger/LedgerEngine.js';
import { TransactionValidator } from '../kernel/validation/TransactionValidator.js';
import { DoubleEntryValidator } from '../kernel/validation/DoubleEntryValidator.js';
import { deliverInvoiceEmail } from '../server/services/emailService.js';
import { buildAlgorithmContext } from '../lib/algorithms/types.js';

describe('Master Repair Board Verification Suite (#90, #78, #94, #95, #100, #99, #84, #102)', () => {
  
  // =========================================================================
  // #90: FX Safe Integer Handling (FAIL CLOSED)
  // =========================================================================
  test('#90: FX conversion fails closed and throws on unsafe integer overflow', () => {
    const hugeAmount = 9007199254740990; // Near MAX_SAFE_INTEGER
    const rate = 2; // Multiplier causing safe integer overflow

    const accounts = [
      { id: 'acc-cash', name: 'Cash', type: 'asset' as const, category: 'Cash', balanceCents: 0 },
      { id: 'acc-rev', name: 'Revenue', type: 'revenue' as const, category: 'Revenue', balanceCents: 0 }
    ];

    const tx: any = {
      id: 'tx-fx-overflow',
      workspaceId: 'ws-1',
      date: '2026-01-01',
      status: 'completed',
      exchangeRate: rate,
      totalAmountCents: hugeAmount,
      lines: [
        { accountId: 'acc-cash', amountCents: hugeAmount, exchangeRate: rate },
        { accountId: 'acc-rev', amountCents: -hugeAmount, exchangeRate: rate }
      ]
    };

    assert.throws(() => {
      LedgerEngine.computeDimensionalBalances(accounts as any, [tx]);
    }, /Monetary overflow/);
  });

  // =========================================================================
  // #78: BankLineUpdateSchema Allowlist & Strict Enforcement
  // =========================================================================
  test('#78: BankLineUpdateSchema strictly accepts allowed fields and rejects protected/unknown fields', () => {
    // Valid mutation
    const validData = {
      status: 'matched',
      matchedTransactionId: 'tx-123',
      category: 'Office Supplies',
      notes: 'Verified against bank receipt',
      isReviewed: true,
      confidence: 0.95
    };
    const parsed = BankLineUpdateSchema.parse(validData);
    assert.equal(parsed.status, 'matched');
    assert.equal(parsed.matchedTransactionId, 'tx-123');

    // Forbidden/unknown fields MUST throw
    assert.throws(() => {
      BankLineUpdateSchema.parse({
        status: 'matched',
        workspaceId: 'ws-hacked', // Protected field
      });
    });

    assert.throws(() => {
      BankLineUpdateSchema.parse({
        amountCents: 500000, // Protected financial field
      });
    });

    assert.throws(() => {
      BankLineUpdateSchema.parse({
        id: 'fake-id', // ID cannot be mutated in body
      });
    });
  });

  // =========================================================================
  // #94: Sales Tax Rate Semantics (0%, 5%, 8.25%, 10%, 100%, inclusive/exclusive)
  // =========================================================================
  test('#94: Sales tax rate normalization handles percentage and decimal representations accurately', () => {
    assert.equal(normalizeTaxRate(0), 0);
    assert.equal(normalizeTaxRate(5), 0.05);
    assert.equal(normalizeTaxRate(0.05), 0.05);
    assert.equal(normalizeTaxRate(8.25), 0.0825);
    assert.equal(normalizeTaxRate(0.0825), 0.0825);
    assert.equal(normalizeTaxRate(10), 0.10);
    assert.equal(normalizeTaxRate(0.10), 0.10);
    assert.equal(normalizeTaxRate(100), 1.0);
    assert.equal(normalizeTaxRate(1.0), 1.0);
    assert.equal(normalizeTaxRate(-5), 0);
    assert.equal(normalizeTaxRate(null), 0);
  });

  test('#94: Sales tax liability compute supports exclusive and inclusive tax across rates', () => {
    // 1. Exclusive tax at 8.25%: $100 sale -> $8.25 tax
    const ctxExclusive = buildAlgorithmContext([], [], '2026-09-01', { start: '2026-01-01', end: '2026-12-31' }, 'USD', {
      invoices: [
        {
          id: 'inv-exclusive',
          status: 'paid',
          date: '2026-06-01',
          amountCents: 10000,
          taxRate: 8.25, // 8.25%
          taxInclusive: false
        }
      ]
    });

    const resExclusive = SALES_TAX_LIABILITY_ALGO.compute(ctxExclusive, { accountingBasis: 'cash' });
    const taxDueMetric = resExclusive.metrics.find(m => m.label === 'Tax Collected / Due');
    assert.equal(taxDueMetric?.value, '$8.25');

    // 2. Inclusive tax at 10%: $110 gross -> $100 taxable, $10 tax
    const ctxInclusive = buildAlgorithmContext([], [], '2026-09-01', { start: '2026-01-01', end: '2026-12-31' }, 'USD', {
      invoices: [
        {
          id: 'inv-inclusive',
          status: 'paid',
          date: '2026-06-01',
          amountCents: 11000,
          taxRate: 10, // 10%
          taxInclusive: true
        }
      ]
    });

    const resInclusive = SALES_TAX_LIABILITY_ALGO.compute(ctxInclusive, { accountingBasis: 'cash' });
    const taxMetricInc = resInclusive.metrics.find(m => m.label === 'Tax Collected / Due');
    const taxableMetricInc = resInclusive.metrics.find(m => m.label === 'Taxable Sales');
    assert.equal(taxMetricInc?.value, '$10.00');
    assert.equal(taxableMetricInc?.value, '$100.00');

    // 3. 0% tax: $50 sale -> $0 tax
    const ctxZero = buildAlgorithmContext([], [], '2026-09-01', { start: '2026-01-01', end: '2026-12-31' }, 'USD', {
      invoices: [
        {
          id: 'inv-zero',
          status: 'paid',
          date: '2026-06-01',
          amountCents: 5000,
          taxRate: 0,
          taxInclusive: false
        }
      ]
    });
    const resZero = SALES_TAX_LIABILITY_ALGO.compute(ctxZero, { accountingBasis: 'cash' });
    assert.equal(resZero.metrics.find(m => m.label === 'Tax Collected / Due')?.value, '$0.00');

    // 4. 100% tax: $100 sale exclusive -> $100 tax
    const ctx100 = buildAlgorithmContext([], [], '2026-09-01', { start: '2026-01-01', end: '2026-12-31' }, 'USD', {
      invoices: [
        {
          id: 'inv-100',
          status: 'paid',
          date: '2026-06-01',
          amountCents: 10000,
          taxRate: 100, // 100%
          taxInclusive: false
        }
      ]
    });
    const res100 = SALES_TAX_LIABILITY_ALGO.compute(ctx100, { accountingBasis: 'cash' });
    assert.equal(res100.metrics.find(m => m.label === 'Tax Collected / Due')?.value, '$100.00');
  });

  // =========================================================================
  // #95: Asset Amortizer Fallback Elimination
  // =========================================================================
  test('#95: Asset Amortizer fails safely with Insufficient Data if no fixed assets exist', () => {
    const accounts = [
      { id: 'cash-1', name: 'Operating Cash', type: 'asset', category: 'Cash' },
      { id: 'ar-1', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' }
    ];

    // Large transactions that prior code erroneously guessed as capital assets
    const txs: any[] = [
      {
        id: 'tx-large-1',
        status: 'completed',
        type: 'journal',
        totalAmountCents: 500000, // $5,000
        lines: [
          { accountId: 'cash-1', amountCents: 500000 },
          { accountId: 'ar-1', amountCents: -500000 }
        ]
      }
    ];

    const ctx = buildAlgorithmContext(txs as any, accounts as any, '2026-01-01', { start: '2026-01-01', end: '2026-12-31' });
    const res = assetAmortizer.compute(ctx, { life: 5, salvageValuePct: 10, taxRate: 25, convention: 'half-year' });

    assert.equal(res.metrics.find(m => m.label === 'Status')?.value, 'Insufficient Data');
    assert.equal(res.metrics.find(m => m.label === 'Identified Capital Base')?.value, '$0');
    assert.equal(res.charts.length, 0);
  });

  // =========================================================================
  // #99 & #100: TransactionQueryEngine End-to-End Operator Test Matrix
  // =========================================================================
  test('#99 & #100: TransactionQueryEngine correctly executes all supported query operators and isolates simulations', () => {
    const accounts: any[] = [
      { id: '101', name: 'Checking Account', code: '1010', category: 'Cash', type: 'asset' },
      { id: '501', name: 'Software Subscriptions', code: '5010', category: 'Operating Expense', type: 'expense' },
      { id: '502', name: 'Office Equipment', code: '1510', category: 'Fixed Assets', type: 'asset' }
    ];

    const makeTx = (id: string, amtDollars: number, date: string, desc: string, opts: any = {}) => ({
      id,
      date,
      description: desc,
      payee: opts.payee || 'Vendor Inc',
      project: opts.project,
      status: opts.status || 'completed',
      type: opts.type || 'actual',
      isCleared: opts.isCleared ?? false,
      metadata: opts.metadata,
      lines: [
        { accountId: opts.accountId || '501', amountCents: amtDollars * 100, class: opts.class, location: opts.location }
      ],
      totalAmountCents: amtDollars * 100,
      _normalized: {
        absAmount: amtDollars,
        sanitizedDescription: desc.toLowerCase(),
        primaryCategory: 'Expense'
      }
    });

    const dataset = [
      makeTx('tx-1', 50, '2026-01-10', 'Stripe payment processor fee', { payee: 'Stripe' }),
      makeTx('tx-2', 150, '2026-02-15', 'Monthly GitHub Enterprise seat', { payee: 'GitHub', project: 'Engineering' }),
      makeTx('tx-3', 500, '2026-03-20', 'AWS Cloud compute cluster', { payee: 'Amazon AWS' }),
      makeTx('tx-4', 1200, '2026-04-25', 'Apple MacBook Pro M3', { payee: 'Apple Store', accountId: '502' }),
      makeTx('tx-ghost', 2000, '2026-05-01', 'Forecasted revenue growth', { type: 'forecast', metadata: { isGhost: true } })
    ];

    const baseOptions = {
      normalized: dataset,
      filterCriteria: null,
      searchTerm: '',
      accounts,
      activeView: null,
      dimensionNodes: [],
      reverseDimensionIndex: new Map(),
      thresholds: {
        avg: 475,
        totalVolume: 1900,
        percentiles: { top10: 1000, top25: 500, bottom10: 60 }
      }
    };

    // 1. Ghost Isolation (#100)
    const allNormal = TransactionQueryEngine.query(baseOptions);
    assert.equal(allNormal.some(t => t.id === 'tx-ghost'), false, 'Ghost transaction contaminated normal query');

    // Opt-in to simulations (#100)
    const withSimulations = TransactionQueryEngine.query({
      ...baseOptions,
      filterCriteria: { includeSimulations: true } as any
    });
    assert.equal(withSimulations.some(t => t.id === 'tx-ghost'), true);

    // 2. Numeric Operator >
    const gtRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: '> 200' });
    assert.deepEqual(gtRes.map(t => t.id), ['tx-3', 'tx-4']);

    // 3. Numeric Operator >=
    const gteRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: '>= 500' });
    assert.deepEqual(gteRes.map(t => t.id), ['tx-3', 'tx-4']);

    // 4. Numeric Operator <
    const ltRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: '< 100' });
    assert.deepEqual(ltRes.map(t => t.id), ['tx-1']);

    // 5. Numeric Operator <=
    const lteRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: '<= 150' });
    assert.deepEqual(lteRes.map(t => t.id), ['tx-1', 'tx-2']);

    // 6. Numeric Operator =
    const eqRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: '= 150' });
    assert.deepEqual(eqRes.map(t => t.id), ['tx-2']);

    // 7. Text Operator: "at least" (>=)
    const atLeastRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: 'at least 500' });
    assert.deepEqual(atLeastRes.map(t => t.id), ['tx-3', 'tx-4']);

    // 8. Text Operator: "at most" (<=)
    const atMostRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: 'at most 150' });
    assert.deepEqual(atMostRes.map(t => t.id), ['tx-1', 'tx-2']);

    // 9. Range Operator: "between ... and ..."
    const betweenRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: 'between 100 and 600' });
    assert.deepEqual(betweenRes.map(t => t.id), ['tx-2', 'tx-3']);

    // 10. String Directives: "starts with"
    const startsWithRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: 'starts with stripe' });
    assert.deepEqual(startsWithRes.map(t => t.id), ['tx-1']);

    // 11. String Directives: "ends with"
    const endsWithRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: 'ends with cluster' });
    assert.deepEqual(endsWithRes.map(t => t.id), ['tx-3']);

    // 12. String Directives: "contains"
    const containsRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: 'contains macbook' });
    assert.deepEqual(containsRes.map(t => t.id), ['tx-4']);

    // 13. Directives: "project:Engineering"
    const projRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: 'project:Engineering' });
    assert.deepEqual(projRes.map(t => t.id), ['tx-2']);

    // 14. Negative Keywords: "-stripe"
    const negRes = TransactionQueryEngine.query({ ...baseOptions, searchTerm: '-stripe' });
    assert.equal(negRes.some(t => t.id === 'tx-1'), false);
    assert.equal(negRes.length, 3);
  });

  // =========================================================================
  // #84: Honest Invoice Email Delivery
  // =========================================================================
  test('#84: Invoice email delivery fails closed with explicit error when unconfigured', async () => {
    // When no provider keys are set, deliverInvoiceEmail must throw NO_EMAIL_SERVICE_CONFIGURED
    const originalResend = process.env.RESEND_API_KEY;
    const originalPostmark = process.env.POSTMARK_SERVER_TOKEN;
    const originalSendgrid = process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.POSTMARK_SERVER_TOKEN;
    delete process.env.SENDGRID_API_KEY;

    try {
      await assert.rejects(
        async () => {
          await deliverInvoiceEmail({
            toEmail: 'client@example.com',
            subject: 'Test Invoice',
            invoiceUrl: 'http://localhost:3000/i/pay_123'
          });
        },
        /NO_EMAIL_SERVICE_CONFIGURED/
      );
    } finally {
      if (originalResend) process.env.RESEND_API_KEY = originalResend;
      if (originalPostmark) process.env.POSTMARK_SERVER_TOKEN = originalPostmark;
      if (originalSendgrid) process.env.SENDGRID_API_KEY = originalSendgrid;
    }
  });

  // =========================================================================
  // #102: Canonical Transaction Validation
  // =========================================================================
  test('#102: Canonical validators enforce absolute totals, lock dates, status immutability, and double entry', () => {
    // 1. Valid balanced transaction
    const validTx: any = {
      id: 'tx-valid-stripe',
      uid: 'user-1',
      workspaceId: 'ws-1',
      date: '2026-09-01',
      description: 'Stripe Payment',
      totalAmountCents: 5000,
      currency: 'USD',
      status: 'completed',
      type: 'actual',
      lines: [
        { accountId: 'acc-cash', amountCents: 5000 },
        { accountId: 'acc-ar', amountCents: -5000 }
      ]
    };

    assert.equal(DoubleEntryValidator.validateJournalEntry(validTx), true);

    // 2. Unbalanced transaction rejected
    const unbalancedTx: any = {
      id: 'tx-unbalanced',
      uid: 'user-1',
      workspaceId: 'ws-1',
      date: '2026-09-01',
      description: 'Unbalanced payment',
      totalAmountCents: 5000,
      currency: 'USD',
      status: 'completed',
      type: 'actual',
      lines: [
        { accountId: 'acc-cash', amountCents: 5000 },
        { accountId: 'acc-ar', amountCents: -3000 }
      ]
    };
    assert.throws(() => {
      DoubleEntryValidator.validateJournalEntry(unbalancedTx);
    }, /Debits must exactly equal Credits/);

    // 3. Period Lock rejected by TransactionValidator
    const periodLockedContext = {
      workspaceId: 'ws-1',
      user: { uid: 'user-1' },
      wsData: { lockDate: '2026-09-15' }
    };
    assert.throws(() => {
      TransactionValidator.validateTransactionState(validTx, periodLockedContext);
    }, /Period Locked/);

    // 4. Status Lock rejected for non-admin
    const certifiedTx: any = {
      ...validTx,
      date: '2026-10-01',
      status: 'certified'
    };
    assert.throws(() => {
      TransactionValidator.validateTransactionState(certifiedTx, {
        workspaceId: 'ws-1',
        user: { uid: 'user-1', admin: false },
        wsData: { lockDate: '2026-08-01' }
      });
    }, /status is locked/);
  });

  // =========================================================================
  // Saved View and User Search Term AND Combination Test
  // =========================================================================
  test('Saved View and User Search Term AND Combination Test', () => {
    const accounts: any[] = [
      { id: 'acc-cash', name: 'Operating Cash', type: 'asset', category: 'Cash' },
      { id: 'acc-rev', name: 'Revenue Account', type: 'revenue', category: 'Revenue' }
    ];

    const transactions: any[] = [
      {
        id: 'tx-1',
        description: 'Cash bank operating savings description',
        totalAmountCents: 1000,
        status: 'completed',
        _normalized: { absAmount: 10 },
        lines: [{ accountId: 'acc-cash', amountCents: 1000 }]
      },
      {
        id: 'tx-2',
        description: 'Some random office supplies purchase',
        totalAmountCents: 500,
        status: 'completed',
        _normalized: { absAmount: 5 },
        lines: [{ accountId: 'acc-rev', amountCents: 500 }]
      }
    ];

    const view = {
      id: 'view-cash',
      filter: {
        searchTerm: 'cash bank checking operating savings'
      }
    };

    // Case A: Query with active view search and non-existent user term returns 0 rows
    const resultsEmpty = TransactionQueryEngine.query({
      normalized: transactions,
      filterCriteria: null,
      searchTerm: 'NonExistentTermXYZ12345',
      accounts,
      activeView: view,
      dimensionNodes: [],
      reverseDimensionIndex: new Map(),
      thresholds: { avg: 0, totalVolume: 0, percentiles: { top10: 0, top25: 0, bottom10: 0 } }
    });
    assert.equal(resultsEmpty.length, 0);

    // Case B: Query with active view search and matching user term returns that row
    const resultsMatch = TransactionQueryEngine.query({
      normalized: transactions,
      filterCriteria: null,
      searchTerm: 'operating',
      accounts,
      activeView: view,
      dimensionNodes: [],
      reverseDimensionIndex: new Map(),
      thresholds: { avg: 0, totalVolume: 0, percentiles: { top10: 0, top25: 0, bottom10: 0 } }
    });
    assert.equal(resultsMatch.length, 1);
    assert.equal(resultsMatch[0].id, 'tx-1');
  });
});
