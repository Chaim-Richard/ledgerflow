/**
 * Foreign-currency journal entries (L-190): the rate is the last one used for that currency or
 * today's from the rate service, never a made-up table (it had EUR at 0.92 × 1.1, which is euros
 * per dollar, so €100 posted as about $101 instead of about $108). Without any rate the entry is
 * refused until one is typed; the home currency is always offered.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import JournalEntryModal from '../components/ledger/JournalEntryModal';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount, makeTransaction } from './fixtures';

const bank = makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' });
const fees = makeChartAccount({ id: 'fees', code: '6100', name: 'Bank fees', type: 'expense', category: 'Expenses' });

let posted: Record<string, unknown>[] = [];
let liveRate: number | null = null;
beforeEach(() => {
  posted = [];
  liveRate = null;
  setComponentWorkspace('owner');
  useLedgerStore.setState({ baseCurrency: 'AUD', transactions: [], lockDate: null, accounts: [bank, fees] });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/fx/rate')) return liveRate ? new Response(JSON.stringify({ rate: liveRate }), { status: 200 }) : new Response('{}', { status: 503 });
    if (url.endsWith('/api/v1/transactions')) { posted.push(JSON.parse(String(init?.body)).transaction); return new Response('{}', { status: 200 }); }
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
});
afterEach(() => cleanup());

const fillLines = () => {
  fireEvent.change(screen.getByLabelText('Account for line 1'), { target: { value: 'fees' } });
  fireEvent.change(screen.getByLabelText('Debit amount for line 1'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Account for line 2'), { target: { value: 'bank' } });
  fireEvent.change(screen.getByLabelText('Credit amount for line 2'), { target: { value: '100' } });
};
const commit = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /COMMIT TO LEDGER/ })); });

test('the home currency is offered and posts at 1', async () => {
  render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={[bank, fees]} workspaceId="component-workspace" />);
  const currencies = [...(screen.getByLabelText('Currency') as HTMLSelectElement).options].map(o => o.value);
  assert.equal(currencies[0], 'AUD', 'a workspace in AUD can choose AUD (the list had only six fixed currencies)');
  assert.equal((screen.getByLabelText('Currency') as HTMLSelectElement).value, 'AUD');
  fillLines();
  await commit();
  await waitFor(() => assert.equal(posted.length, 1));
  assert.deepEqual((posted[0].lines as { amountCents: number }[]).map(l => l.amountCents), [10000, -10000]);
});

test('no rate anywhere: nothing is invented and the entry waits for one; a typed rate is used as typed', async () => {
  render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={[bank, fees]} workspaceId="component-workspace" />);
  fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
  await waitFor(() => assert.ok(screen.getByText('No rate found for EUR: type it')));
  assert.equal((screen.getByLabelText('AUD for 1 EUR') as HTMLInputElement).value, '');
  fillLines();
  await commit();
  assert.equal(posted.length, 0, 'not posted without a rate');
  fireEvent.change(screen.getByLabelText('AUD for 1 EUR'), { target: { value: '1.65' } });
  await commit();
  await waitFor(() => assert.equal(posted.length, 1));
  assert.deepEqual((posted[0].lines as { amountCents: number }[]).map(l => l.amountCents), [16500, -16500]);
  assert.deepEqual([posted[0].originalCurrency, posted[0].exchangeRate, posted[0].currency], ['EUR', 1.65, 'AUD']);
});

test('the last rate used for the currency fills in, then today\'s rate when the service answers', async () => {
  useLedgerStore.setState({ transactions: [makeTransaction({ id: 't1', date: '2026-09-30', originalCurrency: 'EUR', exchangeRate: 1.61, currency: 'AUD' })] });
  liveRate = 1.6342;
  render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={[bank, fees]} workspaceId="component-workspace" />);
  fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
  await waitFor(() => assert.equal((screen.getByLabelText('AUD for 1 EUR') as HTMLInputElement).value, '1.6342'));
  assert.ok(screen.getByText("Today's rate for EUR"));
});
