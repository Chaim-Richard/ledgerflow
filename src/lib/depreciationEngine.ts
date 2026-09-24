import { FixedAsset, Transaction } from '../types';
import { getLocalDateISO } from './utils';

export interface DepreciationPeriodEntry {
  periodDate: string;
  depreciationAmountCents: number;
  accumulatedDepreciationCents: number;
  bookValueCents: number;
}

/**
 * Calculates straight-line depreciation schedule for a fixed asset using canonical FixedAsset fields:
 * - purchasePriceCents
 * - salvageValueCents
 * - usefulLifeYears
 * - depreciationMethod ('straight-line')
 */
export function calculateStraightLineDepreciation(
  asset: FixedAsset,
  currentDateIso: string = getLocalDateISO()
): DepreciationPeriodEntry[] {
  const cost = asset.purchasePriceCents || 0;
  const salvage = asset.salvageValueCents || 0;
  const usefulLifeMonths = (asset.usefulLifeYears || 1) * 12;

  const depreciableAmount = Math.max(0, cost - salvage);
  const monthlyDepreciation = Math.round(depreciableAmount / usefulLifeMonths);

  const schedule: DepreciationPeriodEntry[] = [];
  let accumulated = 0;
  const [startY, startM] = (asset.purchaseDate || currentDateIso).slice(0, 10).split('-').map(Number);

  for (let month = 1; month <= usefulLifeMonths; month++) {
    const targetMonth = (startM - 1) + month;
    const d = new Date(Date.UTC(startY, targetMonth, 1));
    const year = d.getUTCFullYear();
    const monthStr = String(d.getUTCMonth() + 1).padStart(2, '0');
    const periodDate = `${year}-${monthStr}-01`;

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
    description: `Depreciation Expense - ${asset.name} (${asset.id})`,
    totalAmountCents: periodEntry.depreciationAmountCents,
    status: 'completed',
    type: 'journal',
    lines: [
      { accountId: 'acc_depreciation_expense', accountName: 'Depreciation Expense', amountCents: periodEntry.depreciationAmountCents },
      { accountId: 'acc_accumulated_depreciation', accountName: 'Accumulated Depreciation', amountCents: -periodEntry.depreciationAmountCents }
    ]
  };
}
