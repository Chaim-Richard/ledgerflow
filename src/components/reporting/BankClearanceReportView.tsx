import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useUIStore } from '../../stores/useUIStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { formatCurrency, formatDate, getLocalDateISO } from '../../lib/utils';
import { isCashAccount } from '../../lib/txFilters';
import { bankClearance } from '../../lib/bankClearance';

const field = 'px-2 py-1.5 border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]';

/**
 * Bank clearance summary (CB-24): for a bank account and a period, each entry on it and the day the
 * bank cleared it (from the matched statement lines), and at the end what is still outstanding, with
 * the balance the bank should show (src/lib/bankClearance.ts). Each entry opens.
 */
export default function BankClearanceReportView() {
  const { loading } = useLedgerCollections('accounts', 'transactions', 'bankLines');
  const currency = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const bankLines = useLedgerStore(s => s.bankLines);
  const openRecord = useUIStore(s => s.openRecord);
  const banks = (accounts || []).filter(a => !a.isArchived && isCashAccount(a)).sort((a, b) => a.name.localeCompare(b.name));
  const [picked, setPicked] = useState('');
  const accountId = picked || banks[0]?.id || '';
  const [from, setFrom] = useState(`${getLocalDateISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(getLocalDateISO());
  const summary = accountId && from <= to ? bankClearance(accountId, transactions || [], bankLines || [], from, to) : null;
  const money = (cents: number) => formatCurrency(cents, currency);

  return (
    <section aria-labelledby="bank-clearance-title" className="space-y-4">
      <h2 id="bank-clearance-title" className="text-lg font-bold text-[var(--text)]">Bank clearance summary</h2>
      {banks.length === 0 ? <p className="text-sm text-[var(--muted)]">No bank or cash account yet.</p> : (
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 text-[var(--muted)]">Bank account
            <select value={accountId} onChange={e => setPicked(e.target.value)} className={field}>
              {banks.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[var(--muted)]">From<input type="date" value={from} onChange={e => setFrom(e.target.value)} className={field} /></label>
          <label className="flex flex-col gap-1 text-[var(--muted)]">To<input type="date" value={to} onChange={e => setTo(e.target.value)} className={field} /></label>
        </div>
      )}
      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {summary && (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[['Book balance', summary.bookBalanceCents], ['Deposits not yet on the statement', summary.outstandingInCents], ['Payments not yet taken', summary.outstandingOutCents], ['The bank should show', summary.bankBalanceCents]].map(([label, cents]) => (
              <div key={label} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                <dt className="text-xs text-[var(--muted)]">{label} on {formatDate(to)}</dt>
                <dd className="font-mono font-semibold text-[var(--text)]">{money(Number(cents))}</dd>
              </div>
            ))}
          </dl>
          {summary.rows.length === 0 ? <p className="text-sm text-[var(--muted)]">No entries on this account in the period.</p> : (
            <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <table className="w-full text-sm">
                <caption className="text-left text-xs text-[var(--muted)] pb-1">Each entry on the account in the period and the day the bank cleared it (its matched statement line).</caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
                    <th scope="col" className="text-left font-semibold py-1 px-2">Date</th>
                    <th scope="col" className="text-left font-semibold py-1 px-2">Entry</th>
                    <th scope="col" className="text-right font-semibold py-1 px-2">In</th>
                    <th scope="col" className="text-right font-semibold py-1 px-2">Out</th>
                    <th scope="col" className="text-left font-semibold py-1 px-2">Cleared</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map(r => (
                    <tr key={r.id} className="border-b border-[var(--line)]/50">
                      <td className="py-1 px-2 font-mono text-xs">{formatDate(r.date)}</td>
                      <td className="py-1 px-2">
                        <button type="button" className="text-left text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => openRecord({ type: 'transaction', id: r.id })}>
                          <bdi>{r.description || 'Entry'}</bdi><span className="sr-only"> on {r.date}: open it</span>
                        </button>
                      </td>
                      <td className="text-right font-mono py-1 px-2">{r.amountCents > 0 ? money(r.amountCents) : ''}</td>
                      <td className="text-right font-mono py-1 px-2">{r.amountCents < 0 ? money(-r.amountCents) : ''}</td>
                      <td className="py-1 px-2 text-xs">{r.clearedOn === null || (r.clearedOn && r.clearedOn > to) ? <span className="text-amber-700 dark:text-amber-400">Outstanding</span> : r.clearedOn ? formatDate(r.clearedOn) : 'Reconciled'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
