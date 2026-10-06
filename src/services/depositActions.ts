import { toast } from 'sonner';
import { getIdToken } from '../firebase';
import { depositApplication } from '../lib/advancePayments';
import { formatCurrency } from '../lib/utils';

/**
 * Apply an estimate's deposits to its invoice once the invoice is issued (BE-05): each deposit still
 * waiting (oldest first) settles the invoice up to what is due, through the server's payment apply
 * (BE-12), which moves the money from Customer Deposits to receivables. Returns what was applied.
 */
export async function applyEstimateDeposits(
  workspaceId: string,
  invoice: { id: string; number?: string; currency?: string },
  waiting: Array<{ id: string; unappliedCents?: number }>,
  dueCents: number,
): Promise<number> {
  const token = await getIdToken().catch(() => null);
  let applied = 0;
  for (const part of depositApplication(waiting, dueCents)) {
    const res = await fetch(`/api/v1/payments/${encodeURIComponent(part.paymentId)}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ workspaceId, allocations: [{ documentId: invoice.id, documentType: 'invoice', amountCents: part.amountCents }] }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      toast.error(data?.message || 'The deposit could not be applied');
      break;
    }
    applied += part.amountCents;
  }
  if (applied > 0) toast.success(`Deposit of ${formatCurrency(applied, invoice.currency)} applied to invoice ${invoice.number || ''}`.trim());
  return applied;
}
