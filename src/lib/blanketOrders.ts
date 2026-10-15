/**
 * A-62: blanket purchase orders. A blanket order is an agreement with a total and a validity
 * period; several goods receipts and vendor bills draw it down over time, and the question this
 * answers is "how much of it is left?".
 *
 * What counts as drawn down: only documents explicitly linked to the order — a receipt saved on
 * the order (or carrying its id/number), and a bill carrying `metadata.poId`/`metadata.poNumber`.
 * The three-way match engine also guesses by amount and by number fragments; for drawing down an
 * agreement no guess counts, because a wrong match silently moves money's meaning.
 *
 * A delivery that is recorded both as a receipt and as a bill is one delivery. This report cannot
 * pair receipts with bills (nothing in the documents says which bill covers which receipt), so
 * "used" takes the HIGHER of the two recorded totals — one delivery never draws the agreement
 * twice. When one delivery was only received and another only billed, the true use is higher than
 * this figure: both columns sit beside it so a reviewer sees the two totals, and the screen says
 * this in plain words. Currencies are never converted: a bill in another currency is counted as
 * skipped, never added in.
 *
 * Pure: it reads the documents it is given and writes nothing. Nothing here posts — the order,
 * its receipts and its bills keep their own screens and their own posting paths.
 */
import type { Bill, PurchaseOrder } from '../types';

export interface BlanketAgreement {
  /** the last day the agreement is valid (YYYY-MM-DD) */
  validUntil: string;
  /** the agreed cap in the order's own currency; the order's total when omitted */
  capCents?: number;
}

export type BlanketOrderState = 'open' | 'expiring' | 'expired' | 'exhausted' | 'over-drawn';

export interface BlanketOrderRow {
  poId: string;
  poNumber: string;
  vendorName: string;
  issueDate: string;
  currency: string;
  validUntil: string;
  capCents: number;
  receivedCents: number;
  billedCents: number;
  /** the higher of received and billed — see the note above */
  usedCents: number;
  leftCents: number;
  /** days from today to the last valid day; negative when past it */
  daysLeft: number;
  state: BlanketOrderState;
  receipts: number;
  bills: number;
  /** bills explicitly linked but in another currency: counted here, never added in */
  billsOtherCurrency: number;
}

export interface BlanketOrderReview {
  rows: BlanketOrderRow[];
  /** per currency, never combined */
  totals: Array<{ currency: string; agreements: number; capCents: number; usedCents: number; leftCents: number }>;
  skipped: {
    /** orders the screen could mark as blanket (not marked, not cancelled) */
    notBlanket: number;
    cancelled: number;
    /** a blanket whose validity date is missing or unparseable — refused, never assumed */
    invalidAgreement: number;
    draftsBills: number;
    billsOtherCurrency: number;
    undated: number;
  };
}

export interface BlanketOrderInput {
  orders: Array<Pick<PurchaseOrder, 'id' | 'poNumber' | 'vendorName' | 'issueDate' | 'status' | 'totalAmountCents' | 'currency' | 'receipts'> & { blanket?: BlanketAgreement | null }>;
  bills: Array<Pick<Bill, 'id' | 'vendorId' | 'amountCents' | 'currency' | 'status' | 'metadata'>>;
  today: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const dayNumber = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  // days from 1970-01-01, proleptic Gregorian (the days_from_civil integer algorithm)
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
};

const isRecordedBill = (status: string | undefined) => !['draft', 'void', 'cancelled', 'rejected', 'pending_approval'].includes(String(status || ''));

/** The agreement as it must be to be used: a real date, on or after the order's issue date. */
export function blanketAgreementProblem(input: { validUntil?: unknown; capCents?: unknown; issueDate?: string }): string | null {
  const validUntil = String(input.validUntil || '').slice(0, 10);
  if (!DATE.test(validUntil)) return 'Give the last valid day (YYYY-MM-DD).';
  if (input.issueDate && DATE.test(input.issueDate) && validUntil < input.issueDate) {
    return 'The last valid day cannot be before the order’s issue date.';
  }
  if (input.capCents !== undefined && input.capCents !== null && input.capCents !== '') {
    const cap = Number(input.capCents);
    if (!Number.isFinite(cap) || cap < 0) return 'The cap is an amount of 0 or more, in the order’s currency.';
  }
  return null;
}

function receivedCentsOf(order: BlanketOrderInput['orders'][number]): number {
  return (order.receipts || []).flatMap(receipt => receipt.items || [])
    .filter(item => item.condition === 'good')
    .reduce((sum, item) => sum + Math.round((item.quantityReceived || 0) * (item.unitPriceCents || 0)), 0);
}

/**
 * The review: every marked blanket order with what it says it is, what has been drawn down and
 * what is left. Orders without a `blanket` mark are counted under `skipped.notBlanket` so the
 * screen can offer to mark them; a cancelled order is never an open agreement.
 */
export function blanketOrderReview(input: BlanketOrderInput): BlanketOrderReview {
  const today = input.today;
  const rows: BlanketOrderRow[] = [];
  const skipped = { notBlanket: 0, cancelled: 0, invalidAgreement: 0, draftsBills: 0, billsOtherCurrency: 0, undated: 0 };

  for (const order of input.orders) {
    if (order.status === 'cancelled') { skipped.cancelled += 1; continue; }
    const blanket = order.blanket;
    if (!blanket) { skipped.notBlanket += 1; continue; }
    const validUntil = String(blanket.validUntil || '').slice(0, 10);
    const issueDate = String(order.issueDate || '').slice(0, 10);
    if (blanketAgreementProblem({ validUntil, capCents: blanket.capCents, issueDate })) { skipped.invalidAgreement += 1; continue; }

    const currency = (order.currency || '').toUpperCase();
    const receivedCents = receivedCentsOf(order);
    let billedCents = 0;
    let bills = 0;
    let billsOtherCurrency = 0;
    let draftsBills = 0;
    for (const bill of input.bills) {
      const metadata = (bill.metadata || {}) as { poId?: unknown; poNumber?: unknown };
      const linked = metadata.poId === order.id || metadata.poNumber === order.poNumber;
      if (!linked) continue;
      if (!isRecordedBill(bill.status)) { draftsBills += 1; continue; }
      const billCurrency = (bill.currency || '').toUpperCase();
      if (currency && billCurrency && billCurrency !== currency) { billsOtherCurrency += 1; continue; }
      billedCents += Math.abs(Math.round(bill.amountCents || 0));
      bills += 1;
    }
    skipped.draftsBills += draftsBills;
    skipped.billsOtherCurrency += billsOtherCurrency;

    const capCents = blanket.capCents === undefined || blanket.capCents === null
      ? Math.round(order.totalAmountCents || 0)
      : Math.round(blanket.capCents);
    const usedCents = Math.max(receivedCents, billedCents);
    const leftCents = capCents - usedCents;
    const daysLeft = dayNumber(validUntil) - dayNumber(today);
    const state: BlanketOrderState = daysLeft < 0 ? 'expired'
      : leftCents < 0 ? 'over-drawn'
      : leftCents === 0 ? 'exhausted'
      : daysLeft <= 30 ? 'expiring'
      : 'open';

    rows.push({
      poId: order.id,
      poNumber: order.poNumber,
      vendorName: order.vendorName || '—',
      issueDate,
      currency: currency || '—',
      validUntil,
      capCents,
      receivedCents,
      billedCents,
      usedCents,
      leftCents,
      daysLeft,
      state,
      receipts: (order.receipts || []).length,
      bills,
      billsOtherCurrency,
    });
  }

  rows.sort((a, b) => a.state.localeCompare(b.state) || a.daysLeft - b.daysLeft || a.poNumber.localeCompare(b.poNumber));

  const byCurrency = new Map<string, { currency: string; agreements: number; capCents: number; usedCents: number; leftCents: number }>();
  for (const row of rows) {
    const bucket = byCurrency.get(row.currency) || { currency: row.currency, agreements: 0, capCents: 0, usedCents: 0, leftCents: 0 };
    bucket.agreements += 1;
    bucket.capCents += row.capCents;
    bucket.usedCents += row.usedCents;
    bucket.leftCents += row.leftCents;
    byCurrency.set(row.currency, bucket);
  }

  return { rows, totals: [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)), skipped };
}

export const BLANKET_CSV_HEADERS: string[] = ['Order', 'Vendor', 'Issued', 'Valid until', 'Currency', 'Cap', 'Received', 'Billed', 'Used (higher of the two)', 'Left', 'State', 'Receipts', 'Bills', 'Bills in another currency'];

export function blanketCsvRows(review: BlanketOrderReview): string[][] {
  return review.rows.map(row => [
    row.poNumber,
    row.vendorName,
    row.issueDate,
    row.validUntil,
    row.currency,
    (row.capCents / 100).toFixed(2),
    (row.receivedCents / 100).toFixed(2),
    (row.billedCents / 100).toFixed(2),
    (row.usedCents / 100).toFixed(2),
    (row.leftCents / 100).toFixed(2),
    row.state,
    String(row.receipts),
    String(row.bills),
    String(row.billsOtherCurrency),
  ]);
}

/** The words for a state, the way the screen shows them. */
export function blanketStateLabel(state: BlanketOrderState): string {
  switch (state) {
    case 'open': return 'Open';
    case 'expiring': return 'Expiring (30 days)';
    case 'expired': return 'Expired';
    case 'exhausted': return 'Fully used';
    case 'over-drawn': return 'Over-drawn';
  }
}
