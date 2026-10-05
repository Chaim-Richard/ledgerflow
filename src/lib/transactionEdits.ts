import type { Transaction, TransactionLine } from '../types';

/**
 * Change the amount of a simple entry (one debit line, one credit line) from the transaction list
 * (L-147). Both lines get the new size, each keeps its side, so the entry stays balanced and the
 * server's total (worked out from the lines) matches what was typed. Returns null when the entry
 * has more lines or no clear sides: those are changed in the entry dialog.
 */
export function withNewAmount(tx: Pick<Transaction, 'lines'>, cents: number): { lines: TransactionLine[]; totalAmountCents: number } | null {
  const lines = tx.lines || [];
  const amount = Math.abs(Math.round(cents));
  if (lines.length !== 2 || !Number.isFinite(amount)) return null;
  const [a, b] = lines;
  const aCents = a.amountCents || 0;
  const bCents = b.amountCents || 0;
  if (aCents + bCents !== 0 || aCents === 0) return null;
  const side = (n: number) => (n > 0 ? 1 : -1);
  return {
    lines: [{ ...a, amountCents: side(aCents) * amount }, { ...b, amountCents: side(bCents) * amount }],
    totalAmountCents: amount,
  };
}

/**
 * True when an entry belongs to a document or a system run (an invoice, bill, payment, credit,
 * stock change, depreciation, opening balance or reversal): it is changed through that record,
 * never in the list. A bank line or an import batch alone doesn't count.
 */
export function isDocumentEntry(tx: Pick<Transaction, 'metadata'>): boolean {
  const meta = (tx.metadata || {}) as Record<string, unknown>;
  return Object.entries(meta).some(([key, value]) => value !== undefined && value !== null && value !== '' && value !== false
    && key !== 'bankLineId' && key !== 'importBatchId' && (/Ids?$/.test(key) || key === 'type' || key === 'isReversal'));
}

/**
 * True for an entry typed in by hand (I-22): not from a document, not from a bank line, not a
 * transfer, in the workspace currency. Only these get their date or amount changed in place.
 */
export function isHandEntered(tx: Transaction): boolean {
  const meta = (tx.metadata || {}) as Record<string, unknown>;
  return !isDocumentEntry(tx) && !meta.bankLineId && !tx.isTransfer && !tx.originalCurrency && (tx.exchangeRate ?? 1) === 1
    && (tx.lines || []).every(l => (l.exchangeRate ?? 1) === 1);
}

/** A typed-in two-line entry with a new amount above zero (both lines change), else null. */
export function amountChange(tx: Transaction, cents: number): { lines: TransactionLine[]; totalAmountCents: number } | null {
  return isHandEntered(tx) && Number.isInteger(cents) && cents > 0 ? withNewAmount(tx, cents) : null;
}
