import type { TaxTreatment } from '../lib/taxCodes';
import type { ContactNote, ContactPerson } from '../lib/contacts';
import type { DeliveryMethod } from '../lib/delivery';
import type { InvoiceApprovalRecord } from '../lib/invoiceApproval';
import type { EntityMetadata } from './ledger';
import type { DashboardSchema } from './workspace';

// Sales and purchases: customers, vendors, invoices, bills, payments, credits, estimates, purchase orders, receipts.
// Part of src/types.ts (F-10): import from '../types' as before; it re-exports this file.

export interface TaxBreakdownLine { name: string; rate: number; taxCents: number }

export interface Vendor {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  category: string;
  email?: string;
  phone?: string;
  /** False after "Not expected" on an expected bill (K-21, src/lib/expectedBills.ts): the vendor's rhythm is no longer watched. */
  billsExpected?: boolean;
  type?: string; // 'subcontractor', 'service_provider', 'supplier', etc.
  status?: 'active' | 'inactive' | 'blocked' | 'approved' | string;
  pipelineStage?: string;
  is1099?: boolean;
  isForeign?: boolean;
  rating?: number;
  tags?: string[];
  metadata?: EntityMetadata;
  balanceCents?: number;
  address?: string;
  /** Currency new bills from this vendor start in (Y-22). */
  currency?: string;
  /** How this vendor wants documents (bills, remittances); unset means Email (Y-27). */
  deliveryMethod?: DeliveryMethod;
  /** People to deal with at the vendor (Y-21). */
  contacts?: ContactPerson[];
  /** Notes timeline, newest first (Y-25). */
  noteLog?: ContactNote[];
  /** Set when the vendor came from a spreadsheet import (src/lib/recordImport.ts); lets the import be undone. */
  importBatchId?: string;
}

export interface Bill {
  id: string;
  uid: string;
  workspaceId: string;
  vendorId: string;
  vendorName?: string;
  number?: string;
  amountCents: number;
  currency?: string;
  exchangeRate?: number;
  taxAmountCents?: number;
  taxRate?: number;
  // Legacy tax/subtotal fields read by src/lib/documentMath.ts
  taxCents?: number;
  salesTaxCents?: number;
  receiptUrl?: string;
  tags?: string[];
  metadata?: EntityMetadata;
  splits?: Array<{
    amountCents: number;
  exchangeRate?: number;
    accountId: string;
    taxRate?: number;
    description?: string;
  }>;
  projectId?: string;
  issueDate?: string;
  date?: string;
  dueDate: string;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'partially_paid' | 'overdue' | 'unpaid' | 'void' | 'rejected' | 'cancelled';
  amountPaidCents?: number;
  /** Part of amountPaidCents settled by payment records or applied credits (they post their own entries). */
  settledByRecordsCents?: number;
  paymentDate?: string;
  paidAt?: string;
  reversalEventId?: string;
  isLocked?: boolean;
  lockedAt?: string;
  paymentToken?: string;
  taxInclusive?: boolean;
  /** Tax-code fields (src/lib/taxCodes.ts): see DocumentTaxFields. */
  taxVersion?: number;
  lineSumCents?: number;
  taxCodeId?: string;
  taxTreatment?: TaxTreatment;
  taxBreakdown?: TaxBreakdownLine[];
  pricesIncludeTax?: boolean;
  /** Reverse charge: the tax the business accounts for itself (due and reclaimable). */
  selfAssessedTaxCents?: number;
  posted?: boolean;
  /** set when saved (database row times) */
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  id: string;
  uid: string;
  workspaceId: string;
  customerId: string;
  customerName?: string;
  number?: string;
  amountCents: number;
  amountPaidCents?: number;
  /** Part of amountPaidCents settled by payment records or applied credits (they post their own entries). */
  settledByRecordsCents?: number;
  /** Written off as bad debt (src/server/services/badDebtService.ts); counted in amountPaidCents. */
  writtenOffCents?: number;
  writeOffTransactionId?: string | null;
  writeOffReason?: string | null;
  writtenOffAt?: string;
  writeOffReversalTransactionId?: string;
  exchangeRate?: number;
  taxAmountCents?: number;
  taxRate?: number;
  // Legacy tax/subtotal fields read by src/lib/documentMath.ts
  taxCents?: number;
  salesTaxCents?: number;
  date?: string;
  dueDate: string;
  tags?: string[];
  metadata?: EntityMetadata;
  status: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'sent' | 'draft' | 'approved' | 'rejected' | 'invoiced' | 'void' | 'cancelled';
  type?: 'standard' | 'recurring' | 'progress' | 'estimate' | 'quote' | 'change-order' | 'time-materials'; // For advanced billing workflows
  recurringInterval?: 'monthly' | 'weekly' | 'yearly';
  paymentTerms?: string; // 'net_15', 'net_30', 'net_60', 'due_on_receipt', etc.
  items?: Array<{
    id: string;
    itemId?: string; // Links to InventoryItem.id
    description: string;
    quantity: number;
    rateCents: number;
    amountCents: number;
    accountId: string;
    taxRate?: number;
    unitCostCents?: number;
    metadata?: EntityMetadata;
  }>;
  progressPercentage?: number;
  /**
   * Invoice approval (BE-04, src/lib/invoiceApproval.ts): who signed an over-limit invoice off, or
   * why it came back. It is not `status`: that word holds the payment state of the invoice.
   */
  approval?: InvoiceApprovalRecord;
  discountCents?: number;
  retainageCents?: number;
  depositCents?: number;
  taxInclusive?: boolean;
  /**
   * Tax-code fields, saved by the invoice form (src/lib/taxCodes.ts documentTotals). With
   * taxVersion 2, amountCents is the total owed (after discount, tax included) and
   * taxAmountCents the tax; lineSumCents is the lines as entered.
   */
  taxVersion?: number;
  lineSumCents?: number;
  taxCodeId?: string;
  taxTreatment?: TaxTreatment;
  taxBreakdown?: TaxBreakdownLine[];
  /** How the lines were entered: with tax included, or tax added on top. */
  pricesIncludeTax?: boolean;
  posted?: boolean;
  currency?: string;
  paymentDate?: string;
  paidAt?: string;
  milestone?: string;
  isLocked?: boolean;
  lockedAt?: string;
  paymentToken?: string;
  /** set when saved (database row times) */
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentAllocation {
  documentId: string; // invoice id or bill id
  documentType: 'invoice' | 'bill';
  amountCents: number;
}

export interface Payment {
  id: string;
  uid: string;
  workspaceId: string;
  number?: string;
  direction: 'received' | 'made';      // received = from customer, made = to vendor
  contactId: string;                    // customerId or vendorId
  contactName?: string;
  date: string;
  amountCents: number;                  // always absolute, per AGENTS.md
  currency?: string;
  exchangeRate?: number;
  method: 'cash' | 'check' | 'bank_transfer' | 'card' | 'other';
  reference?: string;                   // cheque number, wire ref
  depositAccountId: string;             // which bank/cash account it hit
  allocations: PaymentAllocation[];
  unappliedCents: number;               // amountCents minus sum(allocations)
  status: 'draft' | 'posted' | 'void';
  createdAt: string;
  updatedAt?: string;
}

export interface Estimate {
  id: string;
  uid: string;
  workspaceId: string;
  customerId: string;
  customerName?: string;
  number?: string;
  amountCents: number;
  date: string;
  expiryDate?: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';
  convertedInvoiceId?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    amountCents: number;
  }>;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreditNote {
  id: string;
  uid: string;
  workspaceId: string;
  customerId: string;
  customerName?: string;
  number?: string;
  invoiceId?: string;
  amountCents: number;
  remainingCents: number;
  /** Paid back in cash so far (written by the server when a refund is made; L-160). */
  refundedCents?: number;
  date: string;
  reason?: string;
  status: 'draft' | 'open' | 'applied' | 'partially_applied' | 'void';
  currency?: string;
  exchangeRate?: number;
  tags?: string[];
  metadata?: EntityMetadata;
  createdAt: string;
  updatedAt?: string;
  /** The tax part of amountCents, from the credited invoice (taxCodes.ts creditTaxFrom). */
  taxAmountCents?: number;
  taxInclusive?: boolean;
  taxVersion?: number;
  taxTreatment?: TaxTreatment;
}

export interface VendorCredit {
  id: string;
  uid: string;
  workspaceId: string;
  vendorId: string;
  vendorName?: string;
  number?: string;
  billId?: string;
  amountCents: number;
  remainingCents: number;
  /** Paid back in cash so far (written by the server when a refund is made; L-160). */
  refundedCents?: number;
  date: string;
  reason?: string;
  status: 'draft' | 'open' | 'applied' | 'partially_applied' | 'void';
  currency?: string;
  exchangeRate?: number;
  tags?: string[];
  metadata?: EntityMetadata;
  createdAt: string;
  updatedAt?: string;
  /** The tax part of amountCents, from the credited bill (taxCodes.ts creditTaxFrom). */
  taxAmountCents?: number;
  taxInclusive?: boolean;
  taxVersion?: number;
  taxTreatment?: TaxTreatment;
}

export interface Customer {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'blocked' | 'approved' | string;
  balanceCents?: number;
  pipelineStage?: 'lead' | 'qualified' | 'proposal' | 'won' | 'lost' | 'delinquent' | 'inactive';
  customerSegment?: 'high-value' | 'repeat' | 'service-tier' | 'standard';
  expectedRevenueCents?: number;
  probability?: number;
  score?: number;
  tags?: string[];
  metadata?: EntityMetadata;
  notes?: string;
  isForeign?: boolean;
  address?: string;
  /** Currency new invoices for this customer start in (Y-22). */
  currency?: string;
  /** How this customer wants documents (invoices, statements); unset means Email (Y-27). */
  deliveryMethod?: DeliveryMethod;
  /** People to deal with at the customer (Y-21). */
  contacts?: ContactPerson[];
  /** Notes timeline, newest first (Y-25). */
  noteLog?: ContactNote[];
  /** No automatic payment reminders for this customer (Settings → Emails & Reminders). */
  noReminders?: boolean;
  /** Y-28: left out of the monthly statement emails. */
  noStatements?: boolean;
  /** Set when the customer came from a spreadsheet import; lets the import be undone. */
  importBatchId?: string;
}

export interface CustomTemplate {
  id: string;
  uid: string;
  name: string;
  description: string;
  industry?: string;
  schema: DashboardSchema;
  accounts: Array<{
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_goods' | 'revenue';
    category?: string;
  }>;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  receivedQuantity?: number;
  accountId?: string;
}

export interface PurchaseOrder {
  id: string;
  uid: string;
  workspaceId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  issueDate: string;
  expectedDeliveryDate?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'partially_received' | 'received' | 'billed' | 'closed' | 'cancelled';
  items: PurchaseOrderItem[];
  totalAmountCents: number;
  notes?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  currency?: string;
  /** Goods received against this order (saved with it). */
  receipts?: GoodsReceipt[];
  /** The bill created from this order (BE-11). */
  billId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GoodsReceiptItem {
  poItemId: string;
  description: string;
  quantityReceived: number;
  unitPriceCents: number;
  condition: 'good' | 'damaged' | 'rejected';
  notes?: string;
}

export interface GoodsReceipt {
  id: string;
  uid: string;
  workspaceId: string;
  receiptNumber: string;
  poId: string;
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  receivedDate: string;
  receivedBy?: string;
  items: GoodsReceiptItem[];
  notes?: string;
  status: 'received' | 'discrepancy' | 'verified';
  createdAt: string;
}

export interface ThreeWayMatchResult {
  poId: string;
  poNumber: string;
  billId?: string;
  receiptId?: string;
  status: 'matched' | 'price_variance' | 'quantity_variance' | 'unreceived' | 'missing_bill';
  poAmountCents: number;
  receiptAmountCents: number;
  billAmountCents: number;
  discrepancies: string[];
}
