/**
 * Totals under the invoice and bill lists (I-14): what the shown documents add up to and what is
 * still due, one line per currency (amounts in different currencies are never added together).
 * Drafts and voided documents are not counted: they are not owed.
 */
import { calculateAmountDue } from './documentMath';

export interface DocumentTotal { currency: string; count: number; amountCents: number; dueCents: number }

const NOT_OWED = new Set(['draft', 'void', 'cancelled', 'rejected']);

export function documentTotals(
  docs: Array<{ status?: string; currency?: string; amountCents?: number; amountPaidCents?: number; depositCents?: number }>,
  homeCurrency: string,
): DocumentTotal[] {
  const byCurrency = new Map<string, DocumentTotal>();
  for (const doc of docs) {
    if (NOT_OWED.has(String(doc.status))) continue;
    const currency = (doc.currency || homeCurrency).toUpperCase();
    const total = byCurrency.get(currency) ?? { currency, count: 0, amountCents: 0, dueCents: 0 };
    total.count += 1;
    total.amountCents += Math.max(0, doc.amountCents || 0);
    total.dueCents += calculateAmountDue(doc);
    byCurrency.set(currency, total);
  }
  // the home currency first, then the others A–Z
  return [...byCurrency.values()].sort((a, b) => Number(b.currency === homeCurrency.toUpperCase()) - Number(a.currency === homeCurrency.toUpperCase()) || a.currency.localeCompare(b.currency));
}
