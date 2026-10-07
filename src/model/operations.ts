import type { EntityMetadata } from './ledger';
import type { PayRunEmployeeLine } from '../lib/payRunPosting';
import type { EmployeeDeduction } from '../lib/payrollDeductions';

// Running the business: projects, inventory, fixed assets, payroll, documents, expense claims, support.
// Part of src/types.ts (F-10): import from '../types' as before; it re-exports this file.

export interface Project {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: 'book' | 'event' | 'campaign' | 'general';
  status: 'active' | 'completed' | 'archived';
  pipelineStage?: 'planning' | 'in_progress' | 'review' | 'completed' | 'archived';
  budgetCents: number;
  costCodes?: Array<{ id: string, name: string, budgetCents: number }>;
  laborBuckets?: Array<{ id: string, name: string, rateCents: number, estimatedHours: number }>;
  materialsBuckets?: Array<{ id: string, name: string, budgetCents: number }>;
  subcontractCosts?: Array<{ id: string, vendorId: string, description: string, amountCents: number }>;
  dimensions: string[];
  tags?: string[];
  metadata?: EntityMetadata;
  splitRules?: Array<{
    partnerId: string;
    partnerName?: string;
    percentage: number;
  }>;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  sku: string;
  description?: string;
  unitPriceCents: number;
  unitCostCents: number;
  quantityAtHand: number;
  reorderPoint: number;
  measurementUnit?: string; // e.g. 'pack', 'kg', 'box'
  unitsPerPackage?: number; // e.g. 100
  category?: string;
  createdAt: string;
  /** Set when the item came from a spreadsheet import; lets the import be undone. */
  importBatchId?: string;
}

export interface PartialDisposal {
  date: string;
  percent: number;
  costCents: number;
  salvageCents: number;
  accumulatedCents: number;
  proceedsCents: number;
  gainLossCents: number;
  transactionId: string;
  /** what the asset carried before, to undo it */
  before: { purchasePriceCents: number; salvageValueCents: number; accumulatedDepreciationCents: number; depreciatedThrough: string | null };
}

export interface AssetTransfer {
  date: string;
  description: string;
  /** the entry moving cost and depreciation between accounts; none for a move of place only */
  transactionId?: string;
  before: { location: string | null; assetAccountId: string | null; accumulatedAccountId: string | null };
}

export interface FixedAsset {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  purchaseDate: string;
  purchasePriceCents: number;
  salvageValueCents: number;
  usefulLifeYears: number;
  depreciationMethod: 'straight-line' | 'declining-balance';
  accumulatedDepreciationCents: number;
  /** X-09: in_progress = still being built (construction in progress): costs are added, nothing depreciates. */
  status: 'active' | 'disposed' | 'in_progress';
  createdAt: string;
  /** Balance sheet account the asset's cost is in (e.g. Equipment). */
  assetAccountId?: string;
  /** Where the monthly run posts: DR expenseAccountId, CR accumulatedAccountId. */
  expenseAccountId?: string;
  accumulatedAccountId?: string;
  /** Last month (YYYY-MM) the depreciation run covered, and its ledger entry. */
  depreciatedThrough?: string;
  lastDepreciationTransactionId?: string;
  /** Sold or scrapped (X-03, src/server/services/assetDisposalService.ts): the day, the money received, the gain (+) or loss (−) and its entry. */
  disposedOn?: string;
  disposalProceedsCents?: number;
  disposalGainLossCents?: number;
  disposalTransactionId?: string;
  /** X-09: costs added while it was being built, and placing it in service (the entry moving the cost
   * out of the construction-in-progress account; depreciation starts from that day). */
  costAdditions?: Array<{ date: string; amountCents: number; note?: string }>;
  placedInService?: { date: string; transactionId: string; cipAccountId: string; startedOn: string };
  /** X-05: where it is, and its moves (newest last) */
  location?: string;
  transfers?: AssetTransfer[];
  /** X-08: the day the warranty ends and the day the insurance renews (YYYY-MM-DD); reminded 30 days before. */
  warrantyExpires?: string;
  insuranceRenews?: string;
  /** X-04: shares sold or scrapped while the rest is kept (newest last); cost and salvage above are what is left. */
  partialDisposals?: PartialDisposal[];
  /** X-01: the bill line it was bought on (bill id and line number), when added from a bill. */
  sourceBillId?: string;
  sourceBillLine?: number;
}

export interface Employee {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  email?: string;
  role: string;
  salaryCents: number;
  payFrequency: 'Weekly' | 'Bi-Weekly' | 'Monthly';
  status: 'Active' | 'On Leave' | 'Terminated';
  department?: string;
  state?: string;
  filingStatus?: 'Single' | 'Married' | 'Head of Household';
  preTaxDeductionsCents?: number;
  allowances?: number;
  lastPayDate?: string;
  createdAt: string;
  /** U-08: a contractor is paid in full, nothing withheld and no employer taxes, and reported on a 1099-NEC. */
  workerType?: 'employee' | 'contractor';
  /** U-04: paid time off earned in a year (hours, spread over the pay runs), the hours brought in, and the time taken */
  ptoHoursPerYear?: number;
  ptoOpeningHours?: number;
  ptoTaken?: Array<{ date: string; hours: number; note?: string }>;
  /** U-05, U-06: named deductions each pay period (pre-tax, after-tax, garnishments): src/lib/payrollDeductions.ts */
  deductions?: EmployeeDeduction[];
}

export interface PayRun {
  id: string;
  uid: string;
  workspaceId: string;
  date: string;
  totalAmountCents: number;
  employeeCount: number;
  /** U-10: awaiting_approval → processed (approved), rejected (sent back) or withdrawn */
  status: 'draft' | 'processed' | 'failed' | 'undone' | 'awaiting_approval' | 'rejected' | 'withdrawn';
  createdAt: string;
  /** U-02: posted by the server; its entry and the amounts behind it. */
  transactionId?: string;
  /** U-07: whom it paid: one pay schedule, or everyone */
  schedule?: 'all' | Employee['payFrequency'];
  grossCents?: number;
  netCents?: number;
  withheldCents?: number;
  employerTaxCents?: number;
  deductionsCents?: number;
  employees?: PayRunEmployeeLine[];
  undoneAt?: string;
  /** U-10: who prepared it (uid is theirs), who approved or sent it back, and why */
  submittedByEmail?: string;
  approvedBy?: string;
  approvedByEmail?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByEmail?: string;
  rejectedAt?: string;
  rejectionNote?: string;
  withdrawnAt?: string;
}

export interface CloudDocument {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  linkedTransactionId?: string;
  tags?: string[]; metadata?: EntityMetadata;
  createdAt: string;
}

export interface ExpenseClaim {
  id: string;
  uid: string;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  description: string;
  amountCents: number;
  exchangeRate?: number;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  receiptUrl?: string;
  tags?: string[]; metadata?: EntityMetadata;
  createdAt: string;
}

export type Priority = 'low' | 'normal' | 'high';

export interface SupportTicket {
  id: string;
  workspaceId: string;
  uid: string;
  subject: string;
  status: 'open' | 'pending_user' | 'pending_support' | 'resolved' | 'closed';
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessageBy: string;
  unreadForUser: boolean;
  unreadForAdmin: boolean;
  errorLogId?: string;
  errorDiagnostics?: {
    message?: string;
    stack?: string;
    url?: string;
    release?: string;
  };
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  workspaceId: string;
  authorUid: string;
  authorRole: 'user' | 'admin';
  body: string;
  createdAt: string;
}

export interface ErrorLogRecord {
  id: string;
  workspaceId: string;
  userId?: string;
  userEmail?: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent?: string;
  appVersion?: string;
  release?: string;
  source: 'frontend' | 'backend' | 'api';
  severity: 'error' | 'warning' | 'fatal';
  metadata?: EntityMetadata;
  ticketId?: string;
  createdAt: string;
}
