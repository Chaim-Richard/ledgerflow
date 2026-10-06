/**
 * The Petty cash screen (A-3, K-31, AI #3): the box is one of the workspace's own cash accounts,
 * its balance is read from the ledger, and the three actions post one balanced entry each through
 * the ordinary server route. The maths and the refusals are tested in `src/tests/petty-cash.test.ts`;
 * here it is the screen — what it shows, what it sends to the server, and what a viewer may not do.
 *
 * `./helpers/dom` must be the first import (it registers jsdom before @testing-library/dom reads
 * `document`), and a DOM element is never asserted against null with `assert.equal` — see the note
 * at the top of `src/tests/cash-movement-ui.test.tsx`.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PettyCashView from '../components/finance/PettyCashView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount, makeTransaction } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetch, stubFetchWithBodies } from './helpers/dom';
import { getSupabase } from '../lib/db/client';
import type { TransactionLine } from '../types';

const accounts = [
  makeChartAccount({ id: 'box', code: '1015', name: 'Petty cash box', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'bank', code: '1010', name: 'Business Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'supplies', code: '6200', name: 'Office supplies', type: 'expense', category: 'Operating Expenses' }),
  makeChartAccount({ id: 'overshort', code: '6900', name: 'Cash over and short', type: 'expense', category: 'Operating Expenses' }),
];

/** $200.00 topped up on 2 March, $35.47 of stamps on 5 March: $164.53 in the box by the books. */
const ledger = [
  makeTransaction({
    id: 'tx-up', workspaceId: 'component-workspace', date: '2026-03-02',
    description: 'Petty cash top-up from Business Checking', totalAmountCents: 20_000,
    metadata: { pettyCash: 'top-up' },
    lines: [
      { id: 'l1', accountId: 'box', amountCents: 20_000, exchangeRate: 1 },
      { id: 'l2', accountId: 'bank', amountCents: -20_000, exchangeRate: 1 },
    ],
  }),
  makeTransaction({
    id: 'tx-spend', workspaceId: 'component-workspace', date: '2026-03-05',
    description: 'Petty cash: stamps', reference: 'PC-0041', totalAmountCents: 3_547,
    metadata: { pettyCash: 'spend' },
    lines: [
      { id: 'l1', accountId: 'supplies', amountCents: 3_547, exchangeRate: 1 },
      { id: 'l2', accountId: 'box', amountCents: -3_547, exchangeRate: 1 },
    ],
  }),
];

type Saved = { transaction: { date: string; description: string; reference?: string; totalAmountCents: number; lines: TransactionLine[]; metadata?: Record<string, unknown> } };
const posted = (calls: { url: string; method: string; body: unknown }[]): Saved['transaction'] => {
  const call = calls.find(c => c.url === '/api/v1/transactions' && c.method === 'POST');
  assert.ok(call, 'the entry is posted through the server, not just shown on screen');
  return (call!.body as Saved).transaction;
};

const chooseBox = () => fireEvent.change(screen.getByLabelText('Petty cash account'), { target: { value: 'box' } });
const section = (name: string) => within(screen.getByRole('region', { name }));

describe('Petty cash screen', () => {
  beforeEach(() => {
    localStorage.clear();
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts, transactions: ledger });
  });
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('the box shows what the ledger says is in it, and its movements, without fetching', () => {
    const urls = stubFetch(404, {});
    render(<PettyCashView />);
    assert.ok(screen.getByRole('heading', { level: 1, name: /Petty cash/ }));
    chooseBox();
    assert.ok(screen.getByText('$164.53'), 'the balance: $200.00 in, $35.47 out');
    const movements = screen.getByRole('region', { name: 'Latest movements of the petty cash box' });
    const rows = within(movements).getAllByRole('row').slice(1); // minus the header row
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent || '', /2026-03-05.*Petty cash: stamps.*PC-0041/, 'newest first');
    assert.match(rows[0].textContent || '', /35\.47/);
    assert.match(rows[1].textContent || '', /2026-03-02.*top-up.*200\.00/);
    assert.equal(movements.getAttribute('tabindex'), '0', 'the sideways-scrolling table is keyboard reachable');
    assert.equal(urls.length, 0, 'looking at the box never fetches or writes');
  });

  test('spending posts one balanced entry: the category debited, the box credited', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<PettyCashView />);
    chooseBox();
    const spend = section('Spend from petty cash');
    fireEvent.change(spend.getByLabelText('Amount'), { target: { value: '12.00' } });
    fireEvent.change(spend.getByLabelText('Category (expense account)'), { target: { value: 'supplies' } });
    fireEvent.change(spend.getByLabelText('Note'), { target: { value: 'stamps' } });
    fireEvent.change(spend.getByLabelText('Receipt number (optional)'), { target: { value: 'PC-0042' } });
    fireEvent.change(spend.getByLabelText('Date'), { target: { value: '2026-03-06' } });
    await act(async () => { fireEvent.click(spend.getByRole('button', { name: 'Record the spending' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions' && c.method === 'POST')));
    const saved = posted(calls);
    assert.equal(saved.date, '2026-03-06');
    assert.equal(saved.description, 'Petty cash: stamps');
    assert.equal(saved.reference, 'PC-0042', 'the receipt number rides on the reference');
    assert.equal(saved.totalAmountCents, 1_200);
    assert.deepEqual(saved.lines.map(l => [l.accountId, l.amountCents]), [['supplies', 1_200], ['box', -1_200]]);
    assert.deepEqual(saved.metadata, { pettyCash: 'spend' });
    assert.ok(await screen.findByText('$12.00 spent from Petty cash box on Office supplies.'));
  });

  test('a top-up is a transfer from the bank into the box', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<PettyCashView />);
    chooseBox();
    const topUp = section('Top up from bank');
    fireEvent.change(topUp.getByLabelText('Amount'), { target: { value: '50' } });
    fireEvent.change(topUp.getByLabelText('From bank account'), { target: { value: 'bank' } });
    fireEvent.change(topUp.getByLabelText('Date'), { target: { value: '2026-03-07' } });
    await act(async () => { fireEvent.click(topUp.getByRole('button', { name: 'Record the top-up' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions' && c.method === 'POST')));
    const saved = posted(calls);
    assert.equal(saved.totalAmountCents, 5_000);
    assert.deepEqual(saved.lines.map(l => [l.accountId, l.amountCents]), [['box', 5_000], ['bank', -5_000]]);
    assert.deepEqual(saved.metadata, { pettyCash: 'top-up' });
    assert.ok(await screen.findByText('$50.00 moved from Business Checking into Petty cash box.'));
  });

  test('a count that comes up short posts the difference to the over/short account', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<PettyCashView />);
    chooseBox();
    const count = section('Count the box');
    fireEvent.change(count.getByLabelText('Cash in the box (counted)'), { target: { value: '163.50' } });
    assert.ok(screen.getByText('$1.03 short of the $164.53 the books say.'), 'the difference is shown before anything posts');
    fireEvent.change(count.getByLabelText('Over/short account'), { target: { value: 'overshort' } });
    fireEvent.change(count.getByLabelText('Date'), { target: { value: '2026-03-31' } });
    await act(async () => { fireEvent.click(count.getByRole('button', { name: 'Record the count' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions' && c.method === 'POST')));
    const saved = posted(calls);
    assert.equal(saved.totalAmountCents, 103);
    assert.deepEqual(saved.lines.map(l => [l.accountId, l.amountCents]), [['overshort', 103], ['box', -103]]);
    assert.deepEqual(saved.metadata, { pettyCash: 'count', countedCents: 16_350, bookCents: 16_453 });
    assert.ok(await screen.findByText('Count recorded: $1.03 short, booked to Cash over and short.'));
  });

  test('counting exactly what the books say posts nothing', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<PettyCashView />);
    chooseBox();
    const count = section('Count the box');
    fireEvent.change(count.getByLabelText('Cash in the box (counted)'), { target: { value: '164.53' } });
    fireEvent.change(count.getByLabelText('Over/short account'), { target: { value: 'overshort' } });
    await act(async () => { fireEvent.click(count.getByRole('button', { name: 'Record the count' })); });
    assert.ok(await screen.findAllByText('The count agrees with the books — nothing to post.'));
    assert.equal(calls.filter(c => c.url === '/api/v1/transactions').length, 0, 'nothing was posted');
  });

  test('a viewer sees the balance and the movements, and none of the buttons', () => {
    stubFetch(404, {});
    setComponentWorkspace('viewer');
    render(<PettyCashView />);
    chooseBox();
    assert.ok(screen.getByText('$164.53'));
    assert.equal(screen.queryByRole('button', { name: 'Record the spending' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Record the top-up' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Record the count' }), null);
  });

  test('a workspace with no cash account is told to add one, never given an invented account', () => {
    stubFetch(404, {});
    useLedgerStore.setState({ accounts: accounts.filter(a => a.type === 'expense'), transactions: [] });
    render(<PettyCashView />);
    assert.ok(screen.getByRole('heading', { level: 1, name: /Petty cash/ }), 'the empty screen keeps its page heading');
    assert.ok(screen.getByText(/Add one in the chart of accounts/));
  });
});
