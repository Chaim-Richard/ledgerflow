import { toast } from 'sonner';
import { getIdToken } from '../firebase';
import { calculateAmountDue } from '../lib/documentMath';

/**
 * The payment half of a sale receipt (K-03): the invoice was just saved as issued; its whole amount
 * due is recorded as a payment into the chosen account (a bank, or Undeposited Funds for "Make
 * deposit"), through the same server payments as everywhere else. If that fails the invoice stays
 * open and the person is told to record the payment.
 */
export async function recordReceiptPayment(
  workspaceId: string,
  invoice: { id: string; number?: string; date?: string; customerId?: string; customerName?: string; amountCents?: number; amountPaidCents?: number; depositCents?: number },
  payment: { cashAccountId: string; method: string },
): Promise<boolean> {
  const due = calculateAmountDue(invoice);
  if (due <= 0) return true;
  const token = await getIdToken().catch(() => null);
  const res = await fetch('/api/v1/payments', {
    method: 'POST',
    // #114: one receipt per sale invoice, so its id is the operation key — a retry is recorded once
    headers: { 'Content-Type': 'application/json', 'x-operation-id': `sale-receipt:${invoice.id}`.slice(0, 128), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      workspaceId, amountCents: due, paymentDate: invoice.date, cashAccountId: payment.cashAccountId, paymentMethod: payment.method,
      customerId: invoice.customerId, entityName: invoice.customerName || '', memo: `Sale receipt ${invoice.number || ''}`.trim(),
      allocations: [{ documentId: invoice.id, documentType: 'invoice', amountCents: due }],
    }),
  }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  if (!res?.ok) {
    toast.error(`Saved as an open invoice, but the payment was not recorded (${data?.message || 'no connection'}): record it with Receive payment.`);
    return false;
  }
  toast.success(`Sale receipt ${invoice.number || ''} saved and paid`.replace('  ', ' '));
  return true;
}
