/**
 * Adding an entry at the top of the transaction list (I-22, I-23): the category comes from past
 * entries with a similar description, money in/out follows it, Enter saves a balanced entry.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InlineEntryRow from '../components/transactions/InlineEntryRow';
import { defaultBankAccount, descriptionKey, inlineEntry, suggestCategory } from '../lib/entrySuggestions';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { makeChartAccount, makeTransaction } from './fixtures';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import type { TransactionLine } from '../types';

const accounts = [
  makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'card', code: '1010', name: 'Card account', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'soft', code: '6200', name: 'Software', type: 'expense', category: 'Operating' }),
  makeChartAccount({ id: 'office', code: '6300', name: 'Office supplies', type: 'expense', category: 'Operating' }),
  makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income', category: 'Revenue' }),
];
const plain = (id: string, description: string, category: string, date: string, bank = 'bank', amount = 1000) => makeTransaction({
  id, description, date, status: 'completed', totalAmountCents: amount,
  lines: [{ id: `${id}a`, accountId: category, amountCents: amount }, { id: `${id}b`, accountId: bank, amountCents: -amount }],
});
const history = [
  plain('t1', 'AMAZON MKTP US*2K3', 'office', '2026-01-02'),
  plain('t2', 'AMAZON WEB SERVICES', 'soft', '2026-02-02'),
  plain('t3', 'Amazon Web Services 4411', 'soft', '2026-03-02'),
  plain('t4', 'GITHUB INC', 'soft', '2026-03-05', 'card'),
  plain('t5', 'Client payment ACME', 'sales', '2026-03-06'),
];

describe('Suggestions', () => {
  test('descriptions compare without numbers or punctuation', () => {
    assert.equal(descriptionKey('AMAZON MKTP US*2K3 4411'), 'amazon mktp us');
  });
  test('the account used most for the same description; else for the same first word', () => {
    assert.equal(suggestCategory('Amazon Web Services 9001', history, accounts)?.id, 'soft');
    assert.equal(suggestCategory('AMAZON MKTP US*7Z1', history, accounts)?.id, 'office');
    assert.equal(suggestCategory('Amazon Prime', history, accounts)?.id, 'soft', 'same first word: the most used');
    assert.equal(suggestCategory('Zoom', history, accounts), null);
    assert.equal(defaultBankAccount(history, accounts)?.id, 'bank');
  });
  test('money out: the category is debited, the bank credited; money in the other way', () => {
    const out = inlineEntry({ date: '2026-04-01', description: ' Pens ', amountCents: 1250, direction: 'out', category: accounts[3], bank: accounts[0] });
    assert.deepEqual(out.lines.map((l: TransactionLine) => [l.accountId, l.amountCents]), [['office', 1250], ['bank', -1250]]);
    assert.equal(out.description, 'Pens');
    const inn = inlineEntry({ date: '2026-04-01', description: 'Deposit', amountCents: 500, direction: 'in', category: accounts[4], bank: accounts[0] });
    assert.deepEqual(inn.lines.map((l: TransactionLine) => l.amountCents), [-500, 500]);
  });
});

describe('The row', () => {
  beforeEach(() => {
    setComponentWorkspace('bookkeeper');
    markComponentCollectionsLoaded('transactions', 'accounts');
    useLedgerStore.setState({ accounts, transactions: history, lockDate: null, lockException: null });
  });
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('type a description: the category and money in/out follow; Enter saves through the normal path and clears', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<InlineEntryRow />);
    fireEvent.change(screen.getByLabelText('Entry date'), { target: { value: '2026-04-02' } });
    fireEvent.change(screen.getByLabelText('What was it'), { target: { value: 'Client payment ACME' } });
    assert.equal((screen.getByLabelText('Category') as HTMLSelectElement).value, 'sales');
    assert.equal((screen.getByLabelText('Money in or out') as HTMLSelectElement).value, 'in');
    fireEvent.change(screen.getByLabelText('What was it'), { target: { value: 'Amazon Web Services' } });
    assert.equal((screen.getByLabelText('Category') as HTMLSelectElement).value, 'soft');
    assert.equal((screen.getByLabelText('Money in or out') as HTMLSelectElement).value, 'out');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '49.90' } });
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'Enter' }); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions')));
    const saved = (calls.find(c => c.url === '/api/v1/transactions')!.body as { transaction: { date: string; description: string; lines: TransactionLine[] } }).transaction;
    assert.deepEqual([saved.date, saved.description], ['2026-04-02', 'Amazon Web Services']);
    assert.deepEqual(saved.lines.map(l => [l.accountId, l.amountCents]), [['soft', 4990], ['bank', -4990]]);
    await waitFor(() => assert.equal((screen.getByLabelText('What was it') as HTMLInputElement).value, ''));
  });

  test('missing amount or category: says what is missing, saves nothing; a chosen category is kept while typing; viewers see no row', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<InlineEntryRow />);
    fireEvent.change(screen.getByLabelText('What was it'), { target: { value: 'Zoom' } });
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('What was it'), { key: 'Enter' }); });
    assert.match(screen.getByRole('alert').textContent || '', /amount/);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '15' } });
    await act(async () => { fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'Enter' }); });
    assert.match(screen.getByRole('alert').textContent || '', /category/);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'office' } });
    fireEvent.change(screen.getByLabelText('What was it'), { target: { value: 'Amazon Web Services' } });
    assert.equal((screen.getByLabelText('Category') as HTMLSelectElement).value, 'office', 'your choice wins');
    assert.equal(calls.filter(c => c.url === '/api/v1/transactions').length, 0);
    cleanup();
    setComponentWorkspace('viewer');
    render(<InlineEntryRow />);
    assert.equal(screen.queryByRole('group', { name: 'Add an entry' }), null);
  });
});
