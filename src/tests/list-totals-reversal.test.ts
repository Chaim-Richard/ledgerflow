import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFilteredTotals } from '../lib/txFilters';
import type { ChartAccount, Transaction } from '../types';

// BUG-01: the transaction list's money in / money out keep the side of each line.
const accounts = [
  { id: 'bank', name: 'Bank', type: 'asset', category: 'Cash' },
  { id: 'sales', name: 'Sales', type: 'income', category: 'Revenue' },
  { id: 'rent', name: 'Rent', type: 'expense', category: 'Operating' },
] as ChartAccount[];
const tx = (id: string, lines: Array<[string, number]>, type?: string) =>
  ({ id, date: '2026-05-01', status: 'completed', type, lines: lines.map(([accountId, amountCents]) => ({ accountId, amountCents })) }) as unknown as Transaction;

test('a sale and its exact reversal: 1,000 in and 1,000 out', () => {
  const r = calculateFilteredTotals([tx('s', [['bank', 1000], ['sales', -1000]], 'income'), tx('sr', [['bank', -1000], ['sales', 1000]], 'income')], accounts);
  assert.deepEqual([r.inflowCents, r.outflowCents], [1000, 1000]);
});

test('rent and its exact reversal: 200 out and 200 in', () => {
  const r = calculateFilteredTotals([tx('r', [['rent', 200], ['bank', -200]], 'expense'), tx('rr', [['rent', -200], ['bank', 200]], 'expense')], accounts);
  assert.deepEqual([r.inflowCents, r.outflowCents], [200, 200]);
});

test('an ordinary sale and expense are counted once each', () => {
  const r = calculateFilteredTotals([tx('s', [['bank', 1000], ['sales', -1000]]), tx('r', [['rent', 300], ['bank', -300]])], accounts);
  assert.deepEqual([r.inflowCents, r.outflowCents], [1000, 300]);
});
