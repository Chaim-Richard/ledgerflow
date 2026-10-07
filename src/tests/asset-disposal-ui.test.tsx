/**
 * Sell or scrap on the Fixed Asset Register (X-03): the dialog shows the book value on the chosen
 * date (with the depreciation still due) and the gain or loss before anything is posted, then asks
 * the server; a disposed asset shows how it went, leaves the totals, and can be undone.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FixedAssetsView from '../components/assets/FixedAssetsView';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount } from './fixtures';
import type { FixedAsset } from '../types';

type Call = { url: string; method: string; body: Record<string, unknown> };
const van: FixedAsset = {
  id: 'van', uid: 'u', workspaceId: 'component-workspace', name: 'Delivery van', purchaseDate: '2026-01-01', purchasePriceCents: 1_200_000,
  salvageValueCents: 0, usefulLifeYears: 5, depreciationMethod: 'straight-line', accumulatedDepreciationCents: 160_000, depreciatedThrough: '2026-09',
  status: 'active', createdAt: '2026-01-01', assetAccountId: 'vehicles',
};
const accounts = [
  makeChartAccount({ id: 'vehicles', code: '1500', name: 'Vehicles', type: 'asset', category: 'Fixed assets' }),
  makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'loss', code: '7900', name: 'Loss on disposal', type: 'expense', category: 'Other' }),
];

describe('Sell or scrap a fixed asset', () => {
  let calls: Call[] = [];
  beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method || 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : {} });
      return new Response(JSON.stringify({ status: 'success', gainLossCents: -20_000 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  });
  afterEach(() => cleanup());

  test('the dialog shows the book value and the loss on the date, then posts through the server', async () => {
    setComponentWorkspace('bookkeeper');
    useLedgerStore.setState({ assets: [van], accounts } as never);
    markComponentCollectionsLoaded('assets');
    render(<FixedAssetsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Sell or scrap Delivery van' }));
    const dialog = screen.getByRole('dialog', { name: 'Sell or scrap Delivery van' });
    fireEvent.change(within(dialog).getByLabelText('Date sold or scrapped'), { target: { value: '2026-10-05' } });
    fireEvent.change(within(dialog).getByLabelText('Amount received (0 if scrapped)'), { target: { value: '10000' } });
    assert.equal((within(dialog).getByLabelText('The money went to') as HTMLSelectElement).value, 'bank', 'the bank account first');
    assert.equal((within(dialog).getByLabelText('Account for the loss') as HTMLSelectElement).value, 'loss', 'an account named for disposals is suggested');
    assert.equal(within(dialog).getByRole('status').textContent,
      'Book value on that date: $10,200.00 (cost $12,000.00, depreciation $1,800.00, of which $200.00 is posted now). Loss on disposal: $200.00.');
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Record the sale' })); });
    await waitFor(() => assert.equal(calls.length, 1));
    assert.deepEqual(calls[0], { url: '/api/v1/workspaces/component-workspace/assets/van/disposal', method: 'POST',
      body: { date: '2026-10-05', proceedsCents: 1_000_000, proceedsAccountId: 'bank', gainLossAccountId: 'loss' } });
    await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
  });

  test('a disposed asset shows how it went, leaves the totals, and can be undone', async () => {
    setComponentWorkspace('owner');
    const sold = { ...van, status: 'disposed' as const, disposedOn: '2026-10-05', disposalProceedsCents: 1_000_000, disposalGainLossCents: -20_000, disposalTransactionId: 'tx9', accumulatedDepreciationCents: 180_000 };
    useLedgerStore.setState({ assets: [sold], accounts } as never);
    markComponentCollectionsLoaded('assets');
    render(<FixedAssetsView />);
    const row = screen.getByRole('row', { name: /Delivery van/ });
    assert.match(row.textContent || '', /Sold .*· loss \$200\.00/);
    assert.equal(screen.queryByRole('button', { name: /Sell or scrap/ }), null);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo disposal of Delivery van' })); });
    await waitFor(() => assert.ok(calls.some(c => c.method === 'DELETE' && c.url.endsWith('/assets/van/disposal'))));
  });

  test('a viewer gets no actions', () => {
    setComponentWorkspace('viewer');
    useLedgerStore.setState({ assets: [van], accounts } as never);
    markComponentCollectionsLoaded('assets');
    render(<FixedAssetsView />);
    assert.equal(screen.queryByRole('button', { name: /Sell or scrap/ }), null);
  });
});
