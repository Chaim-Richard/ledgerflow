import React, { useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { getIdToken } from '../../firebase';
import { formatCurrency } from '../../lib/utils';
import { CLOSE_ROLES } from '../../lib/periodLock';

/**
 * The month-end currency revaluation (R-07), shown in the currency tool.
 *
 * Nothing here does arithmetic: the panel asks the server for the plan (`/revaluation/preview`, which
 * posts nothing), shows the same numbers it computed, and only posts when the person presses "Post
 * it". That is also why there is no date to choose — the plan is today's, because today's rate is the
 * rate the exchange service gives, and the entry reverses the next day so the documents keep their
 * own rates.
 */

interface Detail {
  id: string; side: 'customer' | 'vendor'; number: string; partyName: string; currency: string;
  openCents: number; bookedRate: number; todayRate: number; bookedBaseCents: number; todayBaseCents: number; deltaCents: number;
}
interface Line { accountId: string; accountName: string; amountCents: number; description: string }
interface Skip { id: string; number: string; reason: string }

interface Plan {
  date: string;
  reversalDate: string;
  baseCurrency: string;
  posted: boolean;
  transactionId?: string | null;
  summary: string;
  lines: Line[];
  details: Detail[];
  skipped: Skip[];
  unpriced: string[];
  netGainCents: number;
}

async function ask(path: string, body: Record<string, unknown>, method = 'POST'): Promise<Plan & Record<string, unknown>> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data.message || data.error || 'The revaluation could not be run'));
  return data as Plan & Record<string, unknown>;
}

export function FxRevaluationPanel() {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId) || '';
  const base = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';
  // the pair that may close a period is the pair that may post a period entry
  const canRun = CLOSE_ROLES.includes(useCurrentRole());
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (kind: 'preview' | 'run' | 'undo') => {
    setBusy(true);
    setError('');
    try {
      const data = await ask(`/api/v1/transactions/revaluation/${kind}`, { workspaceId, ...(kind === 'undo' ? { date: plan?.date || '' } : {}) });
      setPlan(data);
      if (kind === 'preview' && data.lines.length === 0) toast.info(data.summary);
      if (kind === 'run') toast.success(data.posted ? `Posted. It reverses on ${data.reversalDate}.` : data.summary);
      if (kind === 'undo') toast.success('The revaluation is reversed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The revaluation could not be run';
      setError(message);
      toast.error(message);
      if (kind === 'undo') setPlan(null);
    } finally {
      setBusy(false);
    }
  };

  const money = (cents: number, currency?: string) => formatCurrency(cents, currency || base);
  const nothingToPost = !plan || plan.lines.length === 0;

  return (
    <div className="space-y-3 pt-4 border-t border-[var(--line)] mt-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text)]">Revalue open foreign invoices and bills</h3>
        <p className="text-xs text-[var(--muted)]">
          What the open {base} balances look like at today&apos;s rates: each document&apos;s own open amount
          times today&apos;s rate, against what is in the books. The difference goes to an unrealized FX
          gain/loss account, and the entry reverses the next day, so your invoices and bills keep the
          rates they were booked at. Only an owner or an accountant posts it.
        </p>
      </div>

      {error && <p role="status" className="text-xs text-[var(--neg)]">{error}</p>}

      {plan && (
        <div className="space-y-2 text-xs">
          <p role="status" className="font-semibold text-[var(--text)]">{plan.summary}</p>
          {plan.details.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <caption className="sr-only">What the revaluation moves, document by document</caption>
                <thead>
                  <tr className="text-left text-[var(--muted)]">
                    <th scope="col" className="py-1 pr-3 font-semibold">Document</th>
                    <th scope="col" className="py-1 pr-3 font-semibold">Open</th>
                    <th scope="col" className="py-1 pr-3 font-semibold text-right">Booked at</th>
                    <th scope="col" className="py-1 pr-3 font-semibold text-right">Today at</th>
                    <th scope="col" className="py-1 pr-3 font-semibold text-right">In {base}</th>
                    <th scope="col" className="py-1 font-semibold text-right">Moves by</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.details.map(d => (
                    <tr key={`${d.side}:${d.id}`} className="border-t border-[var(--line)]">
                      <th scope="row" className="py-1 pr-3 text-left font-normal text-[var(--text)]">
                        {d.number}<span className="block text-[var(--muted)]">{d.partyName}</span>
                      </th>
                      <td className="py-1 pr-3 text-[var(--text)] whitespace-nowrap">{money(d.openCents, d.currency)}</td>
                      <td className="py-1 pr-3 text-right text-[var(--muted)] tabular-nums">{d.bookedRate.toFixed(4)}</td>
                      <td className="py-1 pr-3 text-right text-[var(--muted)] tabular-nums">{d.todayRate.toFixed(4)}</td>
                      <td className="py-1 pr-3 text-right text-[var(--muted)] tabular-nums whitespace-nowrap">{money(d.bookedBaseCents)} → {money(d.todayBaseCents)}</td>
                      <td className="py-1 text-right font-semibold tabular-nums text-[var(--text)]">{money(d.deltaCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {plan.lines.length > 0 && (
            <ul className="space-y-1">
              {plan.lines.map(l => (
                <li key={`${l.accountId}:${l.description}`} className="flex justify-between gap-3">
                  <span className="text-[var(--text)]">{l.accountName}<span className="block text-[var(--muted)]">{l.description}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--text)]">{money(l.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
          {plan.skipped.length > 0 && (
            <details className="text-[var(--muted)]">
              <summary>{plan.skipped.length} {plan.skipped.length === 1 ? 'document' : 'documents'} left out, and why</summary>
              <ul className="mt-1 space-y-1">
                {plan.skipped.map(s => <li key={`${s.id}:${s.reason}`}>{s.number || s.id}: {s.reason}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => run('preview')}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--text)] disabled:opacity-50">
          {busy ? 'Working…' : plan ? 'Check today’s rates again' : 'Show what would move'}
        </button>
        {plan && !plan.posted && (
          <button type="button" disabled={busy || nothingToPost || !canRun} onClick={() => run('run')}
            title={canRun ? 'Posts the entry and the one that reverses it tomorrow' : 'Owners and accountants post ledger entries'}
            className="rounded-lg bg-[var(--brass)] px-3 py-2 text-xs font-bold text-black disabled:opacity-50">
            Post it
          </button>
        )}
        {plan?.posted && (
          <button type="button" disabled={busy || !canRun} onClick={() => run('undo')}
            title="Reverses it now instead of waiting for tomorrow"
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--text)] disabled:opacity-50">
            Undo it
          </button>
        )}
        {plan?.posted && (
          <p className="text-xs text-[var(--muted)]">
            Posted for {plan.date}: entry <code className="font-mono">{String(plan.transactionId || '').slice(0, 8)}</code>, reversing on {plan.reversalDate}.
          </p>
        )}
        {!canRun && <p className="text-xs text-[var(--muted)]">An owner or an accountant can post this; you can see what it would do.</p>}
      </div>
    </div>
  );
}

export default FxRevaluationPanel;
