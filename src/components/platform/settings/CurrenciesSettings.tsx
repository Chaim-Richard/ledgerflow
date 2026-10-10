import React, { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { useUIStore } from '../../../stores/useUIStore';
import { useLedgerCollections } from '../../../hooks/useLedgerCollections';
import { currenciesInUse } from '../../../lib/exchangeRates';
import { isOpenBill, isOpenInvoice } from '../../../lib/txFilters';
import { formatDate } from '../../../lib/utils';
import FxRevaluationPanel from '../../finance/FxRevaluationPanel';

/**
 * Settings → Currencies (BB-02): the workspace's own currency, every other currency its invoices and
 * bills use (how many, how many still open, the last rate posted and when), the rates used over time
 * (Reports → Exchange Rates Used), and the month-end revaluation of what is still open (R-07), which
 * until now was only inside the currency converter. A rate is never invented: each document keeps
 * the rate it was posted at.
 */
export default function CurrenciesSettings() {
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const invoices = useLedgerStore(s => s.invoices);
  const bills = useLedgerStore(s => s.bills);
  const goToPage = useUIStore(s => s.goToPage);
  useLedgerCollections('bills', 'invoices');
  const home = workspace?.currency || 'USD';
  const rows = useMemo(() => currenciesInUse(home, [
    ...(invoices || []).map(i => ({ currency: i.currency, exchangeRate: i.exchangeRate, date: i.date, open: isOpenInvoice(i) })),
    ...(bills || []).map(b => ({ currency: b.currency, exchangeRate: b.exchangeRate, date: b.date, open: isOpenBill(b) })),
  ]), [home, invoices, bills]);
  if (!workspace) return null;

  return (
    <section aria-labelledby="currencies-title" className="space-y-4">
      <div>
        <h2 id="currencies-title" className="text-lg font-bold text-[var(--text)] flex items-center gap-2"><Coins className="w-5 h-5" aria-hidden="true" /> Currencies</h2>
        <p className="text-sm text-[var(--muted)]">The books are kept in <strong>{home}</strong>. An invoice or bill in another currency keeps the rate it was posted at; reports show it in {home}.</p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-[var(--muted)]">No invoice or bill uses another currency yet. Choose one on the document; its rate is filled from the last one used or today's rate.</p> : (
        <table className="w-full text-sm">
          <caption className="sr-only">Currencies used besides {home}</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
              <th scope="col" className="text-left font-semibold py-1">Currency</th>
              <th scope="col" className="text-right font-semibold py-1">Invoices and bills</th>
              <th scope="col" className="text-right font-semibold py-1">Still open</th>
              <th scope="col" className="text-right font-semibold py-1">Last rate (1 = … {home})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.currency} className="border-b border-[var(--line)]/50">
                <th scope="row" className="text-left font-mono py-1">{r.currency}</th>
                <td className="text-right py-1">{r.documents}</td>
                <td className="text-right py-1">{r.open}</td>
                <td className="text-right font-mono py-1">{r.lastRate ? `${r.lastRate} on ${formatDate(r.lastDate || '')}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" onClick={() => goToPage({ tab: 'reports', sub: 'exchange-rates-used' })} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        See every rate used, day by day (Reports → Exchange Rates Used)
      </button>
      {rows.some(r => r.open > 0) && <FxRevaluationPanel />}
    </section>
  );
}
