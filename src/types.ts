import type { LockException } from './lib/periodLock';
import type { EmailTemplates } from './lib/emailTemplates';
import type { ReminderSettings } from './lib/reminders';
export type NotificationKind =
  | 'invoice-created' | 'invoice-sent' | 'invoice-scheduled' | 'invoice-paid'
  | 'invoice-overdue' | 'invoice-cancelled' | 'invoice-refunded' | 'invoice-reminder-sent'
  | 'recurring-invoice-upcoming' | 'recurring-series-started'
  | 'recurring-series-paused' | 'recurring-series-completed'
  | 'transactions-created' | 'transactions-categorized' | 'transactions-assigned' | 'transactions-exported'
  | 'inbox-new' | 'inbox-needs-review' | 'inbox-auto-matched' | 'inbox-cross-currency-matched'
  | 'document-uploaded' | 'document-processed' | 'insight-ready';

export interface AppNotification {
  id: string;
  workspaceId: string;
  uid?: string;
  kind: NotificationKind;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  linkTab?: string;
  metadata?: Record<string, any>;
}

export interface Workspace {
  id: string;
  uid: string;
  name: string;
  businessType: string; // Template ID or "custom"
  type?: string;        // Alias for businessType used in some views
  description?: string;
  createdAt: string;
  lockedUntilDate?: string;
  lockDate?: string | null;
  /** Soft close (src/lib/periodLock.ts): only owners and accountants post on or before it. Server-only. */
  softLockDate?: string | null;
  /** Partial unlock of a closed date range. Server-only. */
  lockException?: LockException | null;
  /** Workspace email texts (src/lib/emailTemplates.ts); missing ones use the defaults. */
  emailTemplates?: EmailTemplates;
  /** Automatic payment reminders (src/lib/reminders.ts). */
  reminderSettings?: ReminderSettings;
  strategicAdvice?: string[];
  analyticalTopology?: DashboardSchema;
  currency?: string;
  defaultAccountMappings?: Record<string, string>;
  isDemoLoaded?: boolean;
  dateFormat?: string;
  aiModel?: string;
  matchingThreshold?: number;
  timezone?: string;
  /** Saved CSV column layouts for statement imports, keyed by header signature (src/lib/importColumnMaps.ts). */
  importColumnMaps?: Record<string, import('./lib/importColumnMaps').SavedColumnMap>;
  notifications?: {
    largeTransactionAlert: boolean;
    largeTransactionThreshold: number;
    anomalyAlert: boolean;
  };
  // Billing & Tenant Resource Constraints
  plan?: 'free' | 'growth' | 'pro' | 'enterprise';
  billingCycle?: 'monthly' | 'yearly' | 'free';
  paymentStatus?: 'active' | 'past_due' | 'unpaid' | string;
  trialEndsAt?: string;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  concurrentUserLimit?: number;
  activeUserCount?: number;
  maxSeats?: number;
  seatCount?: number;
  totalQueriesThisMonth?: number;
  computeHardnessScore?: number;
  billingLedgerChain?: string;
  apiQuotaTotalCentsUsed?: number;
  apiQuotaMonthlyLimitCents?: number;
  computeCreditBalance?: number;
  fiscalYearStartMonth?: number;
  fiscalYearStartDay?: number;
  fiscalYearEnd?: string;
  // Set only by the server or a platform admin (the database refuses them from the browser)
  isClosed?: boolean;
  computeLimit?: number;
  lastUpgradedAt?: string;
  deletedAt?: string;
  scheduledPurgeAt?: string;
  creditCostMultiplier?: number;
  quotaCentsMultiplier?: number;
  customKeyCreditCharge?: number;
  customKeyCentsCharge?: number;
  freeWorkspaceTxCap?: number;
  dimensions?: DimensionDefinition[]; // Dynamic workspace dimensional coordinate schema
  allowedWorldPaths?: string[];       // Coordinate-scoped permissions for sub-ledgers
  numberingSeries?: Record<string, { prefix: string; nextNumber: number; padding: number }>;
  roles?: Record<string, 'owner' | 'accountant' | 'bookkeeper' | 'viewer'>;
}

export interface DimensionDefinition {
  id: string;             // Unique dimension key (e.g. 'category', 'world', 'class', 'location', 'project', 'property')
  name: string;           // Display title (e.g. 'World / Entity', 'Class', 'Location', 'Project')
  label?: string;
  isWorld?: boolean;      // True if this axis forms an independent sub-ledger with single-world statements & elimination
  sortOrder?: number;
  systemDefault?: boolean;
}

export interface DimensionNode {
  id: string;            // The short code, e.g. "P1"
  dimensionId: string;   // Maps to DimensionDefinition.id, e.g. "property"
  description: string;   // Full meaning, e.g. "123 Ocean Ave Maint"
  aliases?: string[];    // Aliases for the statement matching engine e.g. ["123 OCEAN AVE MAINT", "123 Ocean"]
  status?: 'active' | 'archived'; // Keeps nodes append-only so ID's aren't reused if "deleted"
  createdAt?: string;
}

export interface SplitAllocation {
  dimensions: Record<string, string>; // e.g. { property: 'homes/maui', class: 'operations' }
  weight: number;                     // Weight decimal between 0.0 and 1.0 (Must sum to 1.0)
  amountCents?: number;
  description?: string;
}

export interface TransactionLine {
  id?: string;
  accountId: string;
  accountName?: string;
  amountCents: number; // Positive for Debit, Negative for Credit
  debitCents?: number;
  creditCents?: number;
  exchangeRate?: number;
  description?: string;
  category?: string;    // Category for price intel / account category
  total_impact?: number; // Risk/Impact factor
  taxRate?: number;
  taxAmountCents?: number;
  project?: string;
  department?: string;
  location?: string;
  class?: string;        // Explicit Class dimension
  dimensions?: Record<string, string>; // Hierarchical coordinate map: { world: 'bookco', property: 'homes/maui', class: 'ops' }
  splitAllocations?: SplitAllocation[]; // Split allocations with 1.0 weight integrity
  tags?: string[];
  metadata?: Record<string, any>;
  quantity?: number;
  unitPriceCents?: number;
  isAutoTagged?: boolean; // System-detected line
  isHeuristicTagged?: boolean; // Pattern match
  isAnalyticalTagged?: boolean; // Analytical telemetry tagging
  confidence?: number;
  isTransfer?: boolean; // Exclude from P&L and operating expense/income calculations
}

export interface Transaction {
  id: string;
  uid: string;
  workspaceId: string;
  date: string;
  dueDate?: string;
  description: string;
  payee?: string;
  recurrenceOccurrenceKey?: string;
  
  // Atomic Double-Entry Splits
  lines: TransactionLine[];
  
  // Total absolute value (for display convenience, though derived from lines)
  totalAmountCents: number; 
  taxAmountCents?: number;
  currency: string;
  originalCurrency?: string;
  exchangeRate?: number;
  schemaVersion?: string; // "1.1" for multi-year tracking
  
  // Transfers & Inter-Account Movements
  isTransfer?: boolean;
  transferDetails?: {
    fromAccountId: string;
    toAccountId: string;
    transferId?: string;
  };

  // Source Document Storage
  fileUrls?: string[];
  
  // Bank Reconciliation
  isCleared?: boolean;
  clearedAt?: string;
  bankTransactionId?: string; // For Plaid/Teller linking
  importIdentity?: string; // Deterministic idempotency fingerprint: <source>:<kind>:<hash>
  
  // Unit-Level Logic
  units?: number;
  unitType?: string; 
  
  status: 'draft' | 'pending' | 'certified' | 'completed' | 'failed' | 'flagged' | 'reconciled' | 'reviewed' | 'overdue' | 'approved' | 'void';
  type: 'actual' | 'forecast' | 'adjustment' | 'reversal' | 'journal' | 'expense' | 'income' | 'bank_import';
  total_impact?: number; // New: Aggregated impact score
  projectId?: string;    // Explicit project reference
  classId?: string;      // Explicit Class tracking
  locationId?: string;   // Explicit Location tracking
  employeeId?: string;   // Employee map
  tags?: string[];
  metadata?: Record<string, any>;
  // Audit & History
  verification?: {
    status: 'verified' | 'unverified';
    verifiedAt?: string;
    verifiedBy?: string;
    method?: 'manual' | 'ai' | 'bank';
    hash: string; // SHA-256 Audit Hash
    previousHash?: string; // Causal Version Control
    timestamp: string;
  };
  
  parentEventId?: string;
  eventId?: string;
  reversalEventId?: string;

  project?: string; // Legacy field for migration
  dimensions?: Record<string, string>;
  isIntercompany?: boolean;

  createdAt?: string;
  updatedAt?: string;
  expectedUpdatedAt?: string;
  deletedAt?: string; 
  isFlagged?: boolean;
  isLocked?: boolean;
  lockedAt?: string;
  paymentToken?: string;
  posted?: boolean;
}

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
  metadata?: Record<string, any>;
  splitRules?: Array<{
    partnerId: string;
    partnerName?: string;
    percentage: number;
  }>;
  createdAt: string;
}

export interface Vendor {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  category: string;
  email?: string;
  phone?: string;
  type?: string; // 'subcontractor', 'service_provider', 'supplier', etc.
  status?: 'active' | 'inactive' | 'blocked' | 'approved' | string;
  pipelineStage?: string;
  is1099?: boolean;
  isForeign?: boolean;
  rating?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  balanceCents?: number;
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
  metadata?: Record<string, any>;
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
  posted?: boolean;
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
  metadata?: Record<string, any>;
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
    metadata?: Record<string, any>;
  }>;
  progressPercentage?: number;
  discountCents?: number;
  retainageCents?: number;
  depositCents?: number;
  taxInclusive?: boolean;
  posted?: boolean;
  currency?: string;
  paymentDate?: string;
  paidAt?: string;
  milestone?: string;
  isLocked?: boolean;
  lockedAt?: string;
  paymentToken?: string;
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
  date: string;
  reason?: string;
  status: 'draft' | 'open' | 'applied' | 'partially_applied' | 'void';
  currency?: string;
  exchangeRate?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
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
  date: string;
  reason?: string;
  status: 'draft' | 'open' | 'applied' | 'partially_applied' | 'void';
  currency?: string;
  exchangeRate?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
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
  metadata?: Record<string, any>;
  notes?: string;
  isForeign?: boolean;
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

export interface DashboardSchema {
  name?: string;
  nodes: TopologyNode[];
  links: TopologyLink[];
}

export interface TopologyNode {
  id: string;
  name?: string;
  label?: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  valueCents: number;
  overrideValueCents?: number;
  config: {
    filter?: Record<string, string>;
    formula?: string;
    targetId?: string;
    taxCategory?: string;
    accountingGroup?: string;
    color?: string;
  };
}

export interface TopologyLink {
  id?: string;
  source: string;
  target: string;
  weight: number;
  type?: string;
}

export type SelectionState = {
  nodes: string[];
  links: string[];
};

export type ChartAccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_goods' | 'revenue';

export type ChartAccountCategory = 
  | 'Cash'
  | 'Receivables'
  | 'Inventory'
  | 'Deposits'
  | 'Fixed Assets'
  | 'Investments'
  | 'Payables'
  | 'Debt'
  | 'Tax'
  | 'Equity'
  | 'Sales'
  | 'Revenue'
  | 'COGS'
  | 'Direct Costs'
  | 'Labor'
  | 'Operations'
  | 'Production'
  | 'Marketing'
  | 'Overhead'
  | 'Fees'
  | 'Travel'
  | 'Food'
  | 'Housing'
  | 'Health'
  | 'Lifestyle'
  | 'Education'
  | 'Insurance'
  | 'Programs'
  | 'Subsidies'
  | (string & {});

export interface ChartAccount {
  id: string;
  uid: string;
  workspaceId: string;
  code: string;
  name: string;
  type: ChartAccountType;
  category?: ChartAccountCategory;
  subtype?: string;  // e.g. "Credit Card", "Checking"
  taxCategory?: string; // e.g. "Schedule C: Office Expenses"
  currency?: string; // Multi-currency support
  bankId?: string;   // OFX / Bank routing identifier
  accountType?: 'CHECKING' | 'SAVINGS' | 'MONEYMRKT' | 'CREDITLINE' | (string & {}); // OFX Account Type
  balanceCents: number;
  projectAllocations?: Record<string, number>;
  openingBalanceCents?: number;
  asOfDate?: string;
  parentId?: string;
  description?: string;
  isContra?: boolean;
  isArchived?: boolean;
  archived?: boolean;
  isSystem?: boolean;
  classification?: string;
  role?: string;
  isActive?: boolean;
  /** Set when the account came from a spreadsheet import; lets the import be undone. */
  importBatchId?: string;
}

export interface JournalEntry {
  id: string;
  uid: string;
  workspaceId: string;
  date: string;
  description: string;
  reference?: string;
  lines: JournalLine[];
  createdAt: string;
  deletedAt?: string;
}

export interface JournalLine {
  id?: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  project?: string;
  class?: string;
  location?: string;
  dimensions?: Record<string, string>;
}

export interface Budget {
  id: string;
  uid: string;
  targetId: string; // Project ID or Category name or Account ID
  targetType: 'category' | 'project' | 'account';
  period: string; // e.g. "2026-03" or "2026"
  amountCents: number;
  exchangeRate?: number;
  createdAt: string;
}

export interface AutoRule {
  id: string;
  uid: string;
  workspaceId?: string;
  name?: string;
  groupName?: string;
  condition: {
    vendor?: string;
    project?: string;
    category?: string;
    descriptionContains?: string;
    descriptionStartsWith?: string;
    amountThreshold?: number;
    exactAmount?: number;
    minAmountCents?: number;
    maxAmountCents?: number;
    dateRange?: { start: string, end: string };
  };
  action: {
    targetNodeId?: string;
    targetProject?: string;
    targetCategory?: string;
    targetClass?: string;
    targetLocation?: string;
    targetDimensions?: Record<string, string>;
    targetTags?: string[];
    flagForReview?: boolean;
    descriptionPrefix?: string;
    descriptionSuffix?: string;
    setNotes?: string;
    addTags?: string[];
    removeTags?: string[];
    setAmountCents?: number;
    deleteTransaction?: boolean;
  };
  confidence: number; // 0 to 1
  isHardened: boolean; // True if user confirmed
  priority?: number;
  isActive?: boolean;
  stopProcessingOnMatch?: boolean;
  hitCount?: number;
  lastTriggeredAt?: string;
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
  createdAt: string;
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

export interface AccountingPeriod {
  id: string;
  uid: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
}

export interface ReconciliationSession {
  id: string;
  uid: string;
  workspaceId: string;
  bankAccountId: string;
  statementDate: string;
  statementBalanceCents: number;
  ledgerBalanceCents: number;
  status: 'draft' | 'completed';
  reconciledTransactions: string[];
  createdAt: string;
}

export interface PeriodStatus {
  id: string;
  uid: string;
  workspaceId: string;
  periodId: string; // e.g., 2024-01
  status: 'open' | 'closed' | 'soft_closed';
  closeMode?: 'soft' | 'hard';
  /** Checklist sign-offs (src/lib/closeChecklist.ts), written by the server. */
  signOffs?: Record<string, { by: string; at: string; note?: string }>;
  closedAt?: string;
  closedBy?: string;
  startDate: string;
  endDate: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type FiscalPeriod = PeriodStatus;

export interface CorrectionEvent {
  id: string;
  uid: string;
  workspaceId: string;
  vendorName: string;
  originalCategory?: string;
  correctedCategory: string;
  originalAccount?: string;
  correctedAccount?: string;
  timestamp: string;
}

export interface Partner {
  id: string;
  uid: string;
  name: string;
  share: number;
  initialCapitalCents: number;
  createdAt: string;
}

export interface AuditLogDetails {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: string[];
  description?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuditLog {
  id: string;
  uid: string;
  email?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  details: AuditLogDetails;
  timestamp: string;
}

export interface WorkspaceInvite {
  id?: string;
  inviteId?: string;
  workspaceId: string;
  email: string;
  role: 'owner' | 'accountant' | 'bookkeeper' | 'viewer';
  expiresAt: string;
  createdAt?: string;
  token: string;
  signature?: string;
  invitedByUid?: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
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
  status: 'active' | 'disposed';
  createdAt: string;
  /** Balance sheet account the asset's cost is in (e.g. Equipment). */
  assetAccountId?: string;
  /** Where the monthly run posts: DR expenseAccountId, CR accumulatedAccountId. */
  expenseAccountId?: string;
  accumulatedAccountId?: string;
  /** Last month (YYYY-MM) the depreciation run covered, and its ledger entry. */
  depreciatedThrough?: string;
  lastDepreciationTransactionId?: string;
}

export interface RecurringTransaction {
  id: string;
  uid: string;
  workspaceId: string;
  description: string;
  amountCents: number;
  exchangeRate?: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextOccurrence: string;
  anchorDay?: number;
  isActive: boolean;
  status?: 'active' | 'paused' | 'completed';
  lastOccurrence?: string;
  payee?: string;
  type?: string;
  template: Partial<Transaction>;
  createdAt: string;
  generatedCount?: number;
  lastErrorCode?: string;
  lastErrorAt?: string;
  cursorVersion?: number;
}

export interface BankStatementLine {
  id: string;
  uid: string;
  workspaceId: string;
  accountId?: string;
  date: string;
  description: string;
  amountCents: number;
  exchangeRate?: number;
  matchedTransactionId?: string;
  status: 'pending' | 'matched' | 'ignored';
}

export interface PartnerSplit {
  id: string;
  name: string;
  share: number; // Percentage
  initialCapitalCents: number;
}

export interface FilterCriteria {
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  category?: string;
  account?: string;
  project?: string;
  status?: string;
  type?: string;
  selectedCategories?: string[];
  selectedProjects?: string[];
  selectedStatuses?: string[];
  selectedTypes?: string[];
  selectedClasses?: string[];
  selectedLocations?: string[];
  includeSimulations?: boolean;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  role: 'admin' | 'client';
  geminiApiKey?: string;
  createdAt?: string;
  lastLoginAt?: string;
  metadata?: Record<string, any>;
  plan?: 'free' | 'growth' | 'enterprise';
  seatIndex?: number;
  isActiveSession?: boolean;
}

export type UserProfile = User;

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
}

export interface PayRun {
  id: string;
  uid: string;
  workspaceId: string;
  date: string;
  totalAmountCents: number;
  employeeCount: number;
  status: 'draft' | 'processed' | 'failed';
  createdAt: string;
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
  tags?: string[]; metadata?: Record<string, any>;
  createdAt: string;
}

export interface TemporalValidity {
  validFrom: string; // ISO 8601 'YYYY-MM-DD'
  validTo?: string | null;  // ISO 8601 'YYYY-MM-DD' or null if indefinitely valid
  value: number;
}

export interface TaxRate {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  rate: number; // Current baseline rate
  type: 'Sales' | 'Income' | 'Payroll';
  timeSeries?: TemporalValidity[]; // Historical/Future rate adjustments reflecting changing tax laws
  jurisdiction?: string; // Country/State/City
  createdAt: string;
}

export interface AnalyticalMetrics {
  kpis: {
    revenue: number;
    prevRevenue: number;
    expenses: number;
    prevExpenses: number;
    netCash: number;
    prevNetCash: number;
    burnRate: number;
    prevBurnRate: number;
    totalCash: number;
    runwayMonths: number;
    healthScore: number;
    complianceScore: number;
    volatility: number;
    cashVelocity: number;
    concentrationIndex: number;
    grossMargin: number;
    operatingMargin: number;
    currentRatio: number;
    quickRatio: number;
    yieldEfficiency: number;
    prevHealthScore?: number;
    monteCarloRunway?: { confidence95: number; confidence50: number; failureProbability: number };
    correlations?: { pairs: { a: string; b: string; score: number; lag: number }[] };
  };
  trends: {
    revenue: number;
    expenses: number;
    netCash: number;
    burnRate: number;
  };
  timeSeries: {
    date: string;
    inflow: number;
    outflow: number;
    balance: number;
    net: number;
  }[];
  allocations: {
    name: string;
    value: number;
  }[];
  recentActivity: Transaction[];
  anomalies: {
    transactionId: string;
    score: number; // 0-1
    reason: string;
    zScore?: number;
    signature?: string;
  }[];
  periodicity: {
    period: number;
    confidence: number;
    label: string;
  }[];
  graphCentrality: {
    id: string;
    name: string;
    score: number;
    type: 'account' | 'merchant';
  }[];
  layerStatus: {
    name: string;
    status: 'active' | 'standby' | 'error';
    algorithm: string;
  }[];
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
  tags?: string[]; metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
  ticketId?: string;
  createdAt: string;
}

export type AppTab = string;
