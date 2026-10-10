/**
 * Item-wise registers (CB-12, CB-13): every line that sold or bought a stock item in a period, one
 * row per line, with its document, party, units, price and amount in the document's currency.
 * Sales come from issued invoices (drafts, void and cancelled ones left out); purchases from bills'
 * item lines (J-08), the same documents the stock moves come from.
 */
import type { Bill, Invoice } from '../types';

export interface RegisterRow {
  documentId: string;
  documentType: 'invoice' | 'bill';
  /** the line's place in its document */
  line: number;
  number: string;
  date: string;
  party: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
  currency?: string;
}

const NOT_ISSUED = new Set(['draft', 'void', 'cancelled', 'rejected']);
const day = (d?: string) => String(d || '').slice(0, 10);
const inPeriod = (d: string, from: string, to: string) => Boolean(d) && (!from || d >= from) && (!to || d <= to);

export function salesRegister(invoices: Invoice[], itemName: (id: string) => string, from: string, to: string, itemId = ''): RegisterRow[] {
  return invoices.flatMap(inv => {
    const date = day(inv.date);
    if (NOT_ISSUED.has(String(inv.status)) || !inPeriod(date, from, to)) return [];
    return (inv.items || []).map((l, line) => ({ l, line })).filter(({ l }) => l.itemId && (!itemId || l.itemId === itemId)).map(({ l, line }) => ({
      documentId: inv.id, documentType: 'invoice' as const, line, number: String(inv.number || inv.id), date, party: String(inv.customerName || ''),
      itemId: String(l.itemId), itemName: itemName(String(l.itemId)) || l.description, quantity: Number(l.quantity) || 0,
      unitCents: Math.round(Number(l.rateCents) || 0), amountCents: Math.round(Number(l.amountCents) || 0), currency: inv.currency,
    }));
  }).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number, undefined, { numeric: true }));
}

export function purchaseRegister(bills: Bill[], itemName: (id: string) => string, from: string, to: string, itemId = ''): RegisterRow[] {
  return bills.flatMap(bill => {
    const date = day(bill.date || bill.issueDate);
    if (NOT_ISSUED.has(String(bill.status)) || !inPeriod(date, from, to)) return [];
    return (bill.splits || []).map((l, line) => ({ l, line })).filter(({ l }) => l.itemId && !l.landedCost && (!itemId || l.itemId === itemId)).map(({ l, line }) => {
      const quantity = Number(l.quantity) || 0;
      const amountCents = Math.round(Number(l.amountCents) || 0);
      return {
        documentId: bill.id, documentType: 'bill' as const, line, number: String(bill.number || bill.id), date, party: String(bill.vendorName || ''),
        itemId: String(l.itemId), itemName: itemName(String(l.itemId)) || String(l.description || ''), quantity,
        unitCents: quantity ? Math.round(amountCents / quantity) : 0, amountCents, currency: bill.currency,
      };
    });
  }).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number, undefined, { numeric: true }));
}

/** Units and amount per item, for the register's totals (amounts by currency). */
export function registerTotals(rows: RegisterRow[], home: string): Array<{ itemId: string; itemName: string; quantity: number; amounts: Record<string, number> }> {
  const byItem = new Map<string, { itemId: string; itemName: string; quantity: number; amounts: Record<string, number> }>();
  for (const r of rows) {
    const t = byItem.get(r.itemId) || { itemId: r.itemId, itemName: r.itemName, quantity: 0, amounts: {} };
    t.quantity = Math.round((t.quantity + r.quantity) * 1e6) / 1e6;
    t.amounts[r.currency || home] = (t.amounts[r.currency || home] || 0) + r.amountCents;
    byItem.set(r.itemId, t);
  }
  return [...byItem.values()].sort((a, b) => a.itemName.localeCompare(b.itemName));
}
