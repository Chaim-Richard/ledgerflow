/**
 * Spreading a bill on the screen (K-17): the dialog proposes the bill's biggest expense line, the
 * Prepaid Expenses account, 12 months from the bill's month, shows the monthly share, refuses what the
 * server would refuse, and sends one request; the bills list offers "Spread", and on a spread bill
 * shows how far it has got with "Undo spread".
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import SpreadBillDialog from '../components/purchases/SpreadBillDialog';
import Purchases from '../components/purchases/Purchases';
import { billExpenseLine, spreadProgress } from '../lib/prepaidSchedule';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount } from './fixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import type { Bill } from '../types';

const accounts = [
  makeChartAccount({ id: 'ins', code: '6100', name: 'Insurance', type: 'expense', category: 'Operating Expenses' }),
  makeChartAccount({ id: 'fees', code: '6200', name: 'Fees', type: 'expense', category: 'Operating Expenses' }),
  makeChartAccount({ id: 'pre', code: '1300', name: 'Prepaid Expenses', type: 'asset', category: 'Current Assets' }),
  makeChartAccount({ id: 'ap', code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Payables' }),
];
const bill = {
  id: 'b1', uid: 'test-user', workspaceId: 'component-workspace', vendorId: 'v1', vendorName: 'Shield', number: 'B-7', amountCents: 125011,
  status: 'approved', date: '2026-09-15', dueDate: '2026-10-15', currency: 'USD',
  splits: [{ accountId: 'fees', amountCents: 5000 }, { accountId: 'ins', amountCents: 120011 }],
} as Bill;

describe('Which line, and how far', () => {
  test('the biggest expense line of the bill, in the home currency', () => {
    assert.deepEqual(billExpenseLine(bill, accounts), { accountId: 'ins', baseCents: 120011 });
    assert.deepEqual(billExpenseLine({ ...bill, exchangeRate: 2 }, accounts), { accountId: 'ins', baseCents: 240022 });
    assert.equal(billExpenseLine({ ...bill, splits: [{ accountId: 'ap', amountCents: 1 }] }, accounts), undefined, 'no expense line');
  });

  test('progress in words', () => {
    assert.equal(spreadProgress({ months: 12, startMonth: '2026-09' }, '2026-10-31'), 'Spread over 12 months from Sep 2026 · 2 of 12 taken');
    assert.equal(spreadProgress({ months: 3, startMonth: '2026-11' }, '2026-10-05'), 'Spread over 3 months from Nov 2026 · 0 of 3 taken');
  });
});

describe('The spread dialog', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts });
  });
  afterEach(() => cleanup());

  test('proposes the insurance line over 12 months, shows the share, and posts it once', async () => {
    const calls = stubFetchWithBodies(200, { status: 'success', data: {} });
    let closed = 0;
    render(<SpreadBillDialog bill={bill} onClose={() => closed++} />);
    assert.equal((screen.getByLabelText('Expense account') as HTMLSelectElement).value, 'ins');
    assert.equal((screen.getByLabelText('Prepaid account') as HTMLSelectElement).value, 'pre');
    assert.equal((screen.getByLabelText('Amount (USD)') as HTMLInputElement).value, '1200.11');
    assert.equal((screen.getByLabelText('First month') as HTMLInputElement).value, '2026-09');
    assert.match(document.body.textContent || '', /\$100\.00 a month, 2026-09-30 to 2027-08-31 \(the last \$100\.11\)/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Spread' })); });
    const sent = calls.filter(c => c.url.includes('/spread'));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, '/api/v1/workspaces/component-workspace/bills/b1/spread');
    assert.deepEqual(sent[0].body, { expenseAccountId: 'ins', prepaidAccountId: 'pre', amountCents: 120011, months: 12, startMonth: '2026-09' });
    assert.equal(closed, 1);
  });

  test('more than the bill, one month, or a month before the bill cannot be sent', () => {
    const calls = stubFetchWithBodies(200, {});
    render(<SpreadBillDialog bill={bill} onClose={() => {}} />);
    const spread = screen.getByRole('button', { name: 'Spread' }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '1250.12' } });
    assert.equal(screen.getByRole('alert').textContent, 'That is more than the bill');
    assert.equal(spread.disabled, true);
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '600' } });
    fireEvent.change(screen.getByLabelText('Months'), { target: { value: '1' } });
    assert.equal(screen.getByRole('alert').textContent, 'Spread over 2 to 60 months');
    fireEvent.change(screen.getByLabelText('Months'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('First month'), { target: { value: '2026-08' } });
    assert.equal(screen.getByRole('alert').textContent, 'The first month cannot be before the bill');
    fireEvent.change(screen.getByLabelText('First month'), { target: { value: '2026-10' } });
    assert.match(document.body.textContent || '', /\$100\.00 a month, 2026-10-31 to 2027-03-31\./);
    assert.equal(calls.length, 0);
  });

  test('without a Prepaid account it says how to add one', () => {
    useLedgerStore.setState({ accounts: accounts.filter(a => a.id !== 'pre') });
    stubFetchWithBodies(200, {});
    render(<SpreadBillDialog bill={bill} onClose={() => {}} />);
    assert.equal(screen.getByRole('alert').textContent, 'Choose the Prepaid Expenses account');
    assert.match(document.body.textContent || '', /No “Prepaid Expenses” account yet/);
  });
});

describe('The bills list', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('bills', 'vendors');
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('a posted bill offers Spread; a spread one shows its progress and Undo; a draft offers neither', async () => {
    stubFetchWithBodies(200, []);
    const spread = { ...bill, id: 'b2', number: 'B-8', prepaidSchedule: { id: 's', amountCents: 120011, months: 12, startMonth: '2026-01', expenseAccountId: 'ins', prepaidAccountId: 'pre', transactionIds: [], createdAt: '' } };
    useLedgerStore.setState({ accounts, vendors: [{ id: 'v1', name: 'Shield' }] as never, bills: [bill, spread, { ...bill, id: 'b3', number: 'B-9', status: 'draft' }] });
    render(<Purchases />);
    assert.ok(screen.getByRole('button', { name: 'Spread bill B-7 over months' }));
    assert.ok(screen.getByRole('button', { name: 'Undo the spread of bill B-8' }));
    assert.match(document.body.textContent || '', /Spread over 12 months from Jan 2026 · \d+ of 12 taken/);
    assert.equal(screen.queryByRole('button', { name: 'Spread bill B-9 over months' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Spread bill B-7 over months' }));
    assert.ok(screen.getByRole('dialog', { name: 'Spread over months' }));
  });

  test('a viewer sees no Spread', () => {
    setComponentWorkspace('viewer');
    stubFetchWithBodies(200, []);
    useLedgerStore.setState({ accounts, vendors: [] as never, bills: [bill] });
    render(<Purchases />);
    assert.equal(screen.queryByRole('button', { name: /Spread bill/ }), null);
  });
});

describe('Re-posting a spread bill', () => {
  const sent: Array<Array<{ metadata?: Record<string, unknown> }>> = [];
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  const context = (transactions: unknown[]) => ({
    lockDate: null, inventory: [], transactions,
    workspaces: [{ id: 'w1', uid: 'u1', name: 'W', currency: 'USD' }],
    accounts: [...accounts, makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', category: 'Cash' })],
  });
  const capture = () => {
    sent.length = 0;
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      sent.push(JSON.parse(String(init?.body || '{}')).transactions || []);
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
  };
  const schedule = { id: 's', amountCents: 1200, months: 12, startMonth: '2026-09', expenseAccountId: 'ins', prepaidAccountId: 'pre', transactionIds: ['sp0', 'sp1'], createdAt: '' };
  const own = { id: 'own', date: '2026-09-15', status: 'completed', type: 'actual', totalAmountCents: 1200, metadata: { billId: 'b1' }, lines: [{ accountId: 'ins', amountCents: 1200 }, { accountId: 'ap', amountCents: -1200 }] };
  const spreadEntry = { id: 'sp1', date: '2027-08-31', status: 'completed', type: 'actual', totalAmountCents: 100, metadata: { spreadOfBillId: 'b1', prepaidScheduleId: 's', scheduled: true }, lines: [{ accountId: 'ins', amountCents: 100 }, { accountId: 'pre', amountCents: -100 }] };

  test('an edit reverses only the bill’s own entry, not its monthly spread', async () => {
    capture();
    const { LedgerPostService } = await import('../services/LedgerPostService');
    await LedgerPostService.postBillLedger('b1', { ...bill, amountCents: 1200, splits: [{ accountId: 'ins', amountCents: 1200 }], prepaidSchedule: schedule }, 'w1', 'u1', undefined, context([own, spreadEntry]) as never);
    const reversed = sent.flat().filter(t => t.metadata?.isReversal).map(t => t.metadata?.reversesTxId);
    assert.deepEqual(reversed, ['own']);
  });

  test('voiding or drafting it is refused until the spread is undone', async () => {
    capture();
    const { LedgerPostService } = await import('../services/LedgerPostService');
    for (const status of ['void', 'draft'] as const) {
      await assert.rejects(LedgerPostService.postBillLedger('b1', { ...bill, status, prepaidSchedule: schedule }, 'w1', 'u1', undefined, context([own, spreadEntry]) as never), /undo the spread first/);
    }
    assert.equal(sent.length, 0, 'nothing was posted');
    await LedgerPostService.postBillLedger('b1', { ...bill, status: 'void' }, 'w1', 'u1', undefined, context([own]) as never);
    assert.deepEqual(sent.flat().map(t => t.metadata?.reversesTxId), ['own'], 'without a spread it voids as before');
  });
});
