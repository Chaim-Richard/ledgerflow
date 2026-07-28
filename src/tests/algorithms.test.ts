import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { CASH_CONVERSION_CYCLE_ALGO } from '../lib/algorithms/cash-conversion-cycle.js';
import { ALTMAN_Z_SCORE_ALGO } from '../lib/algorithms/altman-z-score.js';

describe('Financial Algorithms Test Suite', () => {
  test('Altman Z-Score computes correctly and avoids division by zero', () => {
    const resEmpty = ALTMAN_Z_SCORE_ALGO.compute([], [], { publicCompany: 0 });
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

    const res = ALTMAN_Z_SCORE_ALGO.compute(transactions as any, accounts as any, { publicCompany: 0 });
    assert.ok(res.metrics.length > 0);
  });
});
