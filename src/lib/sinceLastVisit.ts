import type { Bill, Invoice, Transaction } from '../types';

/**
 * "What changed since I last looked" (I-20): counts of what happened in the books after the
 * person's previous visit. Timestamps are ISO strings; records without one are not counted.
 */
export interface ChangesSince {
  newTransactions: number;
  invoicesPaid: number;
  newInvoices: number;
  newBills: number;
}

const after = (iso: string | undefined, since: string) => Boolean(iso && iso > since);

export function changesSince(
  since: string,
  data: { transactions?: Transaction[]; invoices?: Invoice[]; bills?: Bill[] },
): ChangesSince {
  const tx = data.transactions || [];
  const inv = data.invoices || [];
  return {
    newTransactions: tx.filter(t => t.status !== 'void' && t.status !== 'failed' && !t.deletedAt && after(t.createdAt, since)).length,
    invoicesPaid: inv.filter(i => i.status === 'paid' && after(i.updatedAt, since)).length,
    newInvoices: inv.filter(i => i.status !== 'draft' && after(i.createdAt, since)).length,
    newBills: (data.bills || []).filter(b => after(b.createdAt, since)).length,
  };
}

/** "3 new transactions · 1 invoice paid", or '' when nothing changed. */
export function describeChanges(c: ChangesSince): string {
  const part = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : '');
  return [
    part(c.newTransactions, 'new transaction', 'new transactions'),
    part(c.newInvoices, 'new invoice', 'new invoices'),
    part(c.invoicesPaid, 'invoice paid', 'invoices paid'),
    part(c.newBills, 'new bill', 'new bills'),
  ].filter(Boolean).join(' · ');
}

/**
 * The previous visit's time for this person on this device, and records now as the latest visit.
 * Read once per page load, so the card keeps showing the same changes until the next visit.
 */
export function takeLastVisit(key: string, now: string): string | null {
  try {
    const previous = localStorage.getItem(key);
    localStorage.setItem(key, now);
    return previous;
  } catch {
    return null;
  }
}
