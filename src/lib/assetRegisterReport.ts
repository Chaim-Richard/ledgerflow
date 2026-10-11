/** E-3: read-only fixed-asset register by an as-of date, reusing the posted-run ledger. */
import type { ChartAccount, FixedAsset, Transaction } from '../types';
import { depreciationLedger } from './depreciationLedger';
import { validCustomReportPeriod } from './reportCustomPeriod';

export interface AssetRegisterReportRow {
  id: string;
  tag: string;
  name: string;
  category: string;
  status: string;
  purchaseDate: string;
  costCents: number;
  depreciationCents: number;
  bookValueCents: number;
}
export interface AssetRegisterCategoryRow {
  category: string;
  count: number;
  costCents: number;
  depreciationCents: number;
  bookValueCents: number;
}
export interface AssetRegisterReport {
  rows: AssetRegisterReportRow[];
  categories: AssetRegisterCategoryRow[];
  totals: { count: number; costCents: number; depreciationCents: number; bookValueCents: number };
  historicalChanges: number;
}

/** Cost/account attribution is current asset metadata; monthly depreciation is from posted, non-reversed runs. */
export function assetRegisterReport(
  assets: readonly FixedAsset[], accounts: readonly ChartAccount[], transactions: readonly Transaction[], asOfDate: string,
): AssetRegisterReport {
  if (!validCustomReportPeriod({ startDate: asOfDate, endDate: asOfDate })) throw new Error('Choose a valid as-of date.');
  const included = assets.filter(a => a.purchaseDate <= asOfDate && (!a.disposedOn || a.disposedOn > asOfDate));
  const accountNames = new Map(accounts.map(a => [a.id, a.name]));
  const depreciated = new Map(depreciationLedger(included, [...transactions], '1900-01-01', asOfDate).map(a => [a.assetId, a]));
  const rows: AssetRegisterReportRow[] = included.map(asset => {
    const data = depreciated.get(asset.id);
    const costCents = data?.costCents ?? asset.purchasePriceCents;
    const depreciationCents = data?.closingCents ?? 0;
    return {
      id: asset.id, tag: asset.assetTag || '', name: asset.name, purchaseDate: asset.purchaseDate,
      category: accountNames.get(asset.assetAccountId || '') || 'Unassigned asset account',
      status: asset.status === 'in_progress' && (!asset.placedInService || asset.placedInService.date > asOfDate) ? 'In progress' : 'Active',
      costCents, depreciationCents, bookValueCents: costCents - depreciationCents,
    };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const byCategory = new Map<string, AssetRegisterCategoryRow>();
  for (const row of rows) {
    const group = byCategory.get(row.category) || { category: row.category, count: 0, costCents: 0, depreciationCents: 0, bookValueCents: 0 };
    group.count++;
    group.costCents += row.costCents;
    group.depreciationCents += row.depreciationCents;
    group.bookValueCents += row.bookValueCents;
    byCategory.set(row.category, group);
  }
  const categories = [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category));
  return {
    rows, categories,
    totals: categories.reduce((t, g) => ({ count: t.count + g.count, costCents: t.costCents + g.costCents, depreciationCents: t.depreciationCents + g.depreciationCents, bookValueCents: t.bookValueCents + g.bookValueCents }), { count: 0, costCents: 0, depreciationCents: 0, bookValueCents: 0 }),
    historicalChanges: included.filter(a => (a.partialDisposals || []).some(d => d.date > asOfDate) || (a.costAdditions || []).some(c => c.date > asOfDate)).length,
  };
}
