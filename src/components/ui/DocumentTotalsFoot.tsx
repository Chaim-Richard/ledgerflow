import { documentTotals } from '../../lib/documentTotals';
import { formatCurrency } from '../../lib/utils';

interface DocumentTotalsFootProps {
  docs: Parameters<typeof documentTotals>[0];
  homeCurrency: string;
  /** Number of columns in the table. */
  colSpan: number;
  /** e.g. "invoice" */
  noun: string;
}

/** The totals row under an invoice or bill list (I-14); stays visible at the bottom while scrolling. */
export default function DocumentTotalsFoot({ docs, homeCurrency, colSpan, noun }: DocumentTotalsFootProps) {
  const totals = documentTotals(docs, homeCurrency);
  if (totals.length === 0) return null;
  return (
    <tfoot className="sticky bottom-0 z-10 bg-[var(--surface)] border-t-2 border-[var(--line)]">
      {totals.map(t => (
        <tr key={t.currency} aria-label={`Totals in ${t.currency}`}>
          <td colSpan={colSpan} className="px-4 md:px-8 py-2 text-xs text-[var(--muted)]">
            <span className="flex flex-wrap justify-end items-baseline gap-x-6 gap-y-1">
              <span>{t.count} {noun}{t.count === 1 ? '' : 's'}{totals.length > 1 ? ` in ${t.currency}` : ''} (drafts and voided not counted)</span>
              <span>Total <strong className="tabular-nums text-sm text-[var(--text)]">{formatCurrency(t.amountCents, t.currency)}</strong></span>
              <span>Still due <strong className="tabular-nums text-sm text-[var(--text)]">{formatCurrency(t.dueCents, t.currency)}</strong></span>
            </span>
          </td>
        </tr>
      ))}
    </tfoot>
  );
}
