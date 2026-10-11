/**
 * Unusual entries (S-17): an entry of the last two weeks at least 3 times its account's usual
 * amount and bigger than anything before, with at least 5 earlier amounts and at least 100.00.
 * Bank and cash accounts, small amounts, thin history and old entries are left out.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { unusualEntries } from '../lib/unusualEntries';
import { makeChartAccount, makeTransaction } from './fixtures';

const bank = makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', category: 'Cash' });
const office = makeChartAccount({ id: 'office', name: 'Office supplies', type: 'expense', category: 'Office' });
const spend = (id: string, date: string, cents: number) => makeTransaction({ id, date, description: id, lines: [{ accountId: 'bank', amountCents: -cents }, { accountId: 'office', amountCents: cents }] });
// six months of office spending around 120.00
const usual = ['2026-04-03', '2026-05-04', '2026-06-02', '2026-07-06', '2026-08-03', '2026-09-01'].map((d, i) => spend(`u${i}`, d, 11_000 + i * 500));

describe('Unusual entries', () => {
  test('a 4,800.00 office purchase among ~120.00 ones is unusual; the bank side is not looked at', () => {
    const found = unusualEntries([...usual, spend('big', '2026-10-05', 480_000)], [bank, office], '2026-10-07');
    assert.deepEqual(found.map(f => [f.transaction.id, f.account.id, f.amountCents, f.usualCents]), [['big', 'office', 480_000, 12_250]]);
  });

  test('not unusual: under 3 times the usual, not the biggest yet, too old, too small, or too little history', () => {
    assert.deepEqual(unusualEntries([...usual, spend('x', '2026-10-05', 30_000)], [bank, office], '2026-10-07'), [], 'under 3 times');
    assert.deepEqual(unusualEntries([...usual, spend('old', '2026-09-10', 480_000)], [bank, office], '2026-10-07'), [], 'older than two weeks');
    const tiny = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((d, i) => spend(`t${i}`, d, 1_000));
    assert.deepEqual(unusualEntries([...tiny, spend('t', '2026-10-05', 9_000)], [bank, office], '2026-10-07'), [], 'under 100.00');
    assert.deepEqual(unusualEntries([...usual.slice(0, 4), spend('few', '2026-10-05', 480_000)], [bank, office], '2026-10-07'), [], 'only 4 earlier amounts');
    const withBig = [...usual, spend('earlier-big', '2026-09-30', 500_000), spend('later', '2026-10-05', 480_000)];
    assert.deepEqual(unusualEntries(withBig, [bank, office], '2026-10-07').map(f => f.transaction.id), ['earlier-big'], 'not bigger than one before');
  });
});
