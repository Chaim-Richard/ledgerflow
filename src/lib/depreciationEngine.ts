import { FixedAsset } from '../types';

/**
 * Fixed-asset depreciation (R-06), in integer cents and whole months, no time zones.
 * Convention: depreciation starts in the month after the purchase month and runs for the useful
 * life; the last month takes the rounding difference, so the total is exactly cost − salvage.
 * - straight-line: the same amount every month;
 * - declining-balance (double declining): 2 / (life in months) of the remaining book value each
 *   month, never below salvage, the rest in the last month.
 * The month-end run (src/server/services/depreciationService.ts) posts, per asset, the
 * difference between depreciationThrough(asset, month) and what was posted before, so running a
 * month twice posts nothing and a missed month is caught up.
 */

export interface DepreciationPeriodEntry {
  periodDate: string;
  depreciationAmountCents: number;
  accumulatedDepreciationCents: number;
  bookValueCents: number;
}

const monthIndex = (ymd: string) => {
  const [y, m] = ymd.slice(0, 7).split('-').map(Number);
  return y * 12 + (m - 1);
};

const lifeMonths = (asset: Pick<FixedAsset, 'usefulLifeYears'>) => Math.max(1, Math.round((asset.usefulLifeYears || 1) * 12));

/** Depreciation for each month of the useful life (month 1 = the month after the purchase). */
function monthlyAmounts(asset: FixedAsset): number[] {
  const cost = asset.purchasePriceCents || 0;
  const salvage = Math.min(asset.salvageValueCents || 0, cost);
  const depreciable = Math.max(0, cost - salvage);
  const months = lifeMonths(asset);
  const amounts: number[] = [];
  let accumulated = 0;
  for (let n = 1; n <= months; n++) {
    let amount: number;
    if (n === months) {
      amount = depreciable - accumulated;
    } else if (asset.depreciationMethod === 'declining-balance') {
      const book = cost - accumulated;
      amount = Math.min(Math.round((book * 2) / months), depreciable - accumulated);
    } else {
      amount = Math.min(Math.round(depreciable / months), depreciable - accumulated);
    }
    amount = Math.max(0, amount);
    accumulated += amount;
    amounts.push(amount);
  }
  return amounts;
}

/** Depreciation that should have been posted through the end of a YYYY-MM month. */
export function depreciationThrough(asset: FixedAsset, month: string): number {
  if (!asset.purchaseDate) return 0;
  const elapsed = monthIndex(`${month}-01`) - monthIndex(asset.purchaseDate);
  if (elapsed <= 0) return 0;
  return monthlyAmounts(asset).slice(0, elapsed).reduce((sum, a) => sum + a, 0);
}

/** The full schedule, one entry per month (dated the 1st of the month after each elapsed month). */
export function calculateStraightLineDepreciation(asset: FixedAsset): DepreciationPeriodEntry[] {
  const cost = asset.purchasePriceCents || 0;
  const salvage = asset.salvageValueCents || 0;
  const start = monthIndex(asset.purchaseDate || '1970-01-01');
  let accumulated = 0;
  return monthlyAmounts({ ...asset, depreciationMethod: 'straight-line' }).map((amount, i) => {
    accumulated += amount;
    const index = start + i + 1;
    return {
      periodDate: `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`,
      depreciationAmountCents: amount,
      accumulatedDepreciationCents: accumulated,
      bookValueCents: Math.max(salvage, cost - accumulated),
    };
  });
}

export interface ScheduleMonth { month: string; amountCents: number; accumulatedCents: number; bookValueCents: number; posted: boolean }
export interface ScheduleYear { year: string; amountCents: number; accumulatedCents: number; bookValueCents: number; months: number; posted: boolean }

/**
 * X-02: the whole schedule by the asset's own method, one row per month from the month after the
 * purchase to the end of its life; `posted` for the months the month-end run already covered.
 */
export function depreciationSchedule(asset: FixedAsset): ScheduleMonth[] {
  if (!asset.purchaseDate) return [];
  const cost = asset.purchasePriceCents || 0;
  const start = monthIndex(asset.purchaseDate);
  const postedThrough = asset.depreciatedThrough ? monthIndex(`${asset.depreciatedThrough}-01`) : -1;
  let accumulated = 0;
  return monthlyAmounts(asset).map((amount, i) => {
    accumulated += amount;
    const index = start + i + 1;
    return {
      month: `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
      amountCents: amount, accumulatedCents: accumulated, bookValueCents: cost - accumulated, posted: index <= postedThrough,
    };
  });
}

/** The schedule added up by calendar year (amounts for the year; accumulated and book value at its last month). */
export function scheduleByYear(months: ScheduleMonth[]): ScheduleYear[] {
  const years = new Map<string, ScheduleYear>();
  for (const m of months) {
    const year = m.month.slice(0, 4);
    const row = years.get(year) || { year, amountCents: 0, accumulatedCents: 0, bookValueCents: 0, months: 0, posted: true };
    row.amountCents += m.amountCents;
    row.accumulatedCents = m.accumulatedCents;
    row.bookValueCents = m.bookValueCents;
    row.months++;
    row.posted = row.posted && m.posted;
    years.set(year, row);
  }
  return [...years.values()];
}
