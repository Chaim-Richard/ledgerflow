import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { findBalanceBreak } from '../../lib/balanceBreak';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';

/**
 * Since when don't the books balance? (A-4, CA-34): the panel on Data Health that answers it. When
 * the balance sheet is off, `src/lib/balanceBreak.ts` halves the date range of the entries to find
 * the first day it was off, and this shows that day's entries with the amount each contributes,
 * each opening in the usual record viewer.
 *
 * Read-only, like the rest of Data Health: it says what it found and changes nothing. The figures
 * come from the report code (`computeBalanceSheet`) over the history loaded here, the same entries
 * the checks above use.
 */
export default function BalanceBreakPanel() {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const currency = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';
  const openRecord = useUIStore(s => s.openRecord);
  const today = getLocalDateISO();

  const result = useMemo(() => findBalanceBreak(accounts || [], transactions || [], today), [accounts, transactions, today]);
  const money = (cents: number) => formatCurrency(cents, currency);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3" aria-labelledby="balance-break">
      <h2 id="balance-break" className="text-sm font-bold flex items-center gap-2 text-[var(--text)]">
        <Scale size={16} className="text-[var(--brass)]" aria-hidden="true" />
        Since when don&apos;t the books balance?
      </h2>

      {result.balanced ? (
        <p className="text-sm text-[var(--pos)] flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden="true" />
          The books balance on {result.endDate}: what the workspace owns and what is owed against it agree to the cent.
        </p>
      ) : (
        <>
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              The books stopped balancing on <strong>{result.firstUnbalancedDate}</strong>
              {result.lastBalancedDate
                ? <>; they still balanced on {result.lastBalancedDate}</>
                : <> — the first entries in the loaded history are already off</>}
              . Found in {result.probes} report probe{result.probes === 1 ? '' : 's'}, by halving the dates that carry an entry.
            </span>
          </p>

          <p className="text-xs text-[var(--muted)]">
            At {result.endDate} the balance sheet is off by {money(Math.abs(result.differenceCents))}
            {result.differenceCents > 0
              ? ' — it shows more assets than the liabilities, equity and profit account for.'
              : ' — it shows more owed against the assets than the assets hold.'}
            {result.differenceBeforeCents === 0
              ? ' Nothing before that day moved the difference.'
              : ` It was already off by ${money(Math.abs(result.differenceBeforeCents))} before that day.`}
          </p>

          <ul className="space-y-2">
            {result.entries.map(entry => (
              <li key={entry.transactionId} className="p-4 rounded-xl border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[var(--text)]">
                  <p className="text-sm font-semibold">{entry.description}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {entry.date} · {entry.offCents === 0
                      ? 'its own lines balance; it moves the difference through a line the sheet cannot place'
                      : `off by ${money(Math.abs(entry.offCents))}${entry.offCents > 0 ? ' (adds to the difference)' : ' (takes away from it)'}`}
                    {entry.missingAccounts.length > 0 && ` · it uses ${entry.missingAccounts.join(', ')}, which ${entry.missingAccounts.length === 1 ? 'is' : 'are'} not in the chart of accounts`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openRecord({ type: 'transaction', id: entry.transactionId })}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--line)] text-[var(--text)] shrink-0 self-start sm:self-auto"
                >
                  Open the entry
                </button>
              </li>
            ))}
            {result.entries.length === 0 && (
              <li className="text-xs text-[var(--muted)]">
                No entry is dated {result.firstUnbalancedDate} in the loaded history, so an opening balance or an entry loaded from another day is the cause.
              </li>
            )}
          </ul>

          <p className="text-xs text-[var(--muted)]">
            Read-only: this check never changes anything. Open the entry and correct its lines, or reverse it and enter it again.
          </p>
        </>
      )}
    </section>
  );
}
