/**
 * C-95: a statement total opens the entries behind it. The drill-down lists only posted entries in
 * the total's period whose lines touch the total's own accounts, and passes the figure shown on
 * screen to the server explainer unchanged — nothing is recalculated here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { accountIdsOf, entriesForAccounts, statementTotalDrill } from '../lib/statementDrill';
import { makeTransaction } from './fixtures';

// 12,345.00 income from two customers, one expense, a draft and an entry outside the period.
const entries = [
  makeTransaction({ id: 'sale-1', date: '2026-03-02', lines: [{ accountId: 'income-a', amountCents: -10000 }, { accountId: 'cash', amountCents: 10000 }] }),
  makeTransaction({ id: 'sale-2', date: '2026-03-31T23:59:00.000Z', lines: [{ accountId: 'income-b', amountCents: -2345 }, { accountId: 'cash', amountCents: 2345 }] }),
  makeTransaction({ id: 'rent', date: '2026-03-05', lines: [{ accountId: 'expense-a', amountCents: 4000 }, { accountId: 'cash', amountCents: -4000 }] }),
  makeTransaction({ id: 'draft', date: '2026-03-06', status: 'draft', lines: [{ accountId: 'income-a', amountCents: -999 }] }),
  makeTransaction({ id: 'void', date: '2026-03-07', status: 'void', lines: [{ accountId: 'income-a', amountCents: -500 }] }),
  makeTransaction({ id: 'april', date: '2026-04-01', lines: [{ accountId: 'income-a', amountCents: -700 }] }),
];
const march = { startDate: '2026-03-01', endDate: '2026-03-31' };

test('a total opens the posted entries in its period that touch its own accounts', () => {
  const drill = statementTotalDrill({ name: 'Total income', accountIds: ['income-a', 'income-b'], expectedCents: 12345, sign: -1, ...march }, entries);
  assert.ok(drill);
  assert.deepEqual(drill.transactions.map(t => t.id), ['sale-1', 'sale-2'], 'drafts, void entries and other periods stay out');
  assert.equal(drill.transactions.reduce((sum, t) => sum + (t.lines || []).filter(l => l.accountId.startsWith('income')).reduce((s, l) => s + l.amountCents, 0), 0), -12345);
  // the report's own figure and sign travel untouched, so the modal can flag a figure the entries do not explain
  assert.equal(drill.explain.expectedCents, 12345);
  assert.equal(drill.explain.sign, -1);
  assert.equal(drill.explain.label, 'Total income');
  assert.deepEqual(drill.explain.accountIds, ['income-a', 'income-b']);
  assert.equal(drill.explain.startDate, '2026-03-01');
  assert.equal(drill.explain.endDate, '2026-03-31');
});

test('a balance as of a date keeps every entry up to that date, with no start', () => {
  const drill = statementTotalDrill({ name: 'Total assets', accountIds: ['cash'], expectedCents: 12345 + 2345 - 4000, sign: 1, endDate: '2026-03-31' }, entries);
  assert.ok(drill);
  assert.equal(drill.transactions.length, 3, 'the March sale, the March rent and the entry dated on the end day');
  assert.equal(drill.explain.startDate, undefined);
  assert.equal(drill.explain.endDate, '2026-03-31');
  assert.equal('startDate' in drill.explain, false, 'an absent start is not sent as an empty date');
});

test('a group with no accounts, or no matching entry, still opens nothing false', () => {
  assert.equal(statementTotalDrill({ name: 'Total income', accountIds: [], expectedCents: 0, sign: -1, ...march }, entries), null);
  assert.equal(statementTotalDrill({ name: 'Total income', accountIds: ['', ''], expectedCents: 0, sign: -1, ...march }, entries), null);
  const empty = statementTotalDrill({ name: 'Total equity', accountIds: ['equity-a'], expectedCents: 0, sign: -1, ...march }, entries);
  assert.ok(empty);
  assert.deepEqual(empty.transactions, [], 'no entries is an honest empty list, not a removed button');
  assert.deepEqual(empty.explain.accountIds, ['equity-a']);
});

test('one account counted once, a label filter and a missing list are handled', () => {
  const drill = statementTotalDrill({ name: 'Net income', accountIds: ['income-a', 'income-a', 'expense-a'], expectedCents: 8345, sign: 1, ...march, labelFilter: { dimensionId: 'location', value: 'Tel Aviv' } }, entries);
  assert.ok(drill);
  assert.deepEqual(drill.explain.accountIds, ['income-a', 'expense-a'], 'a repeated account is asked for once');
  assert.deepEqual(drill.explain.labelFilter, { dimensionId: 'location', value: 'Tel Aviv' });
  assert.deepEqual(entriesForAccounts(null, ['income-a'], march.startDate, march.endDate), []);
  assert.deepEqual(entriesForAccounts(undefined, ['income-a']), []);
  assert.deepEqual(accountIdsOf({ accounts: { 'income-a': {}, 'income-b': {} } }), ['income-a', 'income-b']);
  assert.deepEqual(accountIdsOf(undefined), []);
});

test('a simulation entry stays out of the entries behind a report figure', () => {
  const simulated = makeTransaction({ id: 'ghost-1', date: '2026-03-09', lines: [{ accountId: 'income-a', amountCents: -400 }] });
  assert.deepEqual(entriesForAccounts([...entries, simulated], ['income-a'], march.startDate, march.endDate).map(t => t.id), ['sale-1']);
});
