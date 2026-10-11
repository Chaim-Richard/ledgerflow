/**
 * Reconciliation discrepancies (S-07): the books minus the statement on the latest statement date
 * of each account is kept as first seen (outstanding items make it non-zero); a later change in the
 * reconciled period moves it and is reported once.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { latestReconciliations, reconciliationDrift } from '../lib/reconciliationDrift';
import { makeChartAccount, makeTransaction } from './fixtures';

const bank = makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', openingBalanceCents: 100_000 });
const sales = makeChartAccount({ id: 'sales', name: 'Sales', type: 'revenue', category: 'Sales' });
const entry = (id: string, date: string, cents: number) => makeTransaction({ id, date, lines: [{ accountId: 'bank', amountCents: cents }, { accountId: 'sales', amountCents: -cents }] });
const recs = [
  { id: 'r-aug', accountId: 'bank', statementDate: '2026-08-31', statementBalanceCents: 100_000 },
  { id: 'r-sep', accountId: 'bank', statementDate: '2026-09-30', statementBalanceCents: 120_000 },
];

describe('Reconciliation drift', () => {
  test('only each account\'s latest reconciliation counts', () => {
    assert.deepEqual(latestReconciliations(recs, [bank, sales]).map(r => r.rec.id), ['r-sep']);
  });

  test('first seen: kept, nothing reported; an outstanding deposit is fine', () => {
    const txs = [entry('a', '2026-09-10', 20_000), entry('b', '2026-09-29', 5_000)]; // b not on the statement yet
    const { baselines, drifted } = reconciliationDrift([bank, sales], txs, recs);
    assert.deepEqual(baselines, { 'r-sep': 5_000 });
    assert.deepEqual(drifted, []);
  });

  test('an entry back-dated into the reconciled period is reported with then and now; after the date it is not', () => {
    const kept = { 'r-sep': 5_000 };
    const later = [entry('a', '2026-09-10', 20_000), entry('b', '2026-09-29', 5_000), entry('c', '2026-10-02', 7_000)];
    assert.deepEqual(reconciliationDrift([bank, sales], later, recs, kept).drifted, []);
    const backdated = [...later, entry('d', '2026-09-15', -1_500)];
    const { drifted, baselines } = reconciliationDrift([bank, sales], backdated, recs, kept);
    assert.deepEqual(drifted.map(d => [d.reconciliationId, d.statementDate, d.thenCents, d.nowCents]), [['r-sep', '2026-09-30', 5_000, 3_500]]);
    assert.deepEqual(baselines, { 'r-sep': 3_500 }, 'the new difference is kept, so it is told once');
  });
});
