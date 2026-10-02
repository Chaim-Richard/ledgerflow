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
