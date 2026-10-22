import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { currentCreditLimitRefusal, reportCreditLimitRefusal, subscribeCreditLimitRefusal } from '../../lib/creditLimitPrompt';

/**
 * EG-5: the server refused to issue the invoice over the customer's credit limit. Its words are shown; an owner or
 * accountant (the server says who may) can issue it anyway with a reason, which resends the save with the override.
 */
export default function CreditLimitRefusalPanel({ onIssueAnyway, busy }: { onIssueAnyway: (reason: string) => void; busy?: boolean }) {
  const refusal = useSyncExternalStore(subscribeCreditLimitRefusal, currentCreditLimitRefusal);
  const [reason, setReason] = useState('');
  useEffect(() => { reportCreditLimitRefusal(null); return () => reportCreditLimitRefusal(null); }, []); // a refusal belongs to this form
  if (!refusal) return null;
  return (
    <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm space-y-2">
      <p className="font-semibold text-rose-700 dark:text-rose-300">{refusal.message}</p>
      {refusal.canOverride ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[12rem] text-xs text-[var(--muted)]">
            Reason for issuing over the limit
            <input aria-label="Reason for issuing over the limit" value={reason} onChange={e => setReason(e.target.value)} required
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)]" />
          </label>
          <button type="button" disabled={busy || !reason.trim()} onClick={() => onIssueAnyway(reason.trim())}
            className="rounded bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Issue anyway</button>
        </div>
      ) : <p className="text-xs text-[var(--muted)]">Only an owner or accountant can issue it over the limit.</p>}
    </div>
  );
}
