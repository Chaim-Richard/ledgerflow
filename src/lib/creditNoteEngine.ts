import { CreditNote, VendorCredit, Invoice, Bill, Transaction } from '../types';
import { getLocalDateIso } from './utils';

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
 * Applies a customer credit note against an open customer invoice using canonical fields:
 * - CreditNote: amountCents, remainingCents
 * - Invoice: amountCents, amountPaidCents
 */
export function applyCreditNoteToInvoice(
  creditNote: CreditNote,
  invoice: Invoice,
  amountCentsToApply: number
): ApplyCreditResult {
  const cnRemaining = creditNote.remainingCents ?? creditNote.amountCents;
  const invBalance = (invoice.amountCents || 0) - (invoice.amountPaidCents || 0);

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
  const newInvPaid = (invoice.amountPaidCents || 0) + amountCentsToApply;
  const newInvStatus = newInvPaid >= invoice.amountCents ? 'paid' : 'partially_paid';

  const updatedCreditNote: CreditNote = {
    ...creditNote,
    remainingCents: newCnRemaining,
    status: newCnRemaining === 0 ? 'applied' : 'partially_applied'
  };

  const updatedInvoice: Invoice = {
    ...invoice,
    amountPaidCents: newInvPaid,
    status: newInvStatus
  };

  const ledgerTransaction: Partial<Transaction> = {
    workspaceId: invoice.workspaceId,
    date: getLocalDateIso(),
    description: `Applied Credit Note ${creditNote.id} to Invoice ${invoice.number || invoice.id}`,
    totalAmountCents: amountCentsToApply,
    status: 'completed',
    type: 'journal',
    lines: [
      { accountId: 'acc_sales_returns', accountName: 'Sales Returns & Allowances', amountCents: amountCentsToApply },
      { accountId: 'acc_ar', accountName: 'Accounts Receivable', amountCents: -amountCentsToApply }
    ]
  };

  return { updatedCreditNote, updatedInvoice, ledgerTransaction };
}

/**
 * Applies a vendor credit against an open vendor bill using canonical fields:
 * - VendorCredit: amountCents, remainingCents
 * - Bill: amountCents, amountPaidCents
 */
export function applyVendorCreditToBill(
  vendorCredit: VendorCredit,
  bill: Bill,
  amountCentsToApply: number
): ApplyVendorCreditResult {
  const vcRemaining = vendorCredit.remainingCents ?? vendorCredit.amountCents;
  const billBalance = (bill.amountCents || 0) - (bill.amountPaidCents || 0);

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
  const newBillPaid = (bill.amountPaidCents || 0) + amountCentsToApply;
  const newBillStatus = newBillPaid >= bill.amountCents ? 'paid' : 'partially_paid';

  const updatedVendorCredit: VendorCredit = {
    ...vendorCredit,
    remainingCents: newVcRemaining,
    status: newVcRemaining === 0 ? 'applied' : 'partially_applied'
  };

  const updatedBill: Bill = {
    ...bill,
    amountPaidCents: newBillPaid,
    status: newBillStatus
  };

  const ledgerTransaction: Partial<Transaction> = {
    workspaceId: bill.workspaceId,
    date: getLocalDateIso(),
    description: `Applied Vendor Credit ${vendorCredit.id} to Bill ${bill.number || bill.id}`,
    totalAmountCents: amountCentsToApply,
    status: 'completed',
    type: 'journal',
    lines: [
      { accountId: 'acc_ap', accountName: 'Accounts Payable', amountCents: amountCentsToApply },
      { accountId: 'acc_purchase_returns', accountName: 'Purchase Returns & Allowances', amountCents: -amountCentsToApply }
    ]
  };

  return { updatedVendorCredit, updatedBill, ledgerTransaction };
}
