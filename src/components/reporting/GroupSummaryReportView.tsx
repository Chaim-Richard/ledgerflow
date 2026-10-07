import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getIdToken } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import type { WorkspaceGroup } from '../../lib/workspaceGroups';
import { averageFromTimeframe, parseRates, rateFromQuote, type TranslationRates } from '../../lib/translationRates';

interface Figures { income: number; cogs: number; grossProfit: number; expense: number; netIncome: number; totalAssets: number; totalLiabilities: number; totalEquity: number }
interface Member extends Figures { workspaceId: string; name: string; currency: string; isBalanced: boolean; translated?: Figures & { cta: number } }
interface Issue { workspaceId: string; transactionId: string; date: string; description: string; amountCents: number; currency: string; withName: string | null; reason: 'missing' | 'undone' | 'amount' | 'outside-group' | 'not-open'; otherAmountCents?: number }
interface Summary { group: { id: string; name: string }; members: Member[]; total: (Figures & { currency: string; cta?: number }) | null; notIncluded: number; intercompany?: { matched: number; unmatched: Issue[] } }

/** Why an intercompany entry has no match (Z-19), in words. */
const whyUnmatched = (i: Issue) => ({
  missing: `Its match in ${i.withName} is missing`,
  undone: `Its match in ${i.withName} was undone`,
  amount: `${formatCurrency(i.otherAmountCents || 0, i.currency)} in ${i.withName}`,
  'outside-group': 'The other company is not in this group',
  'not-open': 'The other company is not one you can open',
}[i.reason]);
type Entered = Record<string, Partial<Record<keyof TranslationRates, string>>>;

const ROWS: Array<{ key: keyof Figures; label: string; report: 'pnl' | 'balance-sheet'; strong?: boolean }> = [
  { key: 'income', label: 'Income', report: 'pnl' },
  { key: 'cogs', label: 'Cost of goods sold', report: 'pnl' },
  { key: 'grossProfit', label: 'Gross profit', report: 'pnl', strong: true },
  { key: 'expense', label: 'Expenses', report: 'pnl' },
  { key: 'netIncome', label: 'Net income', report: 'pnl', strong: true },
  { key: 'totalAssets', label: 'Total assets', report: 'balance-sheet' },
  { key: 'totalLiabilities', label: 'Total liabilities', report: 'balance-sheet' },
  { key: 'totalEquity', label: 'Equity (with this year’s profit)', report: 'balance-sheet' },
];

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await getIdToken()}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'That did not work');
  return data as T;
}

/**
 * Group summary (Z-20): one of your groups of books (Settings → Groups of books) for a period, each
 * company's profit and loss and balance sheet side by side, and the group's total when they all keep
 * their books in the same currency. Each figure opens that company's own report. Read under your own
 * access, never copied (src/server/reports/groupReport.ts). In one currency (Z-17, Z-18): each other
 * currency is translated with the closing, average and historical rates entered (or filled from the
 * rate service), and the translation difference has its own line.
 */
export default function GroupSummaryReportView() {
  const setCurrentWorkspaceId = useAuthStore(s => s.setCurrentWorkspaceId);
  const goToPage = useUIStore(s => s.goToPage);
  const openRecord = useUIStore(s => s.openRecord);
  const [groups, setGroups] = useState<WorkspaceGroup[] | null>(null);
  const [groupId, setGroupId] = useState('');
  const [startDate, setStartDate] = useState(`${getLocalDateISO().slice(0, 4)}-01-01`);
  const [endDate, setEndDate] = useState(getLocalDateISO());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [reportCurrency, setReportCurrency] = useState('');
  const [entered, setEntered] = useState<Entered>({});
  const [filling, setFilling] = useState('');
  const memberCurrencies = [...new Set((summary?.members || []).map(m => m.currency))];
  const foreign = reportCurrency ? memberCurrencies.filter(c => c !== reportCurrency) : [];
  const parsed = parseRates(foreign, entered);
  const translation = reportCurrency && 'rates' in parsed ? { reportCurrency, rates: JSON.stringify(parsed.rates) } : null;
  const query = groupId && startDate && endDate ? new URLSearchParams({ groupId, startDate, endDate, ...(translation || {}) }).toString() : '';

  useEffect(() => {
    let live = true;
    get<{ groups: WorkspaceGroup[] }>('/api/v1/account/groups')
      .then(data => { if (live) { setGroups(data.groups || []); if (data.groups?.[0]) setGroupId(id => id || data.groups[0].id); } })
      .catch(err => { if (live) { setGroups([]); setError(err instanceof Error ? err.message : String(err)); } });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!query) return;
    let live = true;
    get<Summary>(`/api/v1/reports/group-summary?${query}`)
      .then(data => { if (live) { setSummary(data); setError(''); } })
      .catch(err => { if (live) { setSummary(null); setError(err instanceof Error ? err.message : String(err)); } });
    return () => { live = false; };
  }, [query]);

  // Z-17: the rate service fills the three rates of a currency (1 unit in the reporting currency)
  const fill = async (currency: string) => {
    setFilling(currency);
    try {
      const at = (date: string) => get<{ quotes?: Record<string, number> }>(`/api/v1/currency/historical?${new URLSearchParams({ date, source: reportCurrency, currencies: currency })}`);
      const [closing, opening, days] = await Promise.all([
        at(endDate), at(startDate),
        get<{ quotes?: Record<string, Record<string, number>> }>(`/api/v1/currency/timeframe?${new URLSearchParams({ start_date: startDate, end_date: endDate, source: reportCurrency, currencies: currency })}`),
      ]);
      const next = { closing: rateFromQuote(closing.quotes, reportCurrency, currency), average: averageFromTimeframe(days.quotes, reportCurrency, currency), historical: rateFromQuote(opening.quotes, reportCurrency, currency) };
      if (!next.closing || !next.average || !next.historical) throw new Error(`The rate service has no rates for ${currency} on these dates: enter them`);
      setEntered(e => ({ ...e, [currency]: { closing: String(next.closing), average: String(next.average), historical: String(next.historical) } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setFilling('');
    }
  };
  const rateInput = (currency: string, key: keyof TranslationRates, label: string) => (
    <label className="flex flex-col gap-0.5 text-[var(--muted)]">{label}
      <input inputMode="decimal" value={entered[currency]?.[key] ?? ''} onChange={e => setEntered(x => ({ ...x, [currency]: { ...x[currency], [key]: e.target.value } }))}
        className="w-28 px-2 py-1 border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)] text-right font-mono" />
    </label>
  );

  const open = (member: Member, report: 'pnl' | 'balance-sheet') => {
    setCurrentWorkspaceId(member.workspaceId);
    goToPage({ tab: 'reports', sub: report });
    toast.message(`Opened ${member.name}`);
  };
  const currencies = new Set((summary?.members || []).map(m => m.currency));

  return (
    <section aria-labelledby="group-summary-title" className="space-y-4">
      <h2 id="group-summary-title" className="text-lg font-bold text-[var(--text)]">Group summary</h2>
      {groups !== null && groups.length === 0 && !error && (
        <p className="text-sm text-[var(--muted)]">You have no groups of books yet. Make one in Settings → Groups of books.</p>
      )}
      {groups !== null && groups.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 text-[var(--muted)]">Group
            <select value={groupId} onChange={e => setGroupId(e.target.value)} className="px-2 py-1.5 border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]">
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[var(--muted)]">From
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1.5 border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]" />
          </label>
          <label className="flex flex-col gap-1 text-[var(--muted)]">To
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1.5 border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]" />
          </label>
          {memberCurrencies.length > 0 && (
            <label className="flex flex-col gap-1 text-[var(--muted)]">In one currency
              <select value={reportCurrency} onChange={e => setReportCurrency(e.target.value)} className="px-2 py-1.5 border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]">
                <option value="">Each in its own</option>
                {memberCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      {foreign.map(currency => (
        <fieldset key={currency} className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--line)] p-3 text-xs">
          <legend className="px-1 font-semibold text-[var(--text)]">1 {currency} in {reportCurrency}</legend>
          {rateInput(currency, 'closing', `At ${endDate} (assets, liabilities)`)}
          {rateInput(currency, 'average', 'Average (income, costs)')}
          {rateInput(currency, 'historical', 'Historical (equity)')}
          <button type="button" onClick={() => void fill(currency)} disabled={filling !== ''} className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-semibold text-[var(--text)] disabled:opacity-50">
            Fill from the rate service<span className="sr-only"> for {currency}</span>
          </button>
        </fieldset>
      ))}
      {'problem' in parsed && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{parsed.problem} to see the group in {reportCurrency}.</p>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {summary && (
        <>
          {summary.notIncluded > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{summary.notIncluded} workspace{summary.notIncluded === 1 ? '' : 's'} in this group {summary.notIncluded === 1 ? 'is' : 'are'} no longer open to you and {summary.notIncluded === 1 ? 'is' : 'are'} not included.</p>}
          {!summary.total && summary.members.length > 1 && currencies.size > 1 && (
            <p className="text-xs text-[var(--muted)]">No group total: these books are in {[...currencies].join(', ')}. Choose one currency to add them up.</p>
          )}
          {summary.members.filter(m => !m.isBalanced).map(m => (
            <p key={m.workspaceId} role="alert" className="text-xs text-amber-700 dark:text-amber-400">The balance sheet of {m.name} does not balance: check it in its own books.</p>
          ))}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{summary.group.name}: each company side by side</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                  <th scope="col" className="text-left font-semibold py-2"><span className="sr-only">Figure</span></th>
                  {summary.members.map(m => <th key={m.workspaceId} scope="col" className="text-right font-semibold py-2 px-2"><bdi>{m.name}</bdi></th>)}
                  {summary.total && <th scope="col" className="text-right font-semibold py-2 px-2">Group total</th>}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(row => (
                  <tr key={row.key} className={`border-b border-[var(--line)]/50 ${row.strong ? 'font-semibold' : ''}`}>
                    <th scope="row" className="text-left font-normal py-1.5">{row.label}</th>
                    {summary.members.map(m => (
                      <td key={m.workspaceId} className="text-right font-mono py-1.5 px-2">
                        <button type="button" onClick={() => open(m, row.report)} className="hover:underline" title={`Open the ${row.report === 'pnl' ? 'profit and loss' : 'balance sheet'} of ${m.name}`}>
                          {m.translated && summary.total ? formatCurrency(m.translated[row.key], summary.total.currency) : formatCurrency(m[row.key], m.currency)}<span className="sr-only"> {row.label} of {m.name}: open its report</span>
                        </button>
                      </td>
                    ))}
                    {summary.total && <td className="text-right font-mono py-1.5 px-2">{formatCurrency(summary.total[row.key], summary.total.currency)}</td>}
                  </tr>
                ))}
                {summary.members.some(m => m.translated) && summary.total && (
                  <tr className="border-b border-[var(--line)]/50 text-[var(--muted)]">
                    <th scope="row" className="text-left font-normal py-1.5">of which translation difference</th>
                    {summary.members.map(m => <td key={m.workspaceId} className="text-right font-mono py-1.5 px-2">{formatCurrency(m.translated?.cta || 0, summary.total!.currency)}</td>)}
                    <td className="text-right font-mono py-1.5 px-2">{formatCurrency(summary.total.cta || 0, summary.total.currency)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {summary.intercompany && (summary.intercompany.matched > 0 || summary.intercompany.unmatched.length > 0) && (
            <section aria-labelledby="group-dealings-title" className="space-y-2">
              <h3 id="group-dealings-title" className="text-sm font-semibold text-[var(--text)]">Dealings between the companies</h3>
              <p className="text-xs text-[var(--muted)]">
                {summary.intercompany.matched} matched on both sides{summary.intercompany.unmatched.length ? `; ${summary.intercompany.unmatched.length} without a match:` : '.'}
              </p>
              {summary.intercompany.unmatched.length > 0 && (
                <table className="w-full text-xs">
                  <caption className="sr-only">Dealings between the companies without a match</caption>
                  <thead>
                    <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                      <th scope="col" className="text-left font-semibold py-1">Company</th>
                      <th scope="col" className="text-left font-semibold py-1">Entry</th>
                      <th scope="col" className="text-right font-semibold py-1">Amount</th>
                      <th scope="col" className="text-left font-semibold py-1 pl-2">What is wrong</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.intercompany.unmatched.map(i => {
                      const member = summary.members.find(m => m.workspaceId === i.workspaceId);
                      return (
                        <tr key={`${i.workspaceId}-${i.transactionId}`} className="border-b border-[var(--line)]/50">
                          <td className="py-1"><bdi>{member?.name || i.workspaceId}</bdi></td>
                          <td className="py-1">
                            <button type="button" className="text-indigo-600 dark:text-indigo-400 hover:underline"
                              onClick={() => { setCurrentWorkspaceId(i.workspaceId); openRecord({ type: 'transaction', id: i.transactionId }); }}>
                              {i.date}: <bdi>{i.description || 'entry'}</bdi>
                            </button>
                          </td>
                          <td className="py-1 text-right font-mono">{formatCurrency(i.amountCents, i.currency)}</td>
                          <td className="py-1 pl-2">{whyUnmatched(i)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          )}
          <p className="text-xs text-[var(--muted)]">Each company is read from its own books, as you can see them. Dealings between the companies are not taken out of the total yet.</p>
        </>
      )}
    </section>
  );
}
