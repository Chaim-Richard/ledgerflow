/**
 * The Money In / Money Out dialogs on the banking page (BA-17): what they offer, what they post, and
 * what they refuse to post. The rules themselves are in `src/lib/cashMovement.ts` and tested there;
 * here it is the page — the questions it asks, the entry that goes to the server, and the words that
 * stand in for a button someone may not press.
 *
 * Two traps for the next jsdom test, both paid for here: `./helpers/dom` must be the first import in
 * the file — @testing-library/dom takes `document` from the global when it loads, so importing it
 * before jsdom is registered leaves every `screen` query saying there is no document (and `render`
 * still works, which makes it look like something else). And never assert an element against null with
 * `assert.equal(el, null)`:
 * On failure node prints the element, which walks the whole document, and the test process dies out of
 * memory without a message. Compare it yourself: `assert.ok(el === null, 'why')`.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CashMovementDialog from '../components/banking/CashMovementDialog';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount } from './fixtures';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { getSupabase } from '../lib/db/client';
import type { TransactionLine } from '../types';

type Saved = { transaction: { date: string; description: string; currency: string; totalAmountCents: number; reference?: string; lines: TransactionLine[] } };

const accounts = [
  makeChartAccount({ id: 'checking', name: 'Business Checking', code: '1000', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'petty', name: 'Petty Cash', code: '1010', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'ar', name: 'Accounts Receivable', code: '1200', type: 'asset', category: 'Accounts Receivable' }),
  makeChartAccount({ id: 'deposits', name: 'Customer Deposits', code: '2100', type: 'liability', category: 'Current Liabilities' }),
  makeChartAccount({ id: 'rent', name: 'Rent', code: '6100', type: 'expense', category: 'Operating Expenses' }),
  makeChartAccount({ id: 'sales', name: 'Sales of Services', code: '4000', type: 'revenue', category: 'Sales' }),
];

const open = (direction: 'in' | 'out') => render(<CashMovementDialog isOpen direction={direction} onClose={() => {}} />);
const optionsOf = (label: string) => Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map(o => o.textContent || '');
const posted = (calls: { url: string; method: string; body: unknown }[]): Saved['transaction'] => {
  const call = calls.find(c => c.url === '/api/v1/transactions' && c.method === 'POST');
  assert.ok(call, 'the entry is saved through the server, not just on screen');
  return (call!.body as Saved).transaction;
};

describe('Money In / Money Out on the banking page', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('transactions', 'accounts');
    useLedgerStore.setState({ accounts, transactions: [], customers: [{ id: 'c1', name: 'Acme Ltd' }], vendors: [{ id: 'v1', name: 'Landlord Inc' }] } as never);
  });
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('money in is posted as one balanced entry: the account against what it is for', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    open('in');
    assert.equal(screen.getByRole('heading', { name: 'Money In' }).textContent, 'Money In');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '125.50' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Money goes into'), { target: { value: 'checking' } });
    fireEvent.change(screen.getByLabelText('What is it for?'), { target: { value: 'sales' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record money in' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions' && c.method === 'POST')));
    const saved = posted(calls);
    assert.equal(saved.date, '2026-10-05');
    assert.equal(saved.currency, 'USD');
    assert.equal(saved.totalAmountCents, 12550, 'the amount of the entry is what came in, not the sum of the lines');
    assert.deepEqual(saved.lines.map(l => [l.accountId, l.amountCents]), [['checking', 12550], ['sales', -12550]]);
    assert.ok(await screen.findByText(/Money received: \$125\.50 into Business Checking\./));
  });

  test('money out asks the other questions and posts the mirrored entry', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    open('out');
    assert.ok(screen.queryByRole('button', { name: 'Record money in' }) === null, 'money out has its own button');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '900' } });
    fireEvent.change(screen.getByLabelText('Money comes out of'), { target: { value: 'checking' } });
    fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value: 'rent' } });
    fireEvent.change(screen.getByLabelText('Who you paid (optional)'), { target: { value: 'Landlord Inc' } });
    fireEvent.change(screen.getByLabelText('Cheque or bank reference (optional)'), { target: { value: '1042' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record money out' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions' && c.method === 'POST')));
    const saved = posted(calls);
    assert.deepEqual(saved.lines.map(l => [l.accountId, l.amountCents]), [['checking', -90000], ['rent', 90000]]);
    assert.equal(saved.description, 'Money paid to Landlord Inc', 'the name goes in the description, not a link to the contact');
    assert.equal(saved.reference, '1042');
  });

  test('what the money was for cannot be another of your own accounts, or what settles a document', () => {
    open('in');
    const offered = optionsOf('What is it for?');
    assert.ok(offered.some(o => /Sales of Services/.test(o)) && offered.some(o => /Customer Deposits/.test(o)), 'income, expense and money held for someone are all recordable');
    assert.ok(!offered.some(o => /Petty Cash|Business Checking/.test(o)), 'money between two of your own accounts is the transfer dialog');
    assert.ok(!offered.some(o => /Accounts Receivable/.test(o)), 'money that settles an invoice is recorded on the invoice');
    assert.deepEqual(optionsOf('Money goes into'), ['Choose an account…', '1000 · Business Checking', '1010 · Petty Cash'], 'only accounts money sits in');
  });

  test('an unfinished pair says what is missing, and posts nothing until it is finished', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    open('in');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Money goes into'), { target: { value: 'checking' } });
    assert.match(screen.getByRole('status').textContent || '', /what the money is for/, 'it says what it needs instead of guessing');
    assert.equal((screen.getByRole('button', { name: 'Record money in' }) as HTMLButtonElement).disabled, true, 'and it will not post half a thing');
    fireEvent.change(screen.getByLabelText('What is it for?'), { target: { value: 'sales' } });
    assert.ok(screen.queryByRole('status') === null, 'the words go away once it is a whole pair');
    assert.equal((screen.getByRole('button', { name: 'Record money in' }) as HTMLButtonElement).disabled, false);
    assert.equal(calls.filter(c => c.url === '/api/v1/transactions').length, 0, 'nothing was posted while it was refused');
  });

  test('with no amount at all there is no way to post', () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    open('in');
    assert.equal((screen.getByRole('button', { name: 'Record money in' }) as HTMLButtonElement).disabled, true);
    assert.ok(screen.queryByRole('status') === null, 'an empty form is not an error yet');
    assert.equal(calls.filter(c => c.url === '/api/v1/transactions').length, 0);
  });

  test('a word the workspace has used before is offered, and what is typed wins', async () => {
    useLedgerStore.setState({ transactions: [{ id: 'old', date: '2026-09-01', description: 'October workshop', totalAmountCents: 100, status: 'completed', lines: [] }] } as never);
    open('in');
    assert.ok(Array.from(document.querySelectorAll('#lf-cash-movement-descriptions option')).some(o => (o as HTMLOptionElement).value === 'October workshop'), 'the workspace’s own words are suggested');
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Money goes into'), { target: { value: 'checking' } });
    fireEvent.change(screen.getByLabelText('What is it for?'), { target: { value: 'sales' } });
    fireEvent.change(screen.getByLabelText('What to call it (optional)'), { target: { value: 'October workshop' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record money in' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions' && c.method === 'POST')));
    const saved = posted(calls);
    assert.equal(saved.description, 'October workshop');
    assert.equal(saved.lines[1].description, 'October workshop', 'the account it is for is what the workspace learns from');
    assert.ok(saved.lines[0].description === undefined, 'not the bank account');
  });

  test('someone who only reads is told who records money, and given no button', () => {
    setComponentWorkspace('viewer');
    open('in');
    assert.ok(screen.queryByRole('button', { name: 'Record money in' }) === null);
    assert.match(screen.getByText(/You can look, not post\./).textContent || '', /records money in and out/);
  });
});
