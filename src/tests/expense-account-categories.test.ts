import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseAccountCategories, billsInExpenseCategory, UNMAPPED_BILL_CATEGORY } from '../lib/expenseAccountCategories';
import { makeBill, makeChartAccount } from './fixtures';

const accounts = [
  makeChartAccount({ id: 'office', workspaceId: 'ws-1', name: 'Office supplies', code: '6100', type: 'expense' }),
  makeChartAccount({ id: 'shipping', workspaceId: 'ws-1', name: 'Shipping', code: '6200', type: 'expense', isArchived: true }),
  makeChartAccount({ id: 'inventory', workspaceId: 'ws-1', name: 'Inventory cost', code: '5100', type: 'cost_of_goods' }),
  makeChartAccount({ id: 'cash', workspaceId: 'ws-1', name: 'Bank', code: '1000', type: 'asset' }),
  makeChartAccount({ id: 'foreign', workspaceId: 'ws-2', name: 'Office supplies', code: '6100', type: 'expense' }),
];
const bills = [
  makeBill({ id: 'b1', workspaceId: 'ws-1', date: '2026-03-15', number: 'B1',
    splits: [{ accountId: 'office', amountCents: 3000 }, { accountId: 'shipping', amountCents: 2000 }, { accountId: 'office', amountCents: 1000 }] }),
  makeBill({ id: 'b2', workspaceId: 'ws-1', date: '2026-03-20', number: 'B2',
    splits: [{ accountId: 'inventory', amountCents: 5000 }] }),
  makeBill({ id: 'b3', workspaceId: 'ws-1', date: '2026-03-22', number: 'B3',
    splits: [] }),
  makeBill({ id: 'b4', workspaceId: 'ws-1', date: '2026-03-23', number: 'B4',
    splits: [{ accountId: 'cash', amountCents: 5000 }] }),
  makeBill({ id: 'b5', workspaceId: 'ws-1', date: '2025-12-31', number: 'B5',
    splits: [{ accountId: 'office', amountCents: 1500 }] }),
  makeBill({ id: 'b6', workspaceId: 'ws-2', date: '2026-03-20', number: 'B6',
    splits: [{ accountId: 'office', amountCents: 9000 }, { accountId: 'foreign', amountCents: 9000 }] }),
];

test('E-22 category list maps to actual workspace accounts and counts each split bill only once', () => {
  const before = JSON.stringify({ accounts, bills });
  const summary = expenseAccountCategories(accounts, bills, 'ws-1', '2026-01-01', '2026-12-31');
  assert.deepEqual(summary.categories.map(c => [c.accountId, c.billCount]), [
    ['inventory', 1], ['office', 1], ['shipping', 1],
  ]);
  assert.equal(summary.billCount, 4, 'period and workspace exclude old and foreign bills');
  assert.equal(summary.withoutCategoryCount, 2, 'missing/asset-only splits do not invent expense accounts');
  assert.equal(summary.categories.find(c => c.accountId === 'shipping')?.archived, true);
  assert.equal(JSON.stringify({ accounts, bills }), before, 'read-only: no source mutation');
});

test('E-22 filters multiple category matches and unmatched bills by real account IDs', () => {
  const filtered = (value: string) => billsInExpenseCategory(bills, accounts, 'ws-1', value, '2026-01-01', '2026-12-31').map(b => b.id);
  assert.deepEqual(filtered('office'), ['b1']);
  assert.deepEqual(filtered('shipping'), ['b1'], 'historic archived account is still searchable');
  assert.deepEqual(filtered('inventory'), ['b2']);
  assert.deepEqual(filtered(UNMAPPED_BILL_CATEGORY), ['b3', 'b4']);
  assert.deepEqual(filtered(''), ['b1', 'b2', 'b3', 'b4']);
  assert.deepEqual(filtered('foreign'), [], 'a foreign-workspace account cannot authorize a match');
  assert.deepEqual(filtered('missing'), [], 'unknown category does not silently match everything');
});

test('E-22 missing date excludes bill from selected period; no workspace never returns records', () => {
  const noDate = makeBill({ id: 'no-date', date: undefined, issueDate: undefined,
    splits: [{ accountId: 'office', amountCents: 100 }] });
  assert.deepEqual(billsInExpenseCategory([noDate], accounts, 'ws-1', 'office', '2026-01-01', '2026-12-31'), []);
  assert.deepEqual(billsInExpenseCategory([noDate], accounts, 'ws-1', 'office').map(b => b.id), ['no-date']);
  assert.equal(expenseAccountCategories(accounts, bills, '').billCount, 0);
  assert.deepEqual(billsInExpenseCategory(bills, accounts, '', ''), []);
});
