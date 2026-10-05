import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getIdToken } from '../../firebase';
import { resolveAccountRole } from '../../lib/accountUtils';
import { formatCurrency, parseAmountToCents } from '../../lib/utils';
import { billExpenseLine, prepaidAccount, spreadPlan, spreadProblem } from '../../lib/prepaidSchedule';
import type { Bill } from '../../types';

const inputClass = 'w-full p-2 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-[var(--text)]';

/**
 * Spread a bill's expense over months as a prepaid expense (K-17): amount, expense account, number of
 * months and first month, with the monthly share shown before anything is posted. The server posts
 * all entries at once (src/server/services/prepaidService.ts).
 */
export default function SpreadBillDialog({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const storedAccounts = useLedgerStore(s => s.accounts);
  const accounts = useMemo(() => storedAccounts || [], [storedAccounts]);
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const currency = workspace?.currency || 'USD';
  const expenseAccounts = useMemo(() => accounts.filter(a => resolveAccountRole(a) === 'expense' && !a.isArchived), [accounts]);
  const assetAccounts = useMemo(() => accounts.filter(a => resolveAccountRole(a) === 'asset' && !a.isArchived), [accounts]);
  const line = useMemo(() => billExpenseLine(bill, accounts), [bill, accounts]);
  const rate = typeof bill.exchangeRate === 'number' && bill.exchangeRate > 0 ? bill.exchangeRate : 1;
  const billBaseCents = Math.round((bill.amountCents || 0) * rate);
  const date = String(bill.date || bill.issueDate || '').slice(0, 10);
  const mappings = (workspace as { defaultAccountMappings?: Record<string, string | undefined> } | undefined)?.defaultAccountMappings;
  const foundPrepaid = useMemo(() => prepaidAccount(accounts, mappings), [accounts, mappings]);

  const [expenseAccountId, setExpenseAccountId] = useState(line?.accountId || '');
  const [prepaidAccountId, setPrepaidAccountId] = useState(foundPrepaid?.id || '');
  const [amount, setAmount] = useState(((line?.baseCents ?? billBaseCents) / 100).toFixed(2));
  const [months, setMonths] = useState('12');
  const [startMonth, setStartMonth] = useState(date.slice(0, 7));
  const [busy, setBusy] = useState(false);

  const input = { date, amountCents: parseAmountToCents(amount), months: Number(months), startMonth };
  const problem = spreadProblem(input, billBaseCents)
    || (!expenseAccountId ? 'Choose the expense account' : null)
    || (!prepaidAccountId ? 'Choose the Prepaid Expenses account' : null);
  const plan = problem ? [] : spreadPlan(input);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    try {
      const token = await getIdToken().catch(() => null);
      const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspace?.id || '')}/bills/${encodeURIComponent(bill.id)}/spread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ expenseAccountId, prepaidAccountId, amountCents: input.amountCents, months: input.months, startMonth }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'The spread could not be saved');
      toast.success(`Spread over ${input.months} months`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="spread-bill-title">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--text)]">
        <div>
          <h2 id="spread-bill-title" className="text-lg font-bold">Spread over months</h2>
          <p className="text-xs text-[var(--muted)]">
            Bill {bill.number || ''} {bill.vendorName ? `from ${bill.vendorName}` : ''}: the cost goes to Prepaid on {date || 'the bill date'} and back to the expense one share at each month end.
          </p>
        </div>
        <label className="block text-sm">
          <span className="text-xs font-bold">Expense account</span>
          <select value={expenseAccountId} onChange={e => setExpenseAccountId(e.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} – ` : ''}{a.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs font-bold">Prepaid account</span>
          <select value={prepaidAccountId} onChange={e => setPrepaidAccountId(e.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} – ` : ''}{a.name}</option>)}
          </select>
          {!foundPrepaid && <span className="text-[11px] text-[var(--muted)]">No “Prepaid Expenses” account yet: add one in the Chart of Accounts, or choose an asset account.</span>}
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-bold">Amount ({currency})</span>
            <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={`${inputClass} font-mono text-right`} />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-bold">Months</span>
            <input type="number" min={2} max={60} value={months} onChange={e => setMonths(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-bold">First month</span>
            <input type="month" value={startMonth} min={date.slice(0, 7) || undefined} onChange={e => setStartMonth(e.target.value)} className={inputClass} />
          </label>
        </div>
        {problem ? (
          <p role="alert" className="text-xs text-rose-600">{problem}</p>
        ) : (
          <p className="text-sm" aria-live="polite">
            {formatCurrency(plan[0].amountCents, currency)} a month, {plan[0].date} to {plan[plan.length - 1].date}
            {plan[plan.length - 1].amountCents !== plan[0].amountCents ? ` (the last ${formatCurrency(plan[plan.length - 1].amountCents, currency)})` : ''}.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-[var(--muted)] hover:underline">Cancel</button>
          <button type="submit" disabled={Boolean(problem) || busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {busy ? 'Spreading…' : 'Spread'}
          </button>
        </div>
      </form>
    </div>
  );
}
