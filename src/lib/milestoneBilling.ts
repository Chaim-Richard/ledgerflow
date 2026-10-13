/**
 * A-73: milestone billing view (V-09 data). For a sales order with a milestone schedule: each
 * milestone's amount, what has been invoiced, what is left, and whether the next one is due. Read
 * only: invoicing a milestone is the existing K-04 path, and this module changes nothing.
 *
 * Amounts use the cumulative percentage so the rounding never drifts: each milestone's amount is the
 * difference of rounded cumulative shares, so the amounts add up exactly to the rounded total of
 * the scheduled percentage. Percentages not covered by any milestone are reported as unscheduled.
 */
import type { Milestone } from './milestones';

export type MilestoneStatus = 'invoiced' | 'due' | 'upcoming';

export interface MilestoneBillingRow {
  label: string;
  percent: number;
  amountCents: number;
  due?: string;
  invoicedAt?: string;
  status: MilestoneStatus;
}

export interface MilestoneBilling {
  orderTotalCents: number;
  rows: MilestoneBillingRow[];
  invoicedCents: number;
  leftCents: number;
  /** the percentage of the order no milestone covers */
  unscheduledPercent: number;
}

/** Whole-cent share of a total at a percentage given in hundredths of a percent (10000 = 100%). */
const shareCents = (total: bigint, hundredths: number) => Number((total * BigInt(hundredths) + 5000n) / 10000n);

export function milestoneBilling(orderTotalCents: number, milestones: Milestone[] | undefined, today: string): MilestoneBilling {
  const total = BigInt(Math.max(0, Math.round(orderTotalCents || 0)));
  const list = milestones || [];
  let cumulative = 0; // in hundredths of a percent
  let previous = 0;
  const rows: MilestoneBillingRow[] = list.map(m => {
    cumulative += Math.round(m.percent * 100);
    const upTo = shareCents(total, cumulative);
    const amountCents = upTo - previous;
    previous = upTo;
    const status: MilestoneStatus = m.invoicedAt ? 'invoiced' : m.due && m.due <= today ? 'due' : 'upcoming';
    return { label: m.label, percent: m.percent, amountCents, ...(m.due ? { due: m.due } : {}), ...(m.invoicedAt ? { invoicedAt: m.invoicedAt } : {}), status };
  });
  const invoicedCents = rows.filter(r => r.status === 'invoiced').reduce((s, r) => s + r.amountCents, 0);
  const scheduledPercent = Math.round(cumulative) / 100;
  return {
    orderTotalCents: Number(total),
    rows,
    invoicedCents,
    leftCents: Number(total) - invoicedCents,
    unscheduledPercent: Math.max(0, Math.round((100 - scheduledPercent) * 100) / 100),
  };
}

export const MILESTONE_BILLING_CSV_HEADERS = ['Milestone', 'Percent', 'Amount (minor units)', 'Due', 'Status', 'Invoiced on'];

export function milestoneBillingCsvRows(billing: MilestoneBilling): Array<Array<string | number>> {
  return billing.rows.map(r => [r.label, r.percent, r.amountCents, r.due || '', r.status, r.invoicedAt || '']);
}
