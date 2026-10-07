import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getIdToken } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import type { WorkspaceGroup } from '../../lib/workspaceGroups';

interface Figures { income: number; cogs: number; grossProfit: number; expense: number; netIncome: number; totalAssets: number; totalLiabilities: number; totalEquity: number }
interface Member extends Figures { workspaceId: string; name: string; currency: string; isBalanced: boolean }
interface Summary { group: { id: string; name: string }; members: Member[]; total: (Figures & { currency: string }) | null; notIncluded: number }

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
 * access, never copied (src/server/reports/groupReport.ts).
 */
export default function GroupSummaryReportView() {
  const setCurrentWorkspaceId = useAuthStore(s => s.setCurrentWorkspaceId);
  const goToPage = useUIStore(s => s.goToPage);
  const [groups, setGroups] = useState<WorkspaceGroup[] | null>(null);
  const [groupId, setGroupId] = useState('');
  const [startDate, setStartDate] = useState(`${getLocalDateISO().slice(0, 4)}-01-01`);
  const [endDate, setEndDate] = useState(getLocalDateISO());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    get<{ groups: WorkspaceGroup[] }>('/api/v1/account/groups')
      .then(data => { if (live) { setGroups(data.groups || []); if (data.groups?.[0]) setGroupId(id => id || data.groups[0].id); } })
      .catch(err => { if (live) { setGroups([]); setError(err instanceof Error ? err.message : String(err)); } });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!groupId || !startDate || !endDate) return;
    let live = true;
    get<Summary>(`/api/v1/reports/group-summary?${new URLSearchParams({ groupId, startDate, endDate })}`)
      .then(data => { if (live) { setSummary(data); setError(''); } })
      .catch(err => { if (live) { setSummary(null); setError(err instanceof Error ? err.message : String(err)); } });
    return () => { live = false; };
  }, [groupId, startDate, endDate]);

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
        </div>
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {summary && (
        <>
          {summary.notIncluded > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{summary.notIncluded} workspace{summary.notIncluded === 1 ? '' : 's'} in this group {summary.notIncluded === 1 ? 'is' : 'are'} no longer open to you and {summary.notIncluded === 1 ? 'is' : 'are'} not included.</p>}
          {!summary.total && summary.members.length > 1 && currencies.size > 1 && (
            <p className="text-xs text-[var(--muted)]">No group total: these books are in {[...currencies].join(', ')}. Adding them up needs translation rates, which come later.</p>
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
                          {formatCurrency(m[row.key], m.currency)}<span className="sr-only"> {row.label} of {m.name}: open its report</span>
                        </button>
                      </td>
                    ))}
                    {summary.total && <td className="text-right font-mono py-1.5 px-2">{formatCurrency(summary.total[row.key], summary.total.currency)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--muted)]">Each company is read from its own books, as you can see them. Dealings between the companies are not taken out yet.</p>
        </>
      )}
    </section>
  );
}
