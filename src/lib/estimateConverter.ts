import { Estimate, Invoice } from '../types';

/**
 * Converts an estimate to a formal customer invoice using canonical Invoice & Estimate fields:
 * - Estimate: amountCents, number, lines
 * - Invoice: uid, workspaceId, customerId, amountCents, amountPaidCents, items, number
 */
export function convertEstimateToInvoice(estimate: Estimate): Invoice {
  if (estimate.status === 'declined') {
    throw new Error('Cannot convert a declined estimate to an invoice');
  }

  const issueDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default Net 30

  const invoiceItems = (estimate.lines || []).map(line => ({
    id: `item_${Math.random().toString(36).substr(2, 9)}`,
    description: line.description || '',
    quantity: line.quantity || 1,
    rateCents: line.unitPriceCents || 0,
    amountCents: line.amountCents || (line.quantity || 1) * (line.unitPriceCents || 0),
    accountId: 'acc_sales'
  }));

  const invoice: Invoice = {
    id: `inv_from_est_${estimate.id}`,
    uid: estimate.uid || 'usr_system',
    workspaceId: estimate.workspaceId,
    number: `INV-EST-${estimate.number || estimate.id.substring(0, 6)}`,
    customerId: estimate.customerId || '',
    customerName: estimate.customerName,
    date: issueDate,
    dueDate: dueDate,
    amountCents: estimate.amountCents,
    amountPaidCents: 0,
    status: 'draft',
    items: invoiceItems
  };

  return invoice;
}
