/**
 * Deferred-revenue waterfall (J-14), and the same for prepaid expenses: for each invoice (or bill)
 * spread over months (K-16, K-17), what is earned (or expensed) in each month of the period, how much
 * of it is earned by the end of the period and how much is still deferred after it. Read from the
 * monthly entries themselves (not the schedule), so a voided share is not counted.
 */

export type SpreadSide = 'invoice' | 'bill';

interface Entry {
  id: string;
  date?: string;
  status?: string;
  totalAmountCents?: number;
  metadata?: Record<string, unknown>;
}
interface Doc { id: string; number?: string; customerName?: string; vendorName?: string }

export interface WaterfallRow {
  id: string;
  label: string;
  byMonth: Record<string, number>;
  /** shares dated on or before the period's end */
  earnedCents: number;
  /** shares dated after the period's end */
  deferredCents: number;
}

export interface Waterfall {
  months: string[];
  rows: WaterfallRow[];
  totals: { byMonth: Record<string, number>; earnedCents: number; deferredCents: number };
}

const SIDE = {
  invoice: { type: 'revenue-recognition', tag: 'spreadOfInvoiceId', party: 'customerName' as const, word: 'Invoice' },
  bill: { type: 'prepaid-recognition', tag: 'spreadOfBillId', party: 'vendorName' as const, word: 'Bill' },
};

/** 'YYYY-MM' months from start to end (at most 36). */
export function monthsBetween(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let [y, m] = startDate.slice(0, 7).split('-').map(Number);
  const end = endDate.slice(0, 7);
  while (out.length < 36) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    if (month > end) break;
    out.push(month);
    if (m === 12) { y += 1; m = 1; } else m += 1;
  }
  return out;
}

export function spreadWaterfall(entries: Entry[], documents: Doc[], side: SpreadSide, period: { startDate: string; endDate: string }): Waterfall {
  const { type, tag, party, word } = SIDE[side];
  const months = monthsBetween(period.startDate, period.endDate);
  const inPeriod = new Set(months);
  const docs = new Map(documents.map(d => [d.id, d]));
  const rows = new Map<string, WaterfallRow>();
  for (const e of entries) {
    if (e.status === 'void' || e.metadata?.type !== type || typeof e.metadata?.[tag] !== 'string' || !e.date) continue;
    const docId = String(e.metadata[tag]);
    const doc = docs.get(docId);
    const row = rows.get(docId) || { id: docId, label: doc ? `${word} ${doc.number || docId}${doc[party] ? ` · ${doc[party]}` : ''}` : `${word} ${docId}`, byMonth: {}, earnedCents: 0, deferredCents: 0 };
    const cents = Math.abs(Number(e.totalAmountCents) || 0);
    const date = e.date.slice(0, 10);
    const month = date.slice(0, 7);
    if (inPeriod.has(month) && date >= period.startDate) row.byMonth[month] = (row.byMonth[month] || 0) + cents;
    if (date <= period.endDate) row.earnedCents += cents;
    else row.deferredCents += cents;
    rows.set(docId, row);
  }
  const list = [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
  const totals = { byMonth: {} as Record<string, number>, earnedCents: 0, deferredCents: 0 };
  for (const r of list) {
    for (const [month, cents] of Object.entries(r.byMonth)) totals.byMonth[month] = (totals.byMonth[month] || 0) + cents;
    totals.earnedCents += r.earnedCents;
    totals.deferredCents += r.deferredCents;
  }
  return { months, rows: list, totals };
}
