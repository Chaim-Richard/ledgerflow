/**
 * A-195: find purchase bills that look like the same expense recorded twice.
 *
 * This is a review cue, never proof: two bills from one vendor for the same amount a few days
 * apart can be two real deliveries. The comparison is exact whole-cent money and a calendar-day
 * window; it never converts currency, never merges, edits or deletes a bill, and it does not
 * decide which of the two is the real one.
 *
 * Void, cancelled and rejected bills are left out of the pairing (they are not a payable), and
 * they are counted so the screen can say how many were skipped.
 */
export type DuplicateBillSignal = 'same-document-number' | 'same-reference' | 'same-day' | 'within-3-days';

export interface ReviewBill {
  id: string;
  vendorId: string;
  vendorName?: string;
  number?: string;
  date?: string;
  amountCents: number;
  currency?: string;
  status?: string;
  metadata?: { poId?: unknown; poNumber?: unknown } & Record<string, unknown>;
}

export interface DuplicateBillSummary {
  id: string;
  vendor: string;
  number: string;
  date: string;
  status: string;
}

export interface DuplicateBillPair {
  key: string;
  left: DuplicateBillSummary;
  right: DuplicateBillSummary;
  amountCents: number;
  currency: string;
  /** Whole calendar days between the two dates; the pair is only reported within the window. */
  daysApart: number;
  signals: DuplicateBillSignal[];
  /** 'documented' means the two bills also share a document number or an order reference. */
  strength: 'documented' | 'date-window';
}

export interface DuplicateBillReview {
  pairs: DuplicateBillPair[];
  /** Void / cancelled / rejected bills: not paired. */
  excludedBills: number;
  /** Bills with no vendor at all cannot be paired by vendor. */
  withoutVendor: number;
  /** More than this many same-vendor/same-amount bills: reported instead of expanded pairwise. */
  ambiguousGroups: number;
  truncated: boolean;
}

export const DATE_WINDOW_DAYS = 3;
export const MAX_DUPLICATE_BILL_PAIRS = 500;
const MAX_AMBIGUOUS_GROUP = 25;

const NON_PAYABLE_STATUSES = new Set(['void', 'cancelled', 'canceled', 'rejected']);

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Numbers and references are compared with their case and spacing removed, nothing else. */
function comparable(value: unknown): string {
  return clean(value).toLowerCase().replace(/\s+/g, '');
}

function dayNumber(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const time = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isFinite(time) ? Math.round(time / 86400000) : null;
}

function summary(bill: ReviewBill): DuplicateBillSummary {
  return {
    id: bill.id,
    vendor: clean(bill.vendorName) || clean(bill.vendorId),
    number: clean(bill.number) || 'No number',
    date: clean(bill.date) || 'No date',
    status: clean(bill.status) || 'No status',
  };
}

function referenceOf(bill: ReviewBill): string {
  const metadata = bill.metadata || {};
  return comparable(metadata.poNumber) || comparable(metadata.poId);
}

/**
 * Pair bills of one vendor, one currency and one amount whose dates are at most three days apart.
 * A shared document number or order reference makes a pair 'documented'; anything else is only a
 * date-window suggestion to look at.
 */
export function findDuplicateBills(bills: readonly ReviewBill[]): DuplicateBillReview {
  let excludedBills = 0;
  let withoutVendor = 0;
  const usable: ReviewBill[] = [];
  for (const bill of bills) {
    if (!bill || !bill.id) continue;
    if (NON_PAYABLE_STATUSES.has(clean(bill.status).toLowerCase())) { excludedBills++; continue; }
    if (!clean(bill.vendorId)) { withoutVendor++; continue; }
    if (!Number.isSafeInteger(bill.amountCents) || bill.amountCents <= 0) continue;
    usable.push(bill);
  }

  const groups = new Map<string, ReviewBill[]>();
  for (const bill of usable) {
    const key = JSON.stringify([bill.vendorId, clean(bill.currency).toUpperCase() || 'HOME', bill.amountCents]);
    const group = groups.get(key);
    if (group) group.push(bill); else groups.set(key, [bill]);
  }

  const pairs: DuplicateBillPair[] = [];
  let ambiguousGroups = 0;
  let truncated = false;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    if (group.length > MAX_AMBIGUOUS_GROUP) { ambiguousGroups++; continue; }
    const ordered = [...group].sort((a, b) => clean(a.date).localeCompare(clean(b.date)) || a.id.localeCompare(b.id));
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const a = ordered[i];
        const b = ordered[j];
        const aDay = dayNumber(clean(a.date));
        const bDay = dayNumber(clean(b.date));
        const daysApart = aDay !== null && bDay !== null ? Math.abs(aDay - bDay) : Number.NaN;
        // A pair without readable dates cannot be placed in the window; it is not reported here.
        if (!Number.isFinite(daysApart) || daysApart > DATE_WINDOW_DAYS) continue;
        if (pairs.length >= MAX_DUPLICATE_BILL_PAIRS) { truncated = true; continue; }
        const sameNumber = Boolean(comparable(a.number)) && comparable(a.number) === comparable(b.number);
        const sameReference = Boolean(referenceOf(a)) && referenceOf(a) === referenceOf(b);
        const signals: DuplicateBillSignal[] = [];
        if (sameNumber) signals.push('same-document-number');
        if (sameReference) signals.push('same-reference');
        if (daysApart === 0) signals.push('same-day'); else signals.push('within-3-days');
        pairs.push({
          key: `${a.id}\u0000${b.id}`,
          left: summary(a),
          right: summary(b),
          amountCents: a.amountCents,
          currency: clean(a.currency).toUpperCase() || 'HOME',
          daysApart,
          signals,
          strength: sameNumber || sameReference ? 'documented' : 'date-window',
        });
      }
    }
  }

  const weight = (pair: DuplicateBillPair) => (pair.strength === 'documented' ? 1 : 0);
  pairs.sort((a, b) => weight(b) - weight(a) || a.daysApart - b.daysApart ||
    a.left.vendor.localeCompare(b.left.vendor) || a.key.localeCompare(b.key));

  return { pairs, excludedBills, withoutVendor, ambiguousGroups, truncated };
}

export const DUPLICATE_BILL_CSV_HEADERS = [
  'Vendor', 'First bill', 'First bill id', 'First date', 'Second bill', 'Second bill id', 'Second date',
  'Amount', 'Currency', 'Days apart', 'Evidence', 'Review strength',
];

/** Amounts are written as a plain decimal; the screen shows the formatted money value. */
export function duplicateBillCsvRows(pairs: readonly DuplicateBillPair[]): Array<Array<string>> {
  return pairs.map(pair => [
    pair.left.vendor,
    pair.left.number, pair.left.id, pair.left.date,
    pair.right.number, pair.right.id, pair.right.date,
    (pair.amountCents / 100).toFixed(2), pair.currency === 'HOME' ? '' : pair.currency,
    String(pair.daysApart),
    pair.signals.map(signal => signal === 'same-document-number' ? 'Same document number'
      : signal === 'same-reference' ? 'Same order reference'
        : signal === 'same-day' ? 'Same day' : 'Within 3 days').join('; '),
    pair.strength === 'documented' ? 'Shared document evidence' : 'Date window only — review',
  ]);
}
