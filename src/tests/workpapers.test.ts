/**
 * BD-04 workpapers (AI #3, A-6): the pure rules — the list of one month's workpapers (the
 * balances at month end are the general ledger's own figures), the note and the review mark
 * kept on the account, and that the account passed in is never touched.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkpapers,
  clearWorkpaperReview,
  markWorkpaperReviewed,
  setWorkpaperNote,
  withWorkpaper,
  workpaperLabel,
  workpaperMonthProblem,
  workpaperOf,
} from '../lib/workpapers';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { ChartAccount } from '../types';

const accounts: ChartAccount[] = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'ar', code: '1100', name: 'Accounts receivable', type: 'asset', category: 'Receivables', openingBalanceCents: 50_000, asOfDate: '2026-08-31' }),
  makeChartAccount({ id: 'ap', code: '2000', name: 'Accounts payable', type: 'liability', category: 'Payables' }),
  makeChartAccount({ id: 'reviewed', code: '2100', name: 'Reviewed loan', type: 'liability', category: 'Debt', workpapers: { '2026-09': { reviewedBy: 'Ada', reviewedAt: '2026-10-02T10:00:00.000Z' } } }),
  makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'revenue', category: 'Revenue' }),
  makeChartAccount({ id: 'rent', code: '5000', name: 'Rent', type: 'expense', category: 'Operations' }),
  makeChartAccount({ id: 'noted', code: '5200', name: 'Noted supplies', type: 'expense', category: 'Operations', workpapers: { '2026-09': { note: 'kept under a zero balance' } } }),
  makeChartAccount({ id: 'quiet', code: '5300', name: 'Quiet account', type: 'expense', category: 'Operations' }),
];

const line = (accountId: string, amountCents: number) => ({ id: `${accountId}-${amountCents}`, accountId, amountCents });
const tx = (id: string, date: string, lines: Array<{ id: string; accountId: string; amountCents: number }>, status: ReturnType<typeof makeTransaction>['status'] = 'completed') =>
  makeTransaction({ id, date, status, lines: lines as ReturnType<typeof makeTransaction>['lines'] });

const transactions = [
  tx('t1', '2026-09-10', [line('ar', 100_000), line('sales', -100_000)]),
  tx('t2', '2026-09-15', [line('rent', 20_000), line('cash', -20_000)]),
  tx('t3', '2026-09-20', [line('cash', 50_000), line('sales', -50_000)]),
  tx('t4', '2026-08-10', [line('ar', 40_000), line('sales', -40_000)]),
  tx('t5', '2026-10-05', [line('rent', 7_000), line('cash', -7_000)]), // after the month: not counted
  tx('t6', '2026-09-12', [line('rent', 3_000), line('cash', -3_000)], 'draft'), // a draft: not counted
];

describe('buildWorkpapers: the list of one month', () => {
  const result = buildWorkpapers({ accounts, transactions, month: '2026-09' });

  test('every account with a balance at month end, by code, with the ledger\'s own figures', () => {
    assert.equal(result.endDate, '2026-09-30');
    assert.deepEqual(result.rows.map(r => [r.code, r.name, r.balanceCents]), [
      ['1000', 'Cash', 30_000],            // −20 000 + 50 000 (the October and draft entries do not count)
      ['1100', 'Accounts receivable', 190_000], // 50 000 opening + 40 000 in August + 100 000 in September
      ['2100', 'Reviewed loan', 0],         // no balance, but it keeps a review mark
      ['4000', 'Sales', 190_000],           // 100 000 + 50 000 + 40 000, credits positive as in the ledger
      ['5000', 'Rent', 20_000],             // the draft and the October entry do not move it
      ['5200', 'Noted supplies', 0],        // no balance, but it keeps a note
    ]);
    assert.deepEqual(result.rows.map(r => r.accountId), ['cash', 'ar', 'reviewed', 'sales', 'rent', 'noted']);
  });

  test('accounts at zero with nothing kept are left out', () => {
    assert.ok(!result.rows.some(r => r.accountId === 'quiet'), 'no balance, no note, no review');
    assert.ok(!result.rows.some(r => r.accountId === 'ap'), 'never used');
  });

  test('the note and the review mark ride along, and the count follows the marks', () => {
    const noted = result.rows.find(r => r.accountId === 'noted');
    assert.equal(noted?.note, 'kept under a zero balance');
    assert.equal(noted?.reviewedBy, undefined);
    const reviewed = result.rows.find(r => r.accountId === 'reviewed');
    assert.equal(reviewed?.note, '');
    assert.equal(reviewed?.reviewedBy, 'Ada');
    assert.equal(reviewed?.reviewedAt, '2026-10-02T10:00:00.000Z');
    assert.equal(result.reviewedCount, 1);
  });

  test('a leap February ends on the 29th; a plain one on the 28th', () => {
    assert.equal(buildWorkpapers({ accounts, transactions, month: '2028-02' }).endDate, '2028-02-29');
    assert.equal(buildWorkpapers({ accounts, transactions, month: '2026-02' }).endDate, '2026-02-28');
    const leap = buildWorkpapers({
      accounts: [makeChartAccount({ id: 'rent', code: '5000', name: 'Rent', type: 'expense' })],
      transactions: [tx('l1', '2028-02-29', [line('rent', 1_000)]), tx('l2', '2028-03-01', [line('rent', 2_000)])],
      month: '2028-02',
    });
    assert.deepEqual(leap.rows.map(r => r.balanceCents), [1_000], 'the 29th counts, March does not');
  });
});

describe('the note and the review mark on the account', () => {
  const base = makeChartAccount({ id: 'rent', code: '5000', name: 'Rent', type: 'expense' });

  test('workpaperOf never returns undefined', () => {
    assert.deepEqual(workpaperOf(base, '2026-09'), {});
    assert.deepEqual(workpaperOf({ workpapers: { '2026-09': { note: 'hi' } } }, '2026-09'), { note: 'hi' });
    assert.deepEqual(workpaperOf({ workpapers: { '2026-09': { note: 'hi' } } }, '2026-10'), {});
  });

  test('a note is kept, trimmed, and the review mark survives it', () => {
    const withReview = markWorkpaperReviewed(base, '2026-09', 'Ada', '2026-10-02T10:00:00.000Z');
    const noted = setWorkpaperNote(withReview, '2026-09', '  check the August invoice  ');
    assert.deepEqual(noted.workpapers, { '2026-09': { reviewedBy: 'Ada', reviewedAt: '2026-10-02T10:00:00.000Z', note: 'check the August invoice' } });
  });

  test('an emptied note leaves the review mark; an emptied workpaper leaves no month behind', () => {
    const noted = setWorkpaperNote(base, '2026-09', 'a note');
    assert.deepEqual(noted.workpapers, { '2026-09': { note: 'a note' } });
    const emptied = setWorkpaperNote(noted, '2026-09', '   ');
    assert.deepEqual(emptied.workpapers, {}, 'nothing kept: no month entry');
    const reviewed = markWorkpaperReviewed(emptied, '2026-09', 'Ada', '2026-10-05T09:00:00.000Z');
    const unnoted = setWorkpaperNote(reviewed, '2026-09', '');
    assert.deepEqual(unnoted.workpapers, { '2026-09': { reviewedBy: 'Ada', reviewedAt: '2026-10-05T09:00:00.000Z' } }, 'the review mark survives an emptied note');
  });

  test('the review mark keeps the note; taking it off keeps the note', () => {
    const noted = setWorkpaperNote(base, '2026-09', 'a note');
    const reviewed = markWorkpaperReviewed(noted, '2026-09', 'Ada', '2026-10-02T10:00:00.000Z');
    assert.deepEqual(reviewed.workpapers, { '2026-09': { note: 'a note', reviewedBy: 'Ada', reviewedAt: '2026-10-02T10:00:00.000Z' } });
    const cleared = clearWorkpaperReview(reviewed, '2026-09');
    assert.deepEqual(cleared.workpapers, { '2026-09': { note: 'a note' } });
    const clearedAgain = clearWorkpaperReview(cleared, '2026-09');
    assert.deepEqual(clearedAgain.workpapers, { '2026-09': { note: 'a note' } }, 'taking off a mark that is not there changes nothing');
  });

  test('other months are kept, and the account passed in is never touched', () => {
    const january = setWorkpaperNote(base, '2026-01', 'january note');
    const september = setWorkpaperNote(january, '2026-09', 'september note');
    assert.deepEqual(Object.keys(september.workpapers || {}).sort(), ['2026-01', '2026-09']);
    assert.equal(base.workpapers, undefined, 'the input account is unchanged');
    assert.deepEqual(january.workpapers, { '2026-01': { note: 'january note' } }, 'the intermediate account is unchanged');
  });

  test('withWorkpaper sets exactly what it is given', () => {
    assert.deepEqual(withWorkpaper(base, '2026-09', { note: '  ', reviewedBy: ' ' }).workpapers, {});
    assert.deepEqual(withWorkpaper(base, '2026-09', { reviewedBy: 'Ada' }).workpapers, { '2026-09': { reviewedBy: 'Ada' } }, 'a mark without a time keeps no time');
  });
});

describe('the month and the label', () => {
  test('a month is YYYY-MM', () => {
    assert.equal(workpaperMonthProblem('2026-09'), null);
    assert.equal(workpaperMonthProblem('2026-01'), null);
    assert.ok(workpaperMonthProblem('2026-13'));
    assert.ok(workpaperMonthProblem('2026-9'));
    assert.ok(workpaperMonthProblem(''));
    assert.ok(workpaperMonthProblem('September 2026'));
  });

  test('the label carries the month (it names the workpaper where its files are listed)', () => {
    assert.equal(workpaperLabel('2026-09'), 'Workpaper 2026-09');
  });
});
