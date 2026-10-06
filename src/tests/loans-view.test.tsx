/**
 * The Loans screen (A-2, K-30, AI #3): what it shows of a loan, what "Record payment" posts, and
 * what a viewer may not do. The schedule maths is tested in `src/tests/loans.test.ts`; here it is
 * the screen — the split it shows, the one balanced entry that goes to the server, the date the
 * entry carries, and the ledger-vs-schedule line.
 *
 * `./helpers/dom` must be the first import (it registers jsdom before @testing-library/dom reads
 * `document`), and a DOM element is never asserted against null with `assert.equal` — see the note
 * at the top of `src/tests/cash-movement-ui.test.tsx`.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoansView from '../components/finance/LoansView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount, makeTransaction } from './fixtures';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetch, stubFetchWithBodies } from './helpers/dom';
import { getSupabase } from '../lib/db/client';
import type { Loan } from '../lib/loans';
import type { TransactionLine } from '../types';

const accounts = [
  makeChartAccount({ id: 'bank', code: '1010', name: 'Business Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'loan', code: '2500', name: 'Bank loans', type: 'liability', category: 'Long-term Liabilities' }),
  makeChartAccount({ id: 'interest', code: '6100', name: 'Interest expense', type: 'expense', category: 'Operating Expenses' }),
];

/** $1,200 over 3 months at 12% a year: 40,803¢ a month, last payment 40,802¢. */
const loan: Loan = {
  id: 'loan-1',
  uid: 'test-user',
  workspaceId: 'component-workspace',
  lender: 'Northwind Bank',
  principalCents: 120_000,
  annualRate: 0.12,
  termMonths: 3,
  startDate: '2026-01-31',
  firstPaymentDate: '2026-02-28',
  liabilityAccountId: 'loan',
  interestAccountId: 'interest',
  bankAccountId: 'bank',
  currency: 'USD',
  reference: 'LOAN-ABCD1234',
  payments: [],
};

const postedTransaction = (lines: { accountId: string; amountCents: number }[], reference = loan.reference) => makeTransaction({
  id: 'tx-loan-1',
  workspaceId: 'component-workspace',
  date: '2026-01-31',
  description: 'Loan from Northwind Bank',
  reference,
  totalAmountCents: 120_000,
  lines: lines.map(l => ({ id: `line-${l.accountId}`, accountId: l.accountId, amountCents: l.amountCents })),
});

type Saved = { transaction: { date: string; reference?: string; totalAmountCents: number; lines: TransactionLine[] } };
const posted = (calls: { url: string; method: string; body: unknown }[]): Saved['transaction'] => {
  const call = calls.find(c => c.url === '/api/v1/transactions' && c.method === 'POST');
  assert.ok(call, 'the entry is posted through the server, not just shown on screen');
  return (call!.body as Saved).transaction;
};

describe('Loans screen', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('loans');
    useLedgerStore.setState({ accounts, loans: [loan], transactions: [] });
  });
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('a loan shows its schedule to the cent and the balance the ledger says is owed', () => {
    const urls = stubFetch(404, {});
    render(<LoansView />);
    assert.ok(screen.getByRole('heading', { name: /Northwind Bank/ }));
    assert.ok(screen.getByText(/\$1,200\.00 from Northwind Bank at 12% a year, 3 monthly payments\. \$1,200\.00 still owed\./));
    // the three payments, split: interest first, principal second, balance after
    for (const amount of ['$408.03', '$12.00', '$396.03', '$803.97', '$8.04', '$399.99', '$403.98', '$408.02', '$4.04']) {
      assert.ok(screen.getAllByText(amount).length > 0, `the schedule shows ${amount}`);
    }
    assert.ok(screen.getByText(/\$1,224\.08/), 'the total paid over the term');
    assert.ok(screen.getByText(/\$24\.08/), 'the total interest over the term');
    assert.ok(screen.getByText('Nothing from this loan is in the ledger yet; the schedule above is what will be posted.'));
    assert.equal(urls.length, 0, 'looking at the schedule never fetches or writes');
  });

  test('Record payment posts one balanced entry: principal and interest against the bank', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<LoansView />);
    const button = screen.getByRole('button', { name: 'Record payment' });
    fireEvent.change(screen.getByLabelText('Payment date'), { target: { value: '2026-02-28' } });
    await act(async () => { fireEvent.click(button); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions' && c.method === 'POST')));
    const saved = posted(calls);
    assert.equal(saved.date, '2026-02-28');
    assert.equal(saved.reference, 'LOAN-ABCD1234', 'the entry carries the loan reference, so the balance can be read back');
    assert.equal(saved.totalAmountCents, 40_803, 'the entry is the payment, not the sum of the debits');
    assert.deepEqual(saved.lines.map(l => [l.accountId, l.amountCents]), [
      ['loan', 39_603], ['interest', 1_200], ['bank', -40_803],
    ]);
    assert.ok(await screen.findByText('Payment 1 of 3 recorded: $396.03 off the loan, $12.00 interest.'));
  });

  test('the money arriving is posted once, and only until it is in the books', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<LoansView />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Record the \$1,200\.00 arriving/ })); });
    await waitFor(() => assert.ok(calls.some(c => c.url === '/api/v1/transactions' && c.method === 'POST')));
    const saved = posted(calls);
    assert.equal(saved.date, '2026-01-31', 'the day the money arrived');
    assert.deepEqual(saved.lines.map(l => [l.accountId, l.amountCents]), [['bank', 120_000], ['loan', -120_000]]);
    assert.equal(saved.lines[0].description, undefined, 'the bank line stays plain');
    assert.equal(saved.lines[1].description, 'Loan from Northwind Bank', 'the liability line says where the money came from');

    cleanup();
    useLedgerStore.setState({ transactions: [postedTransaction([{ accountId: 'bank', amountCents: 120_000 }, { accountId: 'loan', amountCents: -120_000 }])] });
    render(<LoansView />);
    assert.ok(screen.getByText('In the books'));
    assert.ok(screen.queryByRole('button', { name: /arriving/ }) === null, 'money that is already in the books is not posted twice');
  });

  test('a viewer reads the schedule and is offered no posting at all', () => {
    cleanup();
    setComponentWorkspace('viewer');
    markComponentCollectionsLoaded('loans');
    useLedgerStore.setState({ accounts, loans: [loan], transactions: [] });
    stubFetch(404, {});
    render(<LoansView />);
    assert.ok(screen.getAllByText(/Northwind Bank/).length > 0);
    assert.ok(screen.queryByRole('button', { name: 'Record payment' }) === null);
    assert.ok(screen.queryByRole('button', { name: /arriving/ }) === null);
    assert.ok(screen.queryByRole('button', { name: 'Add a loan' }) === null);
  });
});
