/**
 * The fixed asset register as a spreadsheet (BD-08), for the accountant or the auditor: every asset
 * with its tag, place, accounts, dates, cost, salvage, life and method, the depreciation posted and
 * through which month, the book value, and how it left (sold or scrapped, with the money and the gain
 * or loss). Amounts in the workspace's currency, as numbers with two decimals.
 */
import type { ChartAccount, FixedAsset } from '../types';
import { csvMoney as money, type CsvValue } from './csvExport';

export const ASSET_REGISTER_HEADERS = [
  'Tag', 'Asset', 'Status', 'Location', 'Category', 'Bought', 'Cost', 'Salvage value', 'Useful life (years)', 'Method',
  'Asset account', 'Depreciation posted', 'Depreciated through', 'Book value', 'Disposed on', 'Money received', 'Gain or loss',
];

export function assetRegisterRows(assets: Array<FixedAsset & { location?: string; category?: string }>, accounts: ChartAccount[]): CsvValue[][] {
  const accountName = (id?: string) => (id ? accounts.find(a => a.id === id)?.name || id : '');
  return [...assets]
    .sort((a, b) => String(a.assetTag || '').localeCompare(String(b.assetTag || ''), undefined, { numeric: true }) || a.name.localeCompare(b.name))
    .map(a => [
      a.assetTag || '', a.name, a.status === 'in_progress' ? 'being built' : a.status, a.location || '', a.category || '', a.purchaseDate || '',
      money(a.purchasePriceCents), money(a.salvageValueCents), a.usefulLifeYears ?? '', a.depreciationMethod === 'declining-balance' ? 'declining balance' : 'straight line',
      accountName(a.assetAccountId), money(a.accumulatedDepreciationCents), a.depreciatedThrough || '',
      money((a.purchasePriceCents || 0) - (a.accumulatedDepreciationCents || 0)),
      a.disposedOn || '', a.disposedOn ? money(a.disposalProceedsCents) : '', a.disposedOn ? money(a.disposalGainLossCents) : '',
    ]);
}
