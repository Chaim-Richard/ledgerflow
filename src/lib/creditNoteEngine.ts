import { CreditNote, VendorCredit, Invoice, Bill, Transaction } from '../types';

export interface ApplyCreditResult {
  updatedCreditNote: CreditNote;
  updatedInvoice: Invoice;
  ledgerTransaction: Partial<Transaction>;
}

export interface ApplyVendorCreditResult {
  updatedVendorCredit: VendorCredit;
  updatedBill: Bill;
  ledgerTransaction: Partial<Transaction>;
}

/**
 * Applies a customer credit note against an open customer invoice.
 * Generates double-entry ledger lines: DR Accounts Receivable (or Deferred/Sales Returns), CR Accounts Receivable
 */
export function applyCreditNoteToInvoice(
  creditNote: CreditNote,
  invoice: Invoice,
  amountCentsToApply: number
): ApplyCreditResult {
  const cnRemaining = creditNote.remainingAmountCents ?? creditNote.totalAmountCents;
  const invBalance = invoice.totalAmountCents - (invoice.paidAmountCents || 0);

  if (amountCentsToApply <= 0) {
    throw new Error('Amount to apply must be strictly positive');
  }
  if (amountCentsToApply > cnRemaining) {
    throw new Error(`Amount ${amountCentsToApply} exceeds credit note remaining balance ${cnRemaining}`);
  }
  if (amountCentsToApply > invBalance) {
    throw new Error(`Amount ${amountCentsToApply} exceeds invoice outstanding balance ${invBalance}`);
  }

  const newCnRemaining = cnRemaining - amountCentsToApply;
  const newInvPaid = (invoice.paidAmountCents || 0) + amountCentsToApply;
  const newInvStatus = newInvPaid >= invoice.totalAmountCents ? 'paid' : 'sent';

  const updatedCreditNote: CreditNote = {
    ...creditNote,
    remainingAmountCents: newCnRemaining,
    status: newCnRemaining === 0 ? 'applied' : 'issued'
  };

  const updatedInvoice: Invoice = {
    ...invoice,
    paidAmountCents: newInvPaid,
    status: newInvStatus
  };

  const ledgerTransaction: Partial<Transaction> = {
    workspaceId: invoice.workspaceId,
    date: new Date().toISOString().split('T')[0],
    description: `Applied Credit Note ${creditNote.id} to Invoice ${invoice.invoiceNumber || invoice.id}`,
    totalAmountCents: amountCentsToApply,
    status: 'completed',
    type: 'journal',
    lines: [
      { accountId: 'acc_sales_returns', amountCents: amountCentsToApply },
      { accountId: 'acc_ar', amountCents: -amountCentsToApply }
    ]
  };

  return { updatedCreditNote, updatedInvoice, ledgerTransaction };
}

/**
 * Applies a vendor credit against an open vendor bill.
 */
export function applyVendorCreditToBill(
  vendorCredit: VendorCredit,
  bill: Bill,
  amountCentsToApply: number
): ApplyVendorCreditResult {
  const vcRemaining = vendorCredit.remainingAmountCents ?? vendorCredit.totalAmountCents;
  const billBalance = bill.totalAmountCents - (bill.paidAmountCents || 0);

  if (amountCentsToApply <= 0) {
    throw new Error('Amount to apply must be strictly positive');
  }
  if (amountCentsToApply > vcRemaining) {
    throw new Error(`Amount ${amountCentsToApply} exceeds vendor credit remaining balance ${vcRemaining}`);
  }
  if (amountCentsToApply > billBalance) {
    throw new Error(`Amount ${amountCentsToApply} exceeds bill outstanding balance ${billBalance}`);
  }

  const newVcRemaining = vcRemaining - amountCentsToApply;
  const newBillPaid = (bill.paidAmountCents || 0) + amountCentsToApply;
  const newBillStatus = newBillPaid >= bill.totalAmountCents ? 'paid' : 'received';

  const updatedVendorCredit: VendorCredit = {
    ...vendorCredit,
    remainingAmountCents: newVcRemaining,
    status: newVcRemaining === 0 ? 'applied' : 'applied'
  };

  const updatedBill: Bill = {
    ...bill,
    paidAmountCents: newBillPaid,
    status: newBillStatus
  };

  const ledgerTransaction: Partial<Transaction> = {
    workspaceId: bill.workspaceId,
    date: new Date().toISOString().split('T')[0],
    description: `Applied Vendor Credit ${vendorCredit.id} to Bill ${bill.billNumber || bill.id}`,
    totalAmountCents: amountCentsToApply,
    status: 'completed',
    type: 'journal',
    lines: [
      { accountId: 'acc_ap', amountCents: amountCentsToApply },
      { accountId: 'acc_purchase_returns', amountCents: -amountCentsToApply }
    ]
  };

  return { updatedVendorCredit, updatedBill, ledgerTransaction };
}
