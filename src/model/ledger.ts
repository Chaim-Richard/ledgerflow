import type { TaxComponent, TaxTreatment } from '../lib/taxCodes';
import type { Invoice } from './documents';

// The ledger: entries and their lines, accounts, dimensions, rules, budgets, periods, bank lines, tax rates.
// Part of src/types.ts (F-10): import from '../types' as before; it re-exports this file.

export interface EntityMetadata extends Record<string, unknown> {
  vendorId?: string;
  taxState?: string;
  dueDate?: string;
  memo?: string;
  cogsPending?: boolean;
  amountPaidCents?: number;
  lines?: { description?: string; quantity?: number; rateCents?: number; amountCents: number }[];
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
  metadata?: EntityMetadata;
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
  
  /** Cheque number, bank or document reference (shown in the journal; exported). */
  reference?: string;

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
  metadata?: EntityMetadata;
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
  /** Recurring invoices: the invoice to copy as a draft each time (dueDays after its date). */
  invoiceTemplate?: Partial<Invoice> & { dueDays?: number };
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
  /** Tax codes (src/lib/taxCodes.ts): how amounts are reported, and the parts (GST + PST…). */
  treatment?: TaxTreatment;
  components?: TaxComponent[];
  /** Where it can be used: sales, purchases or both (default both). */
  appliesTo?: 'sales' | 'purchases' | 'both';
  timeSeries?: TemporalValidity[]; // Historical/Future rate adjustments reflecting changing tax laws
  jurisdiction?: string; // Country/State/City
  createdAt: string;
}
