import React, { useMemo, useState } from 'react';
import { Coins } from 'lucide-react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { useUIStore } from '../../../stores/useUIStore';
import { useLedgerCollections } from '../../../hooks/useLedgerCollections';
import { currenciesInUse } from '../../../lib/exchangeRates';
import { ISO_CURRENCY_REFERENCE, ISO_CURRENCY_REFERENCE_AS_OF, searchIsoCurrencyReference } from '../../../lib/isoCurrencyReference';
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
  const [currencySearch, setCurrencySearch] = useState('');
  const referenceRows = useMemo(() => searchIsoCurrencyReference(currencySearch), [currencySearch]);
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

      <section aria-labelledby="currency-reference-title" className="space-y-3 border-t border-[var(--line)] pt-4">
        <div>
          <h3 id="currency-reference-title" className="text-base font-semibold text-[var(--text)]">ISO 4217 currency reference</h3>
          <p className="text-xs text-[var(--muted)]">Current SIX List One data as of {ISO_CURRENCY_REFERENCE_AS_OF}. Minor-unit digits are ISO data; symbols are display hints that may vary by locale. When no symbol is listed, the currency code is shown. This reference does not set a transaction currency or exchange rate.</p>
        </div>
        <label htmlFor="currency-reference-search" className="block text-sm font-medium text-[var(--text)]">Search by code, name or symbol</label>
        <input
          id="currency-reference-search"
          type="search"
          value={currencySearch}
          onChange={event => setCurrencySearch(event.target.value)}
          placeholder="e.g. USD, yen, or €"
          className="min-h-11 w-full sm:max-w-lg rounded border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--text)]"
        />
        <p className="text-xs text-[var(--muted)]" aria-live="polite">Showing {referenceRows.length} of {ISO_CURRENCY_REFERENCE.length} currency codes.</p>
        {referenceRows.length === 0 ? <p className="text-sm text-[var(--muted)]">No ISO 4217 currencies match this search.</p> : (
          <div className="max-h-[32rem] overflow-auto rounded border border-[var(--line)]">
            <table className="w-full text-sm">
              <caption className="sr-only">ISO 4217 currency codes, names, symbols and minor-unit digits</caption>
              <thead className="sticky top-0 bg-[var(--panel)] text-xs text-[var(--muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">Code</th>
                  <th scope="col" className="px-3 py-2 text-left">Currency</th>
                  <th scope="col" className="px-3 py-2 text-left">Symbol</th>
                  <th scope="col" className="px-3 py-2 text-right">Minor-unit digits</th>
                  <th scope="col" className="px-3 py-2 text-right">Numeric code</th>
                </tr>
              </thead>
              <tbody>
                {referenceRows.map(currency => (
                  <tr key={currency.code} className="border-t border-[var(--line)]/50">
                    <th scope="row" className="px-3 py-1.5 text-left font-mono">{currency.code}</th>
                    <td className="px-3 py-1.5">{currency.name}</td>
                    <td className="px-3 py-1.5 font-mono" aria-label={currency.symbol ? `Symbol ${currency.symbol}` : `No symbol listed; use ${currency.code}`}>{currency.symbol ?? currency.code}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{currency.minorUnitDigits ?? 'N.A.'}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{currency.numeric}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {rows.some(r => r.open > 0) && <FxRevaluationPanel />}
    </section>
  );
}
