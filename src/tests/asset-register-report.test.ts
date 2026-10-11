import test from 'node:test';
import assert from 'node:assert/strict';
import { assetRegisterReport } from '../lib/assetRegisterReport';
import type { FixedAsset } from '../types';
import { makeChartAccount, makeTransaction } from './fixtures';

const asset = (id: string, cost: number, extras: Partial<FixedAsset> = {}): FixedAsset => ({
  id, uid: 'test', workspaceId: 'w', name: id, purchaseDate: '2026-01-01',
  purchasePriceCents: cost, salvageValueCents: 0, usefulLifeYears: 5,
  depreciationMethod: 'straight-line', accumulatedDepreciationCents: 0,
  status: 'active', createdAt: '2026-01-01', assetAccountId: 'equipment', ...extras,
});
test('E-3: grouped asset costs, posted non-reversed depreciation and disposal date', () => {
  const accounts = [makeChartAccount({ id: 'equipment', name: 'Equipment', workspaceId: 'w' }), makeChartAccount({ id: 'vehicles', name: 'Vehicles', workspaceId: 'w' })];
  const transactions = [
    makeTransaction({ id: 'run', workspaceId: 'w', date: '2026-02-28', metadata: { type: 'depreciation-run', month: '2026-02', assets: [{ assetId: 'a', amountCents: 1500 }, { assetId: 'b', amountCents: 700 }] } }),
    makeTransaction({ id: 'future', workspaceId: 'w', date: '2026-04-30', metadata: { type: 'depreciation-run', month: '2026-04', assets: [{ assetId: 'a', amountCents: 500 }] } }),
  ];
  const assets = [asset('a', 30000, { accumulatedDepreciationCents: 2000 }), asset('b', 14000, { assetAccountId: 'vehicles', accumulatedDepreciationCents: 700 }), asset('sold', 12000, { disposedOn: '2026-01-31', status: 'disposed' })];
  const result = assetRegisterReport(assets, accounts, transactions, '2026-03-01');
  assert.equal(result.totals.count, 2);
  assert.equal(result.totals.costCents, 44000);
  assert.equal(result.totals.depreciationCents, 2200);
  assert.equal(result.totals.bookValueCents, 41800);
  assert.deepEqual(result.categories.map(g => [g.category, g.bookValueCents]), [['Equipment', 28500], ['Vehicles', 13300]]);
  assert.throws(() => assetRegisterReport(assets, accounts, transactions, '2026-02-30'), /valid as-of/);
});
test('E-3 flags later cost/partial disposal changes and excludes future acquisitions', () => {
  const r = assetRegisterReport([asset('a', 12000, { partialDisposals: [{ date:'2026-06-01' } as never] }), asset('b', 20000, { purchaseDate: '2027-01-01' })], [], [], '2026-04-01');
  assert.equal(r.historicalChanges, 1);
  assert.equal(r.rows.length, 1);
});
