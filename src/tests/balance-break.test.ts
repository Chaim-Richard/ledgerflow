/**
 * Since when don't the books balance? (A-4, CA-34): the search behind the Data Health panel.
 *
 * Every number here is worked out by hand from the report code's own rule (assets against
 * liabilities + equity + profit, whole cents):
 *   a sale of 1000 (bank +1000, sales −1000) adds 1000 to the assets and 1000 to profit → still level;
 *   an entry with both sides on one account, or a side missing, leaves the sheet off by the amount
 *   it does not account for. The dates are chosen so the halving has to look at the first day, the
 *   last day, a day in the middle, and a history that never breaks.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { balanceDifferenceCents, findBalanceBreak, probeDates } from '../lib/balanceBreak';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { ChartAccount, Transaction } from '../types';

const bank: ChartAccount = makeChartAccount({ id: 'bank', code: '1010', name: 'Bank', type: 'asset', category: 'Cash' });
const sales: ChartAccount = makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income', category: 'Revenue' });
const rent: ChartAccount = makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense', category: 'Operating Expenses' });
const loan: ChartAccount = makeChartAccount({ id: 'loan', code: '2500', name: 'Bank loan', type: 'liability', category: 'Long-term Liabilities' });
const accounts = [bank, sales, rent, loan];

const entry = (id: string, date: string, lines: Array<[string, number]>) => makeTransaction({
  id, date, description: `Entry ${id}`,
  lines: lines.map(([accountId, amountCents]) => ({ id: `line-${id}-${accountId}`, accountId, amountCents })),
});

/** A sale: the bank up, sales up; balanced. */
const sale = (id: string, date: string, cents: number) => entry(id, date, [['bank', cents], ['sales', -cents]]);
const today = '2026-03-31';

describe('Probing dates', () => {
  test('only days that carry a postable entry, in order, then the end date', () => {
    const transactions: Transaction[] = [
      sale('c', '2026-03-20', 100),
      sale('a', '2026-03-01', 100),
      makeTransaction({ id: 'draft', date: '2026-03-05', status: 'draft', lines: [{ accountId: 'bank', amountCents: 1 }] }),
      makeTransaction({ id: 'void', date: '2026-03-06', status: 'void', lines: [{ accountId: 'bank', amountCents: 1 }] }),
      sale('late', '2026-04-02', 100),
      makeTransaction({ id: 'stamp', date: '2026-03-10T12:00:00.000Z', lines: [{ accountId: 'bank', amountCents: 1 }, { accountId: 'sales', amountCents: -1 }] }),
    ];
    assert.deepEqual(probeDates(transactions, today), ['2026-03-01', '2026-03-10', '2026-03-20', today]);
  });

  test('the difference is the report code’s own two totals', () => {
    assert.equal(balanceDifferenceCents(accounts, [sale('a', '2026-03-01', 1000)], today), 0);
    assert.equal(balanceDifferenceCents(accounts, [entry('b', '2026-03-01', [['bank', 500], ['sales', -400]])], today), 100);
    assert.equal(balanceDifferenceCents(accounts, [], today), 0);
  });
});

describe('Finding the day the books stopped balancing', () => {
  test('a break on the first day of the history', () => {
    const transactions = [entry('first', '2026-03-01', [['bank', 500], ['sales', -400]])];
    const result = findBalanceBreak(accounts, transactions, today);
    assert.equal(result.balanced, false);
    assert.equal(result.firstUnbalancedDate, '2026-03-01');
    assert.equal(result.lastBalancedDate, null, 'nothing came before it');
    assert.equal(result.differenceCents, 100);
    assert.equal(result.differenceBeforeCents, 0);
    assert.deepEqual(result.entries.map(e => [e.transactionId, e.offCents]), [['first', 100]]);
    assert.equal(result.probes, 2, 'the end date and the first day');
  });

  test('a break on the last day', () => {
    const transactions = [
      sale('jan', '2026-03-01', 1000),
      entry('rent', '2026-03-05', [['rent', 300], ['bank', -200]]),
    ];
    const result = findBalanceBreak(accounts, transactions, today);
    assert.equal(result.firstUnbalancedDate, '2026-03-05');
    assert.equal(result.lastBalancedDate, '2026-03-01', 'the day before still balanced');
    assert.equal(result.differenceCents, 100, '800 in the bank against 700 of profit');
    assert.deepEqual(result.entries.map(e => [e.transactionId, e.offCents]), [['rent', 100]]);
    assert.equal(result.probes, 3);
  });

  test('a break in the middle, with balanced entries after it', () => {
    const transactions = [
      sale('a', '2026-03-01', 1000),
      entry('b', '2026-03-10', [['rent', 50], ['bank', -40]]),
      sale('c', '2026-03-20', 500),
    ];
    const result = findBalanceBreak(accounts, transactions, today);
    assert.equal(result.firstUnbalancedDate, '2026-03-10');
    assert.equal(result.lastBalancedDate, '2026-03-01');
    assert.equal(result.differenceCents, 10);
    assert.deepEqual(result.entries.map(e => e.transactionId), ['b'], 'only the break day’s entries are listed');
    // the entry shares add up to the day's change
    assert.equal(result.entries.reduce((sum, e) => sum + e.offCents, 0), result.differenceCents - result.differenceBeforeCents);
  });

  test('a history that never breaks, and an empty one', () => {
    const result = findBalanceBreak(accounts, [sale('a', '2026-03-01', 1000), sale('b', '2026-03-20', 400)], today);
    assert.deepEqual({ balanced: result.balanced, first: result.firstUnbalancedDate, last: result.lastBalancedDate, difference: result.differenceCents, entries: result.entries.length }, { balanced: true, first: null, last: null, difference: 0, entries: 0 });
    assert.equal(result.probes, 1, 'one look at the end date is enough');
    assert.deepEqual(findBalanceBreak(accounts, [], today).balanced, true);
  });

  test('a line whose account is not in the chart is named, and the entry carries its amount', () => {
    const transactions = [sale('ok', '2026-03-01', 400), entry('ghost', '2026-03-02', [['not-in-chart', 250], ['bank', -250]])];
    const result = findBalanceBreak(accounts, transactions, today);
    assert.equal(result.firstUnbalancedDate, '2026-03-02');
    assert.equal(result.differenceCents, -250, 'the 250 line is left out of the sheet, so the assets lose it');
    assert.deepEqual(result.entries.map(e => [e.transactionId, e.offCents, e.missingAccounts]), [['ghost', -250, ['not-in-chart']]]);
  });

  test('the biggest share is listed first, and a balanced entry is not blamed for another’s amount', () => {
    const transactions = [
      entry('small', '2026-03-04', [['bank', 10], ['sales', -5]]),
      entry('big', '2026-03-04', [['bank', 900], ['sales', -800]]),
    ];
    const result = findBalanceBreak(accounts, transactions, today);
    assert.equal(result.firstUnbalancedDate, '2026-03-04');
    assert.deepEqual(result.entries.map(e => [e.transactionId, e.offCents]), [['big', 100], ['small', 5]]);
    assert.equal(result.entries.reduce((sum, e) => sum + e.offCents, 0), 105, 'the whole day');
  });

  test('a missing account in one entry of the day does not change the other entry’s share', () => {
    const transactions = [
      entry('ghost', '2026-03-03', [['not-in-chart', 250], ['bank', -250]]),
      entry('off', '2026-03-03', [['rent', 30], ['bank', -20]]),
    ];
    const result = findBalanceBreak(accounts, transactions, today);
    assert.deepEqual(result.entries.map(e => [e.transactionId, e.offCents]), [['ghost', -250], ['off', 10]]);
    assert.equal(result.differenceCents, -240, '-250 from the placed line, +10 from the second entry');
  });
});
