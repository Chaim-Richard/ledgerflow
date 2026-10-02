import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { ALTMAN_Z_SCORE_ALGO } from '../lib/algorithms/altman-z-score.js';
import { EXPENSE_VELOCITY_ALGO } from '../lib/algorithms/expense-velocity.js';
import { MONTE_CARLO_ALGO } from '../lib/algorithms/monte-carlo.js';
import { assetAmortizer } from '../lib/algorithms/asset-amortizer.js';
import { parseNaturalLanguageEntry } from '../lib/algorithms/nl-parser.js';
import { buildAlgorithmContext } from '../lib/algorithms/types.js';
import { isPostable, isSimulationTransaction } from '../lib/txFilters.js';

describe('Financial Algorithms & Platform Semantics Test Suite', () => {
  test('Altman Z-Score computes correctly and avoids division by zero', () => {
    const computeFn = ALTMAN_Z_SCORE_ALGO.compute;
    const ctxEmpty = buildAlgorithmContext([], [], '2026-09-06', { start: '2026-01-01', end: '2026-12-31' });
    const resEmpty = computeFn(ctxEmpty, { publicCompany: 0 });
    assert.equal(resEmpty.metrics[0].value, 'N/A');

    const accounts = [
      { id: '1', type: 'asset', balanceCents: 100000 },
      { id: '2', type: 'asset', subtype: 'cash', balanceCents: 20000 },
      { id: '3', type: 'liability', subtype: 'current_liability', balanceCents: 30000 },
      { id: '4', type: 'liability', balanceCents: 40000 },
      { id: '5', type: 'equity', subtype: 'retained_earnings', balanceCents: 50000 },
    ];
    
    const transactions = [
      { id: 'tx1', status: 'completed', lines: [
        { accountId: '6', type: 'revenue', amountCents: -60000 },
        { accountId: '1', type: 'asset', amountCents: 60000 }
      ]}
    ];

    const ctx = buildAlgorithmContext(transactions as any, accounts as any, '2026-09-06', { start: '2026-01-01', end: '2026-12-31' });
    const res = computeFn(ctx, { publicCompany: 0 });
    assert.ok(res.metrics.length > 0);
  });

  test('Expense Velocity isolates true expenses and calculates trailing spikes', () => {
    const accounts = [
      { id: 'cash1', name: 'Operating Cash', type: 'asset', category: 'Cash' },
      { id: 'exp1', name: 'Rent Expense', type: 'expense', category: 'Rent' },
      { id: 'rev1', name: 'Product Revenue', type: 'revenue', category: 'Revenue' }
    ];

    // Create 10 days of base expenses ($100/day = 10000 cents) and a spike on day 10 ($1000 = 100000 cents)
    const txs: any[] = [];
    for (let day = 1; day <= 9; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      txs.push({
        id: `tx-exp-${day}`,
        date: `2026-06-${dayStr}T12:00:00.000Z`,
        status: 'completed',
        totalAmountCents: 10000,
        lines: [
          { accountId: 'exp1', amountCents: 10000 },
          { accountId: 'cash1', amountCents: -10000 }
        ]
      });
    }

    // Spike on day 10
    txs.push({
      id: 'tx-exp-10',
      date: '2026-06-10T12:00:00.000Z',
      status: 'completed',
      totalAmountCents: 100000,
      lines: [
        { accountId: 'exp1', amountCents: 100000 },
        { accountId: 'cash1', amountCents: -100000 }
      ]
    });

    // Also add an incoming revenue transaction of $500,000 which must NOT count as an expense spike!
    txs.push({
      id: 'tx-rev-10',
      date: '2026-06-10T14:00:00.000Z',
      status: 'completed',
      totalAmountCents: 50000000,
      lines: [
        { accountId: 'cash1', amountCents: 50000000 },
        { accountId: 'rev1', amountCents: -50000000 }
      ]
    });

    const ctx = buildAlgorithmContext(txs, accounts as any, '2026-06-11', { start: '2026-06-01', end: '2026-06-11' });
    const res = EXPENSE_VELOCITY_ALGO.compute(ctx, { spikeThresholdPct: 50, movingAverageDays: 7 });

    assert.ok(res.metrics.length >= 3);
    const spikeMetric = res.metrics.find(m => m.label === 'Recent Spikes');
    assert.ok(spikeMetric);
    assert.equal(spikeMetric.value, 1);
    assert.ok(res.sourceTransactionIds?.includes('tx-exp-10'));
    assert.ok(!res.sourceTransactionIds?.includes('tx-rev-10'));
  });

  test('Monte Carlo strictly isolates cash accounts and ignores non-cash transactions', () => {
    const accounts = [
      { id: 'bank1', name: 'JPMorgan Checking', type: 'asset', category: 'Cash', role: 'cash', balanceCents: 1000000 },
      { id: 'ar1', name: 'Accounts Receivable', type: 'asset', category: 'Receivables', balanceCents: 5000000 },
      { id: 'fa1', name: 'Office Machinery', type: 'asset', category: 'Fixed Assets', balanceCents: 8000000 },
      { id: 'exp1', name: 'Depreciation Expense', type: 'expense', balanceCents: 0 }
    ];

    const txs: any[] = [];
    // 10 days of cash transactions
    for (let day = 1; day <= 10; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      txs.push({
        id: `tx-cash-${day}`,
        date: `2026-05-${dayStr}`,
        status: 'completed',
        totalAmountCents: 20000,
        lines: [
          { accountId: 'bank1', amountCents: 20000 },
          { accountId: 'ar1', amountCents: -20000 }
        ]
      });
    }

    // Non-cash depreciation entry of $1,000,000
    txs.push({
      id: 'tx-deprec',
      date: '2026-05-11',
      status: 'completed',
      totalAmountCents: 100000000,
      lines: [
        { accountId: 'exp1', amountCents: 100000000 },
        { accountId: 'fa1', amountCents: -100000000 }
      ]
    });

    const ctx = buildAlgorithmContext(txs, accounts as any, '2026-05-12', { start: '2026-05-01', end: '2026-05-12' });
    const res = MONTE_CARLO_ALGO.compute(ctx, { simulationDays: 90, iterations: 10 });

    assert.ok(res.metrics.length > 0);
    // Baseline cash flows should isolate cash txs ($200/day) and ignore non-cash $1M depreciation
    assert.ok(res.insights[1].includes('$200.00/day'));
    const ruinMetric = res.metrics.find(m => m.label.includes('Risk of Exhaustion'));
    assert.ok(ruinMetric);
  });

  test('Fixed Asset Amortizer strictly filters out liquid cash/AR and models half-year convention', () => {
    const accounts = [
      { id: 'bank1', name: 'Operating Cash', type: 'asset', category: 'Cash', role: 'cash', balanceCents: 100000 },
      { id: 'fa1', name: 'CNC Milling Machine', type: 'asset', category: 'Fixed Assets', balanceCents: 10000000 }
    ];

    const ctx = buildAlgorithmContext([], accounts as any, '2026-01-01', { start: '2026-01-01', end: '2026-12-31' });
    const res = assetAmortizer.compute(ctx, { life: 5, salvageValuePct: 10, taxRate: 25, convention: 'half-year' });

    assert.ok(res.metrics.length > 0);
    // Depreciable base should be on $100,000 (10,000,000 cents), not $101,000
    const baseMetric = res.metrics.find(m => m.label === 'Identified Capital Base');
    assert.ok(baseMetric);
    assert.equal(baseMetric.value, '$100,000');
    
    // Half-year convention: 5-year asset produces 6 periods (Year 1 to Year 6)
    assert.equal(res.charts[0].data.length, 6);
    assert.ok(res.charts[0].data[0].year.includes('Half'));
  });

  test('Simulation / Ghost Transaction Isolation protects real reports', () => {
    const realTx: any = {
      id: 'tx-real-1',
      status: 'completed',
      date: '2026-01-15',
      totalAmountCents: 5000,
      lines: [{ accountId: 'cash', amountCents: 5000 }]
    };

    const ghostTx: any = {
      id: 'ghost-scenario-1-20260115',
      status: 'pending',
      type: 'forecast',
      date: '2026-01-15',
      totalAmountCents: 5000,
      metadata: { isGhost: true },
      lines: [{ accountId: 'ghost-acc', amountCents: 5000 }]
    };

    assert.equal(isPostable(realTx), true);
    assert.equal(isSimulationTransaction(realTx), false);

    assert.equal(isSimulationTransaction(ghostTx), true);
    // Real reports: default isPostable rejects ghost transactions
    assert.equal(isPostable(ghostTx), false);
    // Scenario reports: can explicitly opt-in
    assert.equal(isPostable(ghostTx, { includeSimulations: true }), true);
  });

  test('Deterministic NL Parser correctly resolves transaction, project, and query intents', () => {
    const txIntent = parseNaturalLanguageEntry('paid $45.50 gas cash yesterday');
    assert.equal(txIntent.type, 'transaction');
    assert.equal(txIntent.amountCents, 4550);
    assert.equal(txIntent.action, 'expense');
    assert.equal(txIntent.method, 'Cash');

    const projIntent = parseNaturalLanguageEntry('new project: Shakespeare Folio');
    assert.equal(projIntent.type, 'project');
    assert.equal(projIntent.projectName, 'Shakespeare Folio');

    const queryIntent = parseNaturalLanguageEntry('show maui repair expenses');
    assert.equal(queryIntent.type, 'query');
    assert.equal(queryIntent.queryText, 'maui repair expenses');
  });
});
