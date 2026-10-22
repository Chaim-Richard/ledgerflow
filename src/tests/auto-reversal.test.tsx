/**
 * Entries that undo themselves (R-05): a month-end accrual is posted with its mirror on the 1st of
 * the next month, in one request, so the real bill can be booked without counting the cost twice.
 * The database part needs LF_TEST_DATABASE_URL.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import JournalEntryModal from '../components/ledger/JournalEntryModal';
import { firstOfNextMonth, reversalDateProblem, withReversal } from '../lib/autoReversal';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount } from './fixtures';
import type { Firestore } from '../server/db/pgFirestore';

const realFetch = globalThis.fetch;

describe('The reversal', () => {
  test('on the 1st of the next month, December into January', () => {
    assert.deepEqual(['2026-09-30', '2026-12-31', '2026-02-28'].map(firstOfNextMonth), ['2026-10-01', '2027-01-01', '2026-03-01']);
  });

  test('must come after the entry', () => {
    assert.equal(reversalDateProblem('2026-09-30', '2026-10-01'), null);
    assert.match(reversalDateProblem('2026-09-30', '2026-09-30') || '', /after the entry/);
    assert.match(reversalDateProblem('2026-09-30', '') || '', /Choose the date/);
  });

  test('every line negated, both entries point at each other', () => {
    const [entry, reversal] = withReversal({ id: 'je1', date: '2026-09-30', description: 'Electricity accrual', lines: [{ accountId: 'power', amountCents: 21000 }, { accountId: 'accrued', amountCents: -21000 }] }, '2026-10-01');
    assert.deepEqual(entry.metadata, { autoReverseOn: '2026-10-01', reversalTxId: 'je1_rev' });
    assert.deepEqual([reversal.id, reversal.date, reversal.description], ['je1_rev', '2026-10-01', 'Reversal of: Electricity accrual']);
    assert.deepEqual(reversal.lines.map(l => [l.accountId, l.amountCents]), [['power', -21000], ['accrued', 21000]]);
    assert.deepEqual(reversal.metadata, { isReversal: true, reversesTxId: 'je1', autoReversal: true });
  });
});

describe('In the journal entry form', () => {
  const power = makeChartAccount({ id: 'power', code: '6300', name: 'Electricity', type: 'expense', category: 'Utilities' });
  const accrued = makeChartAccount({ id: 'accrued', code: '2100', name: 'Accrued expenses', type: 'liability', category: 'Current Liabilities' });
  afterEach(() => cleanup());

  test('ticked: both entries go in one request, the reversal on the 1st of next month', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ baseCurrency: 'USD', transactions: [], lockDate: null, accounts: [power, accrued] });
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body || '{}')) });
      return new Response('{"status":"ok"}', { status: 200 });
    }) as typeof fetch;
    render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={[power, accrued]} workspaceId="component-workspace" />);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-30' } });
    fireEvent.change(screen.getByLabelText('Account for line 1'), { target: { value: 'power' } });
    fireEvent.change(screen.getByLabelText('Debit amount for line 1'), { target: { value: '210' } });
    fireEvent.change(screen.getByLabelText('Account for line 2'), { target: { value: 'accrued' } });
    fireEvent.change(screen.getByLabelText('Credit amount for line 2'), { target: { value: '210' } });
    fireEvent.click(screen.getByLabelText('Reverse automatically (an accrual)'));
    assert.equal((screen.getByLabelText('on') as HTMLInputElement).value, '2026-10-01');

    fireEvent.change(screen.getByLabelText('on'), { target: { value: '2026-09-30' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /COMMIT TO LEDGER/ })); });
    assert.equal(calls.filter(c => c.url.includes('/transactions')).length, 0, 'a reversal on the same day is refused');

    fireEvent.change(screen.getByLabelText('on'), { target: { value: '2026-10-01' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /COMMIT TO LEDGER/ })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.endsWith('/api/v1/transactions/bulk'))));
    const txs = calls.find(c => c.url.endsWith('/api/v1/transactions/bulk'))!.body.transactions as { date: string; lines: { amountCents: number }[] }[];
    assert.deepEqual(txs.map(t => [t.date, t.lines.map(l => l.amountCents)]), [['2026-09-30', [21000, -21000]], ['2026-10-01', [-21000, 21000]]]);
    assert.equal(calls.some(c => c.url.endsWith('/api/v1/transactions')), false, 'not posted twice');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('On the server', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_rev_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;

  before(async () => {
    globalThis.fetch = realFetch; // the form tests above stub it
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Rev', currency: 'USD', members: ['owner-1'], lockDate: '2026-08-31' });
    await db.collection('chartAccounts').doc(id('power')).set({ workspaceId: ws, name: 'Electricity', type: 'expense', category: 'Utilities', code: '6300' });
    await db.collection('chartAccounts').doc(id('accrued')).set({ workspaceId: ws, name: 'Accrued expenses', type: 'liability', category: 'Current Liabilities', code: '2100' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'auditLogs', 'idempotencyKeys', 'workspaces', 'chartAccounts']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  const pair = (date: string) => withReversal({
    id: id(`je-${date}`), date, description: 'Electricity accrual', totalAmountCents: 21000, currency: 'USD', status: 'completed', type: 'journal',
    lines: [{ accountId: id('power'), amountCents: 21000 }, { accountId: id('accrued'), amountCents: -21000 }],
  }, firstOfNextMonth(date));
  const post = (transactions: unknown[]) => fetch(`${base}/api/v1/transactions/bulk`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': 'owner-1' }, body: JSON.stringify({ workspaceId: ws, transactions }),
  });

  test('the accrual and its reversal are saved together, the reversal linked to it', async () => {
    const res = await post(pair('2026-09-30'));
    assert.equal(res.status, 200, await res.clone().text());
    const reversal = (await db.collection('transactions').doc(id('je-2026-09-30_rev')).get()).data();
    assert.deepEqual([reversal?.date, reversal?.metadata?.reversesTxId, (reversal?.lines as { amountCents: number }[]).map(l => l.amountCents)],
      ['2026-10-01', id('je-2026-09-30'), [-21000, 21000]]);
  });

  test('an accrual in a closed month is refused, and so nothing is half posted', async () => {
    const res = await post(pair('2026-08-31'));
    assert.notEqual(res.status, 200);
    assert.equal((await db.collection('transactions').doc(id('je-2026-08-31_rev')).get()).exists, false, 'no reversal without its accrual');
  });
});
