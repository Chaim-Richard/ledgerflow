/**
 * Transaction list, edit in place (I-22 I-23): the category of a plain entry (accounts used most
 * first), and class / location on every line; locked or split entries are not changed here.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TransactionRow from '../components/transactions/TransactionRow';
import SelectionBar from '../components/transactions/SelectionBar';
import { categoryChoices, recategorizeLines, soleCategoryLine } from '../lib/accountChoices';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Transaction } from '../types';
import { makeChartAccount, makeTransaction } from './fixtures';

const accounts = [
  makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'soft', code: '6200', name: 'Software', type: 'expense' }),
  makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense' }),
  makeChartAccount({ id: 'old', code: '6900', name: 'Old', type: 'expense', isArchived: true }),
];
const plain = makeTransaction({ id: 't1', date: '2026-05-01', description: 'GitHub', totalAmountCents: 2500, status: 'completed',
  lines: [{ id: 'a', accountId: 'soft', accountName: 'Software', amountCents: 2500 }, { id: 'b', accountId: 'bank', accountName: 'Checking', amountCents: -2500 }] });
const split = makeTransaction({ id: 't2', date: '2026-05-02', description: 'Mixed', totalAmountCents: 3000, status: 'completed',
  lines: [{ id: 'a', accountId: 'soft', amountCents: 1000 }, { id: 'b', accountId: 'rent', amountCents: 2000 }, { id: 'c', accountId: 'bank', amountCents: -3000 }] });

const row = (tx: Transaction, onUpdate: (id: string, u: Partial<Transaction>) => void) => render(
  <TransactionRow tx={{ ...tx, balanceCents: 0 }} isSelected={false} isSetA={false} isSetB={false} isFocused={false} isEven focusedField={null}
    onToggleSelection={() => {}} onVoid={() => {}} onUpdate={onUpdate} onCreateRule={() => {}} onProjectClick={() => {}} onSplit={() => {}}
    formatCurrency={c => String(c)} gridColumns="1fr" />,
);

describe('Transaction list: edit in place', () => {
  beforeEach(() => useLedgerStore.setState({ accounts, transactions: [plain, split], lockDate: null, lockException: null }));
  afterEach(() => cleanup());

  test('category choices: no bank accounts or archived ones, the most used first', () => {
    assert.deepEqual(categoryChoices(accounts, [plain, split]).map(c => c.value), ['soft', 'rent']);
    const txs = [plain, split];
    assert.equal(categoryChoices(accounts, txs), categoryChoices(accounts, txs), 'one sort shared by every row');
    assert.equal(soleCategoryLine(plain, accounts)?.id, 'a');
    assert.equal(soleCategoryLine(split, accounts), undefined);
  });

  test('change the category of a plain entry: the other line stays', async () => {
    const updates: Array<Partial<Transaction>> = [];
    row(plain, (_id, u) => updates.push(u));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Category of GitHub' }));
    fireEvent.change(screen.getByLabelText('Category of GitHub'), { target: { value: 'rent' } });
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('Category of GitHub'), { key: 'Enter' }); });
    assert.deepEqual(updates[0].lines?.map(l => [l.accountId, l.accountName, l.amountCents]), [['rent', 'Rent', 2500], ['bank', 'Checking', -2500]]);
  });

  test('class is set on every line; a split entry has no category box; a locked period edits nothing', async () => {
    const updates: Array<Partial<Transaction>> = [];
    row(split, (_id, u) => updates.push(u));
    assert.equal(screen.queryByRole('button', { name: 'Edit Category of Mixed' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Class of Mixed' }));
    fireEvent.change(screen.getByLabelText('Class of Mixed'), { target: { value: 'Retail' } });
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('Class of Mixed'), { key: 'Enter' }); });
    assert.deepEqual(updates[0].lines?.map(l => l.class), ['Retail', 'Retail', 'Retail']);
    cleanup();
    useLedgerStore.setState({ lockDate: '2026-12-31' });
    row(plain, (_id, u) => updates.push(u));
    assert.equal(screen.queryByRole('button', { name: /^Edit (Category|Class|Location) of GitHub/ }), null);
  });
});

describe('Bulk categorize (K-06)', () => {
  test('only the category line changes, whichever order the lines are in; the bank line never does', () => {
    const bankFirst = [{ id: 'b', accountId: 'bank', accountName: 'Checking', amountCents: -2500 }, { id: 'a', accountId: 'soft', accountName: 'Software', amountCents: 2500 }];
    const out = recategorizeLines(bankFirst, accounts, { accountId: 'rent', accountName: 'Rent' });
    assert.deepEqual(out?.map(l => [l.accountId, l.amountCents]), [['bank', -2500], ['rent', 2500]]);
    const splitOut = recategorizeLines(split.lines, accounts, { accountId: 'rent' });
    assert.deepEqual(splitOut?.map(l => l.accountId), ['rent', 'rent', 'bank'], 'a split becomes one category; the bank line stays');
  });

  test('transfers and journal entries are skipped for a new account; a project goes on every line', () => {
    const transfer = [{ accountId: 'bank', amountCents: -100 }, { accountId: 'bank2', amountCents: 100 }];
    const withSavings = [...accounts, makeChartAccount({ id: 'bank2', name: 'Savings', type: 'asset', category: 'Cash' })];
    assert.equal(recategorizeLines(transfer, withSavings, { accountId: 'rent' }), null);
    const journal: Array<{ accountId: string; amountCents: number; project?: string }> = [{ accountId: 'soft', amountCents: 100 }, { accountId: 'rent', amountCents: -100 }];
    assert.equal(recategorizeLines(journal, accounts, { accountId: 'rent' }), null);
    assert.deepEqual(recategorizeLines(journal, accounts, { project: 'Apollo' })?.map(l => [l.accountId, l.project]), [['soft', 'Apollo'], ['rent', 'Apollo']]);
  });
});

describe('Bulk bar', () => {
  afterEach(() => cleanup());
  test('nothing is applied while typing; Enter or Apply applies the chosen category', async () => {
    useLedgerStore.setState({ accounts, transactions: [plain, split] });
    const applied: unknown[] = [];
    render(<SelectionBar selectedCount={2} totalAmount={5500} avgAmount={2750} onCopy={() => {}} onClear={() => {}}
      onBulkUpdate={u => { applied.push(u); }} accounts={accounts} formatCurrency={c => String(c)} />);
    const box = screen.getByLabelText('Bulk Categorize');
    fireEvent.change(box, { target: { value: 'Rent' } });
    assert.equal(applied.length, 0, 'typing a full name does not apply yet');
    await act(async () => { fireEvent.keyDown(box, { key: 'Enter' }); });
    assert.deepEqual(applied, [{ accountId: 'rent' }]);
    fireEvent.change(box, { target: { value: '6200 · Software' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply' })); });
    assert.deepEqual(applied[1], { accountId: 'soft' });
    fireEvent.change(box, { target: { value: 'Checking' } });
    assert.equal((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled, true, 'a bank account is not a category');
  });
});
