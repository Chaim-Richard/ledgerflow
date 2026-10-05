/**
 * Expected bills (K-21): vendors that bill on a rhythm (the phone company monthly, the accountant
 * quarterly) are learned from the bills already recorded, so a bill that hasn't arrived is noticed.
 * A vendor needs at least three bills whose gaps are regular; the next one is expected one usual
 * gap after the last, for about the usual amount (the middle of the recent ones, with their range).
 * Vendors with a recurring bill schedule are left out (those bills are made automatically), and so
 * are vendors marked "bills not expected". Dates are compared as calendar days (no time zones).
 */
import type { Bill, Vendor } from '../types';

export interface ExpectedBill {
  vendorId: string;
  vendorName: string;
  /** The vendor's latest bill (to copy when recording the next one). */
  lastBillId: string;
  lastDate: string;
  expectedDate: string;
  cadenceDays: number;
  typicalCents: number;
  minCents: number;
  maxCents: number;
  currency?: string;
  /** Days past the expected date (0 when not yet due). */
  daysLate: number;
  late: boolean;
}

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY_MS);
const fromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export interface ExpectedBillOptions {
  /** Show bills expected within this many days (default 10). */
  aheadDays?: number;
  /** Vendors whose bills are made by a recurring schedule. */
  scheduledVendorIds?: Set<string>;
}

/** The bills expected soon or already late, the latest first; `today` is YYYY-MM-DD. */
export function expectedBills(bills: Bill[], vendors: Pick<Vendor, 'id' | 'name'>[], today: string, options: ExpectedBillOptions = {}): ExpectedBill[] {
  const ahead = options.aheadDays ?? 10;
  const todayN = dayNumber(today);
  const vendorById = new Map(vendors.map(v => [v.id, v as Pick<Vendor, 'id' | 'name'> & Partial<Pick<Vendor, 'billsExpected' | 'status'>>]));
  const byVendor = new Map<string, Array<Bill & { date: string }>>();
  for (const b of bills) {
    if (!b.vendorId || !b.date || b.status === 'void' || b.status === 'draft') continue;
    byVendor.set(b.vendorId, [...(byVendor.get(b.vendorId) || []), { ...b, date: b.date.slice(0, 10) }]);
  }
  const out: ExpectedBill[] = [];
  for (const [vendorId, list] of byVendor) {
    const vendor = vendorById.get(vendorId);
    if (!vendor || vendor.billsExpected === false || vendor.status === 'archived' || vendor.status === 'inactive' || options.scheduledVendorIds?.has(vendorId)) continue;
    // one bill per day at most (two bills on one day are one delivery), the latest six
    const days = [...new Map(list.map(b => [b.date, b])).values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
    if (days.length < 3) continue;
    const gaps = days.slice(1).map((b, i) => dayNumber(b.date) - dayNumber(days[i].date));
    const cadence = median(gaps);
    if (cadence < 6 || cadence > 100) continue;
    if (!gaps.every(g => Math.abs(g - cadence) <= Math.max(4, cadence * 0.25))) continue; // not a rhythm
    const last = days[days.length - 1];
    const expectedN = dayNumber(last.date) + cadence;
    const grace = Math.max(3, Math.round(cadence * 0.15));
    if (expectedN - todayN > ahead) continue;
    const amounts = days.map(b => b.amountCents || 0);
    const daysLate = Math.max(0, todayN - expectedN);
    out.push({
      vendorId, vendorName: vendor.name || last.vendorName || 'Vendor', lastBillId: last.id, lastDate: last.date,
      expectedDate: fromDayNumber(expectedN), cadenceDays: cadence, typicalCents: median(amounts), minCents: Math.min(...amounts), maxCents: Math.max(...amounts),
      currency: last.currency, daysLate, late: daysLate > grace,
    });
  }
  return out.sort((a, b) => Number(b.late) - Number(a.late) || a.expectedDate.localeCompare(b.expectedDate) || a.vendorName.localeCompare(b.vendorName));
}

/** "every month", "every 2 weeks", "every 3 months", "every 10 days". */
export function cadenceLabel(days: number): string {
  if (days >= 26 && days <= 35) return 'every month';
  if (days >= 84 && days <= 98) return 'every 3 months';
  if (days >= 55 && days <= 66) return 'every 2 months';
  if (days >= 13 && days <= 15) return 'every 2 weeks';
  if (days >= 6 && days <= 8) return 'every week';
  return `every ${days} days`;
}

/** Vendors whose bills come from an active recurring bill schedule (BE-08). */
export function scheduledBillVendors(schedules: Array<{ type?: string; isActive?: boolean; status?: string; billTemplate?: { vendorId?: string }; template?: { vendorId?: string } }>): Set<string> {
  const ids = new Set<string>();
  for (const s of schedules) {
    if (!(s.type === 'bill' || s.billTemplate) || s.isActive === false || s.status === 'paused') continue;
    const id = s.billTemplate?.vendorId || s.template?.vendorId;
    if (id) ids.add(id);
  }
  return ids;
}
