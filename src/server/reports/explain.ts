/**
 * Explain this number (N-12): the lines behind a report figure, read from the full history on the
 * server, with the same rules the reports use (postable entries only, each line's amount in the
 * workspace's currency, the same date range, the account's opening balance when the figure is a
 * balance "as of"). So what is listed adds up to the figure, and a test checks that for the profit
 * and loss, the balance sheet and the trial balance. Each line says the filter that made it, the
 * entry, the document it came from (invoice, bill or the entry itself), whether the bank matched it,
 * and how many files are attached.
 */
import { getLineDimension } from '../../lib/dimensionUtils';
import { isPostable, isTransactionInDateRange, lineAmount } from '../../lib/txFilters';
import { openingDebitCents } from '../../lib/accountUtils';
import type { ChartAccount, Transaction } from '../../types';

export interface ExplainFilter {
  accountIds: string[];
  /** YYYY-MM-DD; none = from the beginning (a balance "as of"), which includes opening balances */
  startDate?: string;
  endDate?: string;
  /** only lines with this label value, e.g. { dimensionId: 'project', value: 'P5' } */
  label?: { dimensionId: string; value: string };
}

export interface ExplainLine {
  /** stable: the entry and the line's place in it, or the account for an opening balance */
  key: string;
  transactionId: string | null;
  date: string;
  description: string;
  payee?: string;
  accountId: string;
  accountName: string;
  /** signed like the books: debits positive, credits negative, in the workspace's currency */
  amountCents: number;
  /** the record it came from */
  document: { type: 'invoice' | 'bill' | 'transaction'; id: string } | null;
  /** the bank statement matched it (reconciled or cleared) */
  bankMatched: boolean;
  /** files attached to its document */
  attachments: number;
  /** an account's opening balance (no entry) */
  opening?: boolean;
}

export interface Explanation {
  filter: ExplainFilter;
  lines: ExplainLine[];
  /** the sum of the lines, signed like the books */
  totalCents: number;
  /** distinct entries listed */
  entries: number;
}

export function explainFigure(accounts: ChartAccount[], transactions: Transaction[], filter: ExplainFilter): Explanation {
  const wanted = new Set(filter.accountIds);
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const lines: ExplainLine[] = [];
  if (!filter.startDate && !filter.label) {
    for (const acc of accounts) {
      const opening = openingDebitCents(acc);
      if (wanted.has(acc.id) && opening !== 0) {
        lines.push({ key: `opening:${acc.id}`, transactionId: null, date: '', description: 'Opening balance', accountId: acc.id, accountName: acc.name, amountCents: opening, document: null, bankMatched: false, attachments: 0, opening: true });
      }
    }
  }
  for (const tx of transactions) {
    if (!isPostable(tx) || !isTransactionInDateRange(tx, filter.startDate, filter.endDate)) continue;
    for (const [position, line] of (tx.lines || []).entries()) {
      if (!wanted.has(line.accountId)) continue;
      if (filter.label && getLineDimension(line, tx, filter.label.dimensionId) !== filter.label.value) continue;
      const meta = (tx.metadata || {}) as Record<string, unknown>;
      const document = typeof meta.invoiceId === 'string' ? { type: 'invoice' as const, id: meta.invoiceId }
        : typeof meta.billId === 'string' ? { type: 'bill' as const, id: meta.billId }
          : { type: 'transaction' as const, id: tx.id };
      lines.push({
        key: `${tx.id}:${position}`,
        transactionId: tx.id,
        date: String(tx.date || '').slice(0, 10),
        description: line.description || tx.description || '',
        ...(tx.payee ? { payee: tx.payee } : {}),
        accountId: line.accountId,
        accountName: names.get(line.accountId) || line.accountName || line.accountId,
        amountCents: lineAmount(line, tx),
        document,
        bankMatched: tx.isCleared === true || tx.status === 'reconciled',
        // files are counted by the caller (they live in `documents`, linked to the invoice or bill)
        attachments: 0,
      });
    }
  }
  lines.sort((a, b) => (a.opening === b.opening ? a.date.localeCompare(b.date) : a.opening ? -1 : 1));
  return { filter, lines, totalCents: lines.reduce((s, l) => s + l.amountCents, 0), entries: new Set(lines.map(l => l.transactionId).filter(Boolean)).size };
}
