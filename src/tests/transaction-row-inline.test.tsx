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
import { VirtualRow, type VirtualRowProps } from '../components/ledger/TransactionGridShared';
import { categoryChoices, descriptionSuggestions, recategorizeLines, soleCategoryLine } from '../lib/accountChoices';
import { amountChange, isDocumentEntry, isHandEntered } from '../lib/transactionEdits';
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
    assert.equal(screen.queryByRole('button', { name: /^Edit (Category|Class|Location|Date|Amount|Description) of GitHub/ }), null);
  });
});

describe('Transaction list: date, description and amount in place', () => {
  const income = makeTransaction({ id: 't3', date: '2026-05-03', description: 'Client deposit', totalAmountCents: 9000, status: 'completed',
    lines: [{ id: 'a', accountId: 'bank', amountCents: 9000 }, { id: 'b', accountId: 'soft', amountCents: -9000 }] });
  const invoicePayment = makeTransaction({ ...plain, id: 't4', description: 'Payment INV-7', metadata: { invoiceId: 'inv-7', paymentId: 'p1' } });
  beforeEach(() => useLedgerStore.setState({ accounts, transactions: [plain, split, income, invoicePayment], lockDate: null, lockException: null }));
  afterEach(() => cleanup());

  test('a new amount keeps the entry balanced and an expense an expense, an income an income', () => {
    assert.deepEqual(amountChange(plain, 3050), { lines: [{ ...plain.lines[0], amountCents: 3050 }, { ...plain.lines[1], amountCents: -3050 }], totalAmountCents: 3050 });
    assert.deepEqual(amountChange(income, 100)?.lines.map(l => l.amountCents), [100, -100]);
    assert.deepEqual(amountChange({ ...income, lines: [income.lines[1], income.lines[0]] }, 100)?.lines.map(l => [l.accountId, l.amountCents]), [['soft', -100], ['bank', 100]]);
  });

  test('refused: a split, an entry behind an invoice, payment or bank line, another currency, a transfer, zero or a fraction of a cent', () => {
    assert.equal(amountChange(split, 100), null);
    assert.equal(amountChange(invoicePayment, 100), null);
    assert.equal(amountChange({ ...plain, originalCurrency: 'EUR', exchangeRate: 1.1 }, 100), null);
    assert.equal(amountChange({ ...plain, isTransfer: true }, 100), null);
    assert.equal(amountChange({ ...plain, metadata: { bankLineId: 'bl1' } }, 100), null, 'the bank statement says how much');
    assert.equal(amountChange(plain, 0), null);
    assert.equal(amountChange(plain, 10.5), null);
    assert.equal(isHandEntered(plain), true);
    assert.equal(isHandEntered({ ...plain, metadata: { importBatchId: 'b1' } }), true, 'an imported entry is still typed in');
    assert.equal(isHandEntered(invoicePayment), false);
    assert.equal(isDocumentEntry(invoicePayment), true);
    assert.equal(isDocumentEntry({ metadata: { bankLineId: 'bl1' } }), false, 'a bank line alone: the category can still change');
    assert.equal(isDocumentEntry({ metadata: { type: 'depreciation' } }), true);
    assert.equal(isDocumentEntry({ metadata: { isReversal: true } }), true);
    assert.equal(isDocumentEntry({ metadata: { cogsPending: false, notes: 'x' } }), false);
  });

  test('description suggestions: the workspace\'s own, the most used first, one list for every row', () => {
    const txs = [plain, { ...plain, id: 'x' }, split, { ...split, id: 'y', description: ' github ' }, { ...split, id: 'z', description: '' }];
    assert.deepEqual(descriptionSuggestions(txs), ['GitHub', 'Mixed']);
    assert.equal(descriptionSuggestions(txs), descriptionSuggestions(txs));
  });

  test('type a new amount, date or description on a typed-in entry', async () => {
    const updates: Array<Partial<Transaction>> = [];
    row(plain, (_id, u) => updates.push(u));
    const edit = async (name: string, value: string) => {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${name} of GitHub` }));
      fireEvent.change(screen.getByLabelText(`${name} of GitHub`), { target: { value } });
      await act(async () => { fireEvent.keyDown(screen.getByLabelText(`${name} of GitHub`), { key: 'Enter' }); });
    };
    await edit('Amount', '30.50');
    assert.deepEqual([updates[0].totalAmountCents, updates[0].lines?.map(l => [l.accountId, l.amountCents])], [3050, [['soft', 3050], ['bank', -3050]]]);
    await edit('Date', '2026-05-09');
    assert.deepEqual(updates[1], { date: '2026-05-09' });
    await edit('Description', 'GitHub Copilot');
    assert.deepEqual(updates[2], { description: 'GitHub Copilot' });
    await edit('Amount', '0');
    assert.equal(updates.length, 3, 'zero is refused');
    assert.ok(screen.getByText('Enter an amount above 0'));
  });

  test('an entry behind an invoice payment: description only; a bank-line entry: category but not amount; a split: date but no amount', () => {
    row(invoicePayment, () => {});
    assert.equal(screen.queryByRole('button', { name: 'Edit Amount of Payment INV-7' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Edit Date of Payment INV-7' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Edit Category of Payment INV-7' }), null, 'its receivable side stays');
    assert.ok(screen.getByRole('button', { name: 'Edit Description of Payment INV-7' }));
    cleanup();
    row({ ...plain, metadata: { bankLineId: 'bl1' } }, () => {});
    assert.ok(screen.getByRole('button', { name: 'Edit Category of GitHub' }));
    assert.equal(screen.queryByRole('button', { name: 'Edit Amount of GitHub' }), null);
    cleanup();
    row(split, () => {});
    assert.equal(screen.queryByRole('button', { name: 'Edit Amount of Mixed' }), null);
    assert.ok(screen.getByRole('button', { name: 'Edit Date of Mixed' }));
  });
});

describe('Keyboard editors in the list (Enter on a cell)', () => {
  afterEach(() => cleanup());
  const grid = (tx: Transaction, field: string, onUpdate: (id: string, u: Partial<Transaction>) => void) => {
    const data = {
      transactions: [{ ...tx, balanceCents: 0 }], selectedIds: new Set<string>(), focusedCell: null, editingCell: { id: tx.id, field },
      anomalyMap: new Map(), deterministicConflicts: new Map(), onToggleSelection: () => {}, onVoid: () => {}, onUpdate, onCreateRule: () => {},
      onProjectClick: () => {}, setSplittingTxId: () => {}, setFocusedCell: () => {}, setEditingCell: () => {}, isProMode: false, isCompactMode: false,
      isMobileGrid: false, isTabletGrid: false, onToggleFlag: () => {}, onDuplicate: () => {}, dateFormat: 'YYYY-MM-DD', formatCurrency: (c: number) => String(c),
      gridCols: '1fr', hiddenColumns: new Set<string>(), searchTerm: '',
    } as unknown as VirtualRowProps['data'];
    return render(<VirtualRow index={0} style={{}} data={data} />);
  };
  const type = async (label: string, value: string) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await act(async () => { fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' }); });
  };

  test('a new account changes the category side, never the bank line, even when the bank line is stored first (L-182)', async () => {
    useLedgerStore.setState({ accounts, transactions: [] });
    const bankFirst = makeTransaction({ ...plain, lines: [plain.lines[1], plain.lines[0]] });
    const updates: Array<Partial<Transaction>> = [];
    grid(bankFirst, 'category', (_id, u) => updates.push(u));
    assert.equal((screen.getByLabelText('Transaction account') as HTMLInputElement).value, 'Software', 'starts from the category, not the bank');
    await type('Transaction account', 'Rent');
    assert.deepEqual(updates[0].lines?.map(l => [l.accountId, l.amountCents]), [['bank', -2500], ['rent', 2500]]);
  });

  test('an entry from an invoice payment keeps its accounts and amount; a typed-in one gets the new amount', async () => {
    useLedgerStore.setState({ accounts, transactions: [] });
    const updates: Array<Partial<Transaction>> = [];
    const payment = makeTransaction({ ...plain, id: 'p', metadata: { invoiceId: 'inv-7' } });
    grid(payment, 'category', (_id, u) => updates.push(u));
    await type('Transaction account', 'Rent');
    cleanup();
    grid(payment, 'amountCents', (_id, u) => updates.push(u));
    await type('Transaction amount', '99');
    assert.equal(updates.length, 0);
    cleanup();
    grid(plain, 'amountCents', (_id, u) => updates.push(u));
    await type('Transaction amount', '40');
    assert.deepEqual(updates[0].lines?.map(l => l.amountCents), [4000, -4000]);
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
