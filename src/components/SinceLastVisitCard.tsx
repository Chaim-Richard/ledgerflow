import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useLedgerCollections } from '../hooks/useLedgerCollections';
import { changesSince, describeChanges, takeLastVisit } from '../lib/sinceLastVisit';
import { formatDate } from '../lib/utils';

/** "Since your last visit (Oct 01): 3 new transactions · 1 invoice paid" on the Overview (I-20). */
export default function SinceLastVisitCard() {
  const uid = useAuthStore(s => s.user?.uid) || 'guest';
  const workspaceId = useAuthStore(s => s.currentWorkspaceId) || 'none';
  const transactions = useLedgerStore(s => s.transactions);
  const invoices = useLedgerStore(s => s.invoices);
  const bills = useLedgerStore(s => s.bills);
  const { loading } = useLedgerCollections('bills', 'invoices');
  // read once per page load: the card keeps showing the same changes until the next visit
  const [lastVisit] = useState(() => takeLastVisit(`lf_last_visit_${uid}_${workspaceId}`, new Date().toISOString()));

  const summary = useMemo(
    () => (lastVisit ? describeChanges(changesSince(lastVisit, { transactions, invoices, bills })) : ''),
    [lastVisit, transactions, invoices, bills],
  );
  if (!lastVisit || loading) return null;

  return (
    <div role="status" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] text-sm text-[var(--text)]">
      <Sparkles aria-hidden="true" size={15} className="text-[var(--brass)] shrink-0" />
      <span>
        <span className="font-semibold">Since your last visit</span>
        <span className="text-[var(--muted)]"> ({formatDate(lastVisit.slice(0, 10))})</span>: {summary || 'nothing new.'}
      </span>
    </div>
  );
}
