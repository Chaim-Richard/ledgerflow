import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { getIdToken } from '../../firebase';
import { formatCurrency } from '../../lib/utils';
import type { SnapshotChange } from '../../lib/closingSnapshot';

/**
 * Closing balance check (CA-06): a closed month's balances on its last day, worked out again by
 * the server from the whole ledger and compared with the snapshot taken when it was closed. "Still
 * as closed" or the accounts that moved since, with the balance then and now. Read only.
 */
interface CheckResult {
  snapshot: { asOfDate: string; takenAt: string; entries: number; accounts: number } | null;
  entriesNow?: number;
  changes: SnapshotChange[];
}

export default function ClosingBalanceCheck({ workspaceId, month, currency }: { workspaceId: string; month: string; currency?: string }) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');
  const money = (cents: number) => formatCurrency(cents, currency || 'USD');

  useEffect(() => {
    if (!workspaceId) return;
    let live = true;
    void (async () => {
      try {
        const token = await getIdToken().catch(() => null);
        const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/periods/${month}/balance-check`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const data = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) throw new Error(data.message || 'The balances could not be checked');
        setResult({ snapshot: data.snapshot ?? null, entriesNow: data.entriesNow, changes: Array.isArray(data.changes) ? data.changes : [] });
        setError('');
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { live = false; };
  }, [workspaceId, month]);

  if (error) return <p role="alert" className="text-sm text-rose-600">{error}</p>;
  if (!result?.snapshot) return null;
  const { snapshot, changes } = result;
  const closedOn = snapshot.takenAt.slice(0, 10);

  return (
    <section aria-labelledby="closing-balance-check" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
      <h2 id="closing-balance-check" className="text-sm font-semibold text-[var(--text)]">Balances since the close</h2>
      {changes.length === 0 ? (
        <p className="text-sm text-[var(--pos)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          Every balance on {snapshot.asOfDate} is still what it was when {month} was closed on {closedOn} ({snapshot.accounts} accounts, {snapshot.entries} entries).
        </p>
      ) : (
        <>
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {changes.length} {changes.length === 1 ? 'account has' : 'accounts have'} a different balance on {snapshot.asOfDate} than when {month} was closed on {closedOn}
              {typeof result.entriesNow === 'number' && result.entriesNow !== snapshot.entries ? ` (${snapshot.entries} entries then, ${result.entriesNow} now)` : ''}.
              The Audit Trail shows what was posted or changed in the closed dates.
            </span>
          </p>
          <table className="w-full text-sm">
            <caption className="sr-only">Balances on {snapshot.asOfDate}: at the close and now</caption>
            <thead>
              <tr className="text-xs text-[var(--muted)] text-left">
                <th scope="col" className="py-1">Account</th>
                <th scope="col" className="py-1 text-right">At the close</th>
                <th scope="col" className="py-1 text-right">Now</th>
                <th scope="col" className="py-1 text-right">Difference</th>
              </tr>
            </thead>
            <tbody>
              {changes.map(c => (
                <tr key={c.accountId} className="border-t border-[var(--line)]">
                  <td className="py-1"><bdi>{c.code ? `${c.code} · ` : ''}{c.name}</bdi></td>
                  <td className="py-1 text-right tabular-nums">{money(c.atCloseCents)}</td>
                  <td className="py-1 text-right tabular-nums">{money(c.nowCents)}</td>
                  <td className="py-1 text-right tabular-nums font-semibold">{money(c.differenceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-[var(--muted)]">Balances are debits positive, credits negative, as in the trial balance.</p>
        </>
      )}
    </section>
  );
}
