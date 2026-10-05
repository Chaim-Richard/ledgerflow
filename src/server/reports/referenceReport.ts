import type { Bill, Invoice, Transaction } from '../../types';
import { getAbsoluteTotal, isPostable, isTransactionInDateRange } from '../../lib/txFilters';

export interface ReferenceRow {
  /** The reference as written (cheque number, bank reference, invoice or bill number). */
  reference: string;
  transactionId: string;
  date: string;
  description: string;
  /** Where the reference comes from. */
  source: 'Entry' | 'Invoice' | 'Bill' | 'Reversal';
  /** The entry's size in the base currency (its debits, lineAmount). */
  amountCents: number;
}

export interface TransactionsByReference {
  rows: ReferenceRow[];
  /** How many distinct references there are. */
  referenceCount: number;
  /** Posted entries in the period without any reference (not listed). */
  withoutReference: number;
}

/**
 * Transactions by Reference (J-06): posted entries in the period listed under their reference, so
 * everything about cheque 1042 or invoice INV-0007 is together. An entry's own reference wins;
 * otherwise an invoice or bill posting uses the document's number. Entries that reverse an earlier
 * one are marked "Reversal". Sorted by reference (numbers in order: 2 before 10), then date.
 */
export function computeTransactionsByReference(
  transactions: Transaction[],
  documents: { invoices?: Pick<Invoice, 'id' | 'number'>[]; bills?: Pick<Bill, 'id' | 'number'>[] },
  startDate?: string,
  endDate?: string
): TransactionsByReference {
  const invoiceNumber = new Map((documents.invoices || []).map(i => [i.id, i.number]));
  const billNumber = new Map((documents.bills || []).map(b => [b.id, b.number]));
  const rows: ReferenceRow[] = [];
  let withoutReference = 0;

  for (const tx of transactions) {
    if (!isPostable(tx) || !isTransactionInDateRange(tx, startDate || '1970-01-01', endDate || '2099-12-31')) continue;
    const meta = tx.metadata || {};
    const own = typeof tx.reference === 'string' ? tx.reference.trim() : '';
    const invoiceRef = typeof meta.invoiceId === 'string' ? invoiceNumber.get(meta.invoiceId) : undefined;
    const billRef = typeof meta.billId === 'string' ? billNumber.get(meta.billId) : undefined;
    const reference = own || invoiceRef || billRef || '';
    if (!reference) { withoutReference++; continue; }
    rows.push({
      reference,
      transactionId: tx.id,
      date: tx.date || '',
      description: tx.description || '',
      source: meta.reversesTxId ? 'Reversal' : own ? 'Entry' : invoiceRef ? 'Invoice' : 'Bill',
      amountCents: getAbsoluteTotal(tx),
    });
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  rows.sort((a, b) => collator.compare(a.reference, b.reference) || a.date.localeCompare(b.date));
  const referenceCount = new Set(rows.map(r => r.reference.toLocaleLowerCase())).size;
  return { rows, referenceCount, withoutReference };
}
