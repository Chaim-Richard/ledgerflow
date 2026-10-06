import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useDataNeedsStore } from '../../stores/useDataNeedsStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { CORE_KEYS, LEDGER_COLLECTIONS } from '../../lib/ledgerCollections';
import type { LedgerKey } from '../../lib/ledgerCollections';

/** What each collection is called on screen. */
export const COLLECTION_LABELS: Record<LedgerKey, string> = {
  transactions: 'entries', accounts: 'accounts', taxRates: 'tax codes', autoRules: 'rules', customers: 'customers',
  vendors: 'vendors', invoices: 'invoices', creditNotes: 'credit notes', payments: 'payments', estimates: 'estimates',
  bills: 'bills', vendorCredits: 'vendor credits', inventory: 'items', budgets: 'budgets', projects: 'projects',
  journalEntries: 'journal entries', payRuns: 'pay runs', employees: 'employees', bankLines: 'bank lines',
  reconciliations: 'reconciliations', auditLogs: 'activity', recurring: 'recurring schedules', assets: 'fixed assets', loans: 'loans',
  scenarios: 'scenarios',
};

const list = (labels: string[]) => labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

/**
 * One line above every screen about the workspace's data (I-01, I-02, AA-02): what is still
 * loading, what failed to load (with "Try again"), and which lists are cut at their limit, so a
 * screen's totals or "nothing here" are never taken at face value by mistake.
 */
export default function DataStatusBar() {
  const asked = useDataNeedsStore(s => s.asked);
  const loaded = useDataNeedsStore(s => s.loaded);
  const failed = useDataNeedsStore(s => s.failed);
  const retry = useDataNeedsStore(s => s.retry);
  const truncated = useLedgerStore(s => s.truncatedCollections);
  const signedIn = useAuthStore(s => Boolean(s.user && s.currentWorkspaceId));
  if (!signedIn) return null;

  const wanted = [...new Set<LedgerKey>([...CORE_KEYS, ...asked])];
  const failedKeys = wanted.filter(k => failed[k]);
  const loadingKeys = wanted.filter(k => !loaded[k] && !failed[k]);
  const cut = (Object.keys(LEDGER_COLLECTIONS) as LedgerKey[])
    .filter(k => truncated?.[LEDGER_COLLECTIONS[k].collection]);

  if (!failedKeys.length && !loadingKeys.length && !cut.length) return null;
  return (
    <div className="border-b border-[var(--line)] text-xs px-4 py-1.5 space-y-1">
      {failedKeys.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-[var(--neg)]">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>Couldn't load {list(failedKeys.map(k => COLLECTION_LABELS[k]))}. Screens that use them may look empty. Check your connection, then</span>
          {failedKeys.map(k => (
            <button key={k} type="button" onClick={() => retry(k)} className="underline font-semibold">
              try again{failedKeys.length > 1 ? ` (${COLLECTION_LABELS[k]})` : ''}
            </button>
          ))}
        </div>
      )}
      {loadingKeys.length > 0 && (
        <div role="status" className="flex items-center gap-2 text-[var(--muted)]">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          <span>Loading {list(loadingKeys.map(k => COLLECTION_LABELS[k]))}…</span>
        </div>
      )}
      {cut.length > 0 && (
        <div role="status" className="text-[var(--brass)]">
          Only the most recent {list(cut.map(k => `${LEDGER_COLLECTIONS[k].cap.toLocaleString()} ${COLLECTION_LABELS[k]}`))} are loaded: totals on screen may be incomplete.
        </div>
      )}
    </div>
  );
}
