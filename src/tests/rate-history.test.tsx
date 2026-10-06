/**
 * Exchange-rate history at posting (K-29): the rates the books used per currency and day, read from the
 * documents; a back-dated document gets the rate used on (or just before) its day instead of today's
 * live rate; the "Exchange rates used" report lists them for the period.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BillModal from '../components/purchases/BillModal';
import ExchangeRateHistoryView from '../components/reporting/ExchangeRateHistoryView';
import { rateHistory, rateOn } from '../lib/exchangeRates';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Bill, Workspace } from '../types';
import { makeChartAccount, makeVendor } from './fixtures';

const docs = [
  { currency: 'EUR', exchangeRate: 1.05, date: '2026-01-10' },
  { currency: 'EUR', exchangeRate: 1.05, date: '2026-01-10' },
  { currency: 'EUR', exchangeRate: 1.07, date: '2026-02-03' },
  { currency: 'EUR', exchangeRate: 1, date: '2026-02-04' },
  { currency: 'GBP', exchangeRate: 1.27, date: '2026-02-05' },
  { currency: 'EUR', exchangeRate: 1.09, date: '2026-03-01' },
];

describe('The history', () => {
  test('per day and rate, newest first, with how many documents used it', () => {
    assert.deepEqual(rateHistory('EUR', docs), [
      { date: '2026-03-01', rate: 1.09, count: 1 },
      { date: '2026-02-03', rate: 1.07, count: 1 },
      { date: '2026-01-10', rate: 1.05, count: 2 },
    ]);
  });

  test('the rate on a day, or the closest day before; none before the first', () => {
    assert.equal(rateOn('EUR', '2026-02-03', docs)?.rate, 1.07);
    assert.equal(rateOn('EUR', '2026-02-20', docs)?.rate, 1.07);
    assert.equal(rateOn('EUR', '2026-01-01', docs), null);
  });
});

describe('A back-dated bill', () => {
  const urls: string[] = [];
  beforeEach(() => {
    urls.length = 0;
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      urls.push(String(url));
      if (String(url).startsWith('/api/v1/fx/rate')) return new Response(JSON.stringify({ rate: 1.15 }), { status: 200 });
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
    useLedgerStore.setState({ bills: docs.map((d, i) => ({ id: `b${i}`, vendorId: 'v9', amountCents: 1, dueDate: d.date, status: 'paid', ...d }) as Bill), transactions: [], taxRates: [] });
  });
  afterEach(() => cleanup());

  test('gets the rate used around its date, not today\'s live rate', async () => {
    render(<BillModal isOpen onClose={() => {}} onSave={() => {}} vendors={[makeVendor({ id: 'v1', name: 'Paper Co' })]}
      accounts={[makeChartAccount({ id: 'exp', name: 'Supplies', type: 'expense' })]} />);
    fireEvent.change(screen.getByLabelText('Bill Date'), { target: { value: '2026-02-20' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
    await waitFor(() => assert.equal((screen.getByLabelText('1 EUR = ? USD') as HTMLInputElement).value, '1.07'));
    assert.match(screen.getByRole('status').textContent || '', /Rate used on 2026-02-03 \(the closest before 2026-02-20\)/);
    assert.equal(urls.filter(u => u.startsWith('/api/v1/fx/rate')).length, 0, 'today\'s rate is not asked for');
  });
});

describe('The report', () => {
  beforeEach(() => {
    setComponentWorkspace('viewer');
    markComponentCollectionsLoaded('invoices', 'bills', 'payments', 'transactions');
    useLedgerStore.setState({
      invoices: docs.slice(0, 3) as never, bills: docs.slice(3) as never, payments: [],
      transactions: [{ id: 'j', type: 'journal', originalCurrency: 'EUR', exchangeRate: 1.08, date: '2026-02-10' }] as never,
    });
  });
  afterEach(() => cleanup());

  test('lists the rates of the period by day, journals included, and switches currency', () => {
    render(<ExchangeRateHistoryView startDate="2026-01-01" endDate="2026-02-28" />);
    const region = screen.getByRole('region', { name: 'Exchange rates used' });
    assert.deepEqual(screen.getAllByRole('row').slice(1).map(r => r.textContent), ['2026-02-101.081', '2026-02-031.071', '2026-01-101.052']);
    assert.match(region.textContent || '', /Lowest 1\.05, highest 1\.08, latest 1\.08 \(2026-02-10\)/);
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'GBP' } });
    assert.deepEqual(screen.getAllByRole('row').slice(1).map(r => r.textContent), ['2026-02-051.271']);
  });
});
