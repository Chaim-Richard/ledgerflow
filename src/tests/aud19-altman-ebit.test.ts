/**
 * AUD-19: the Altman Z-Score's EBIT keeps each line's sign, so a reversal takes away what it reverses
 * (src/lib/algorithms/altman-z-score.ts), and interest and income tax are left out by the account's name.
 * Worked figures (cents):
 *   sale 50,000 (Sales −50,000)                         EBIT +50,000
 *   sale 20,000 and its reversal (Sales −20,000, +20,000)      +20,000 −20,000
 *   rent 10,000; a rent refund of 2,000                        −10,000  +2,000
 *   interest 3,000; income tax 4,000                     left out (before interest and taxes)
 *   → EBIT 42,000 (it was 50,000 + 20,000 + 20,000 − 10,000 − 2,000 − 3,000 − 4,000 = 71,000: the reversal and the
 *     refund counted the wrong way, interest and tax subtracted)
 * Balance sheet (stored balances): cash 100,000; A/P 20,000; capital 50,000; retained earnings 30,000.
 *   T1 = (100,000 − 20,000) / 100,000 = 0.8 · T2 = 30,000 / 100,000 = 0.3 · T3 = 42,000 / 100,000 = 0.42
 *   T4 = 80,000 / 20,000 = 4
 *   Z′ = 6.56 × 0.8 + 3.26 × 0.3 + 6.72 × 0.42 + 1.05 × 4 = 5.248 + 0.978 + 2.8224 + 4.2 = 13.2484 → 13.25 (was 15.20)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALTMAN_Z_SCORE_ALGO } from '../lib/algorithms/altman-z-score';
import { buildAlgorithmContext } from '../lib/algorithms/types';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Transaction } from '../types';

const accounts = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash', balanceCents: 100_000 }),
  makeChartAccount({ id: 'ap', code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Payables', balanceCents: -20_000 }),
  makeChartAccount({ id: 'capital', code: '3000', name: 'Capital', type: 'equity', category: 'Equity', balanceCents: -50_000 }),
  makeChartAccount({ id: 're', code: '3100', name: 'Retained Earnings', type: 'equity', category: 'Equity', balanceCents: -30_000 }),
  makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income', category: 'Revenue' }),
  makeChartAccount({ id: 'rent', code: '6000', name: 'Rent', type: 'expense', category: 'Operating' }),
  makeChartAccount({ id: 'interest', code: '7000', name: 'Interest expense', type: 'expense', category: 'Finance costs' }),
  makeChartAccount({ id: 'tax', code: '7500', name: 'Income tax expense', type: 'expense', category: 'Taxes' }),
];
const tx = (id: string, debit: string, credit: string, cents: number, over: Partial<Transaction> = {}) =>
  makeTransaction({ id, date: '2026-05-01', lines: [{ accountId: debit, amountCents: cents }, { accountId: credit, amountCents: -cents }], ...over });
const ledger: Transaction[] = [
  tx('sale-1', 'cash', 'sales', 50_000),
  tx('sale-2', 'cash', 'sales', 20_000),
  tx('sale-2-reversal', 'sales', 'cash', 20_000, { metadata: { isReversal: true, reversesTxId: 'sale-2' } }),
  tx('rent', 'rent', 'cash', 10_000),
  tx('rent-refund', 'cash', 'rent', 2_000),
  tx('interest', 'interest', 'cash', 3_000),
  tx('tax', 'tax', 'cash', 4_000),
];
const run = (txs: Transaction[]) => ALTMAN_Z_SCORE_ALGO.compute(buildAlgorithmContext(txs, accounts, '2026-10-21', { start: '2026-01-01', end: '2026-12-31' }), {});
const metric = (r: ReturnType<typeof run>, label: string) => r.metrics.find(m => m.label === label)?.value;

test('EBIT keeps each line\'s sign: a reversal takes away its sale, a refund gives back its cost; interest and tax left out', () => {
  const r = run(ledger);
  assert.equal(metric(r, 'EBIT / Assets'), '42.0%', '42,000 / 100,000');
  assert.equal(metric(r, 'Altman Z-Score'), '13.25', '5.248 + 0.978 + 2.8224 + 4.2');
  assert.equal(metric(r, 'Working Capital / Assets'), '80.0%');
});

test('a sale and its reversal together are nothing; without them EBIT is the same', () => {
  const withoutPair = ledger.filter(t => !t.id.startsWith('sale-2'));
  assert.equal(metric(run(withoutPair), 'EBIT / Assets'), '42.0%');
});

test('a draft is not posted, so it is not in EBIT', () => {
  assert.equal(metric(run([...ledger, tx('draft-sale', 'cash', 'sales', 99_000, { status: 'draft' })]), 'EBIT / Assets'), '42.0%');
});
