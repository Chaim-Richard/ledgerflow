/**
 * Asset depreciation ledger (CB-27): before, in and after the period from the runs in force (an
 * undone run doesn't count), what an asset came with counted as before, disposals marked; on screen
 * with totals.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { depreciationLedger } from '../lib/depreciationLedger';
import DepreciationLedgerReportView from '../components/reporting/DepreciationLedgerReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
import type { FixedAsset, Transaction } from '../types';

const asset = (id: string, name: string, extra: Partial<FixedAsset>) => ({
  id, uid: 'u', workspaceId: 'w', name, purchaseDate: '2025-01-01', purchasePriceCents: 1_200_000, salvageValueCents: 0, usefulLifeYears: 5,
  depreciationMethod: 'straight-line', accumulatedDepreciationCents: 0, status: 'active', createdAt: '2025-01-01', ...extra,
}) as FixedAsset;
const run = (id: string, month: string, assets: Array<[string, number]>, extra: Partial<Transaction> = {}) => ({
  id, date: `${month}-28`, status: 'completed', type: 'actual', lines: [],
  metadata: { type: 'depreciation-run', month, assets: assets.map(([assetId, amountCents]) => ({ assetId, amountCents })) }, ...extra,
}) as unknown as Transaction;
// the van came with 1,000.00 already depreciated; three runs, one of them undone
const assets = [
  asset('van', 'Van', { accumulatedDepreciationCents: 100_000 + 20_000 * 3 }),
  asset('pc', 'Computer', { purchasePriceCents: 240_000, accumulatedDepreciationCents: 10_000 * 2, disposedOn: '2026-03-15', status: 'disposed' }),
  asset('later', 'Later', { purchaseDate: '2027-01-01' }),
];
const transactions = [
  run('r1', '2025-12', [['van', 20_000], ['pc', 10_000]]),
  run('r2', '2026-01', [['van', 20_000], ['pc', 10_000]]),
  run('r3', '2026-02', [['van', 20_000]]),
  run('r4', '2026-02', [['van', 99_999]], { reversalEventId: 'rev4' } as never),
];

describe('Asset depreciation ledger', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('before, in and after the period; brought-in depreciation counts as before; disposals marked', () => {
    const rows = depreciationLedger(assets, transactions, '2026-01-01', '2026-03-31');
    assert.deepEqual(rows.map(r => [r.name, r.costCents, r.openingCents, r.periodCents, r.closingCents, r.bookValueCents, r.months, r.disposedOn]), [
      ['Computer', 240_000, 10_000, 10_000, 20_000, 220_000, ['2026-01'], '2026-03-15'],
      ['Van', 1_200_000, 120_000, 40_000, 160_000, 1_040_000, ['2026-01', '2026-02'], undefined],
    ], 'the undone run and the asset bought later are left out');
    assert.equal(depreciationLedger(assets, transactions, '2026-04-01', '2026-12-31').some(r => r.name === 'Computer'), false, 'disposed before the period');
  });

  test('on screen: each asset and the totals', () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ assets, transactions } as never);
    markComponentCollectionsLoaded('assets', 'transactions');
    render(<DepreciationLedgerReportView />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-03-31' } });
    assert.match(screen.getByRole('rowheader', { name: /^Van/ }).parentElement!.textContent || '', /\$12,000\.00\$1,200\.00\$400\.00\$1,600\.00\$10,400\.00/);
    assert.match(screen.getByRole('rowheader', { name: 'Total' }).parentElement!.textContent || '', /\$14,400\.00\$1,300\.00\$500\.00\$1,800\.00\$12,600\.00/);
    assert.match(screen.getByRole('rowheader', { name: /^Computer/ }).textContent || '', /disposed 2026-03-15/);
  });
});
