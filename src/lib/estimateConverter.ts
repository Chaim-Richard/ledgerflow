import { Estimate, Invoice } from '../types';

/**
 * Converts an estimate to a formal customer invoice.
 */
export function convertEstimateToInvoice(estimate: Estimate): Invoice {
  if (estimate.status === 'declined') {
    throw new Error('Cannot convert a declined estimate to an invoice');
  }

  const issueDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default Net 30

  const invoiceLines = (estimate.lines || []).map(line => ({
    id: `line_${Math.random().toString(36).substr(2, 9)}`,
    description: line.description || '',
    quantity: line.quantity || 1,
    unitPriceCents: line.unitPriceCents || 0,
    amountCents: line.amountCents || (line.quantity || 1) * (line.unitPriceCents || 0),
    accountId: line.accountId || 'acc_sales',
    category: line.category
  }));

  const invoice: Invoice = {
    id: `inv_from_est_${estimate.id}`,
    workspaceId: estimate.workspaceId,
    invoiceNumber: `INV-EST-${estimate.estimateNumber || estimate.id.substr(0, 6)}`,
    customerId: estimate.customerId || '',
    customerName: estimate.customerName,
    date: issueDate,
    dueDate: dueDate,
    totalAmountCents: estimate.totalAmountCents,
    paidAmountCents: 0,
    status: 'draft',
    lines: invoiceLines,
    notes: `Converted from Estimate ${estimate.estimateNumber || estimate.id}`
  };

  return invoice;
}
