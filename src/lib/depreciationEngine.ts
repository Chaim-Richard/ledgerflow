import { FixedAsset, Transaction } from '../types';

export interface DepreciationPeriodEntry {
  periodDate: string;
  depreciationAmountCents: number;
  accumulatedDepreciationCents: number;
  bookValueCents: number;
}

/**
 * Calculates straight-line depreciation schedule for a fixed asset.
 */
export function calculateStraightLineDepreciation(
  asset: FixedAsset,
  currentDateIso: string = new Date().toISOString().split('T')[0]
): DepreciationPeriodEntry[] {
  const cost = asset.costCents;
  const salvage = asset.salvageValueCents || 0;
  const usefulLifeMonths = (asset.usefulLifeYears || 1) * 12;

  const depreciableAmount = Math.max(0, cost - salvage);
  const monthlyDepreciation = Math.round(depreciableAmount / usefulLifeMonths);

  const schedule: DepreciationPeriodEntry[] = [];
  let accumulated = 0;
  const startDate = new Date(asset.purchaseDate || currentDateIso);

  for (let month = 1; month <= usefulLifeMonths; month++) {
    const periodDate = new Date(startDate.getFullYear(), startDate.getMonth() + month, 1)
      .toISOString().split('T')[0];

    const amount = (month === usefulLifeMonths)
      ? depreciableAmount - accumulated // Final adjustment to match exact depreciable amount
      : monthlyDepreciation;

    accumulated += amount;
    const bookValue = cost - accumulated;

    schedule.push({
      periodDate,
      depreciationAmountCents: amount,
      accumulatedDepreciationCents: accumulated,
      bookValueCents: Math.max(salvage, bookValue)
    });
  }

  return schedule;
}

/**
 * Generates double-entry transaction for a period depreciation entry.
 * DR Depreciation Expense, CR Accumulated Depreciation
 */
export function generateDepreciationLedgerEntry(
  asset: FixedAsset,
  periodEntry: DepreciationPeriodEntry
): Partial<Transaction> {
  return {
    workspaceId: asset.workspaceId,
    date: periodEntry.periodDate,
    description: `Depreciation Expense - ${asset.name} (${asset.assetNumber || asset.id})`,
    totalAmountCents: periodEntry.depreciationAmountCents,
    status: 'completed',
    type: 'journal',
    lines: [
      { accountId: 'acc_depreciation_expense', amountCents: periodEntry.depreciationAmountCents },
      { accountId: 'acc_accumulated_depreciation', amountCents: -periodEntry.depreciationAmountCents }
    ]
  };
}
