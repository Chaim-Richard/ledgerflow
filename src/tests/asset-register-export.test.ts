/**
 * The fixed asset register as a spreadsheet (BD-08): one row per asset in tag order, with its
 * accounts by name, depreciation and book value, and how a disposed one left.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_REGISTER_HEADERS, assetRegisterRows } from '../lib/assetRegisterExport';
import { toCsv } from '../lib/csvExport';
import { makeChartAccount } from './fixtures';
import type { FixedAsset } from '../types';

const asset = (id: string, extra: Partial<FixedAsset> & { location?: string }) => ({
  id, uid: 'u', workspaceId: 'w', name: id, purchaseDate: '2025-01-01', purchasePriceCents: 1_200_000, salvageValueCents: 0, usefulLifeYears: 5,
  depreciationMethod: 'straight-line', accumulatedDepreciationCents: 240_000, status: 'active', createdAt: '2025-01-01', ...extra,
}) as FixedAsset;

test('one row per asset, tag order, accounts by name, book value and disposal', () => {
  const rows = assetRegisterRows([
    asset('Van', { assetTag: 'AT-0010', assetAccountId: 'veh', depreciatedThrough: '2025-12', location: 'Yard' } as never),
    asset('Old PC', { assetTag: 'AT-0002', status: 'disposed', disposedOn: '2025-06-30', disposalProceedsCents: 10_000, disposalGainLossCents: -5_000, depreciationMethod: 'declining-balance' }),
  ], [makeChartAccount({ id: 'veh', name: 'Vehicles' })]);
  assert.equal(ASSET_REGISTER_HEADERS.length, rows[0].length);
  assert.deepEqual(rows.map(r => [r[0], r[1], r[2], r[9], r[10], r[11], r[13], r[14], r[15], r[16]]), [
    ['AT-0002', 'Old PC', 'disposed', 'declining balance', '', '2400.00', '9600.00', '2025-06-30', '100.00', '-50.00'],
    ['AT-0010', 'Van', 'active', 'straight line', 'Vehicles', '2400.00', '9600.00', '', '', ''],
  ]);
  assert.match(toCsv(ASSET_REGISTER_HEADERS, rows), /^"?Tag"?,/);
});
