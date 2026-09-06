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
  strategicAdvice?: string[];
  analyticalTopology?: DashboardSchema;
  currency?: string;
  defaultAccountMappings?: Record<string, string>;
  isDemoLoaded?: boolean;
  dateFormat?: string;
  aiModel?: string;
  matchingThreshold?: number;
  notifications?: {
    largeTransactionAlert: boolean;
    largeTransactionThreshold: number;
    anomalyAlert: boolean;
  };
  // Billing & Tenant Resource Constraints
  plan?: 'free' | 'growth' | 'enterprise';
  billingCycle?: 'monthly' | 'yearly';
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
  dimensions?: DimensionDefinition[]; // Dynamic workspace dimensional coordinate schema
  dimensionNodes?: DimensionNode[];   // Nodes/labels within dimensions (e.g., P1 under property)
  allowedWorldPaths?: string[];       // Coordinate-scoped permissions for sub-ledgers
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
  accountId: string;
  accountName: string;
  amountCents: number; // Positive for Debit, Negative for Credit
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
}

export interface Transaction {
  id: string;
  uid: string;
  workspaceId: string;
  date: string;
  dueDate?: string;
  description: string;
  payee?: string;
  
  // Atomic Double-Entry Splits
  lines: TransactionLine[];
  
  // Total absolute value (for display convenience, though derived from lines)
  totalAmountCents: number; 
  taxAmountCents?: number;
  currency: string;
  originalCurrency?: string;
  exchangeRate?: number;
  schemaVersion?: string; // "1.1" for multi-year tracking
  
  // Source Document Storage
  fileUrls?: string[];
  
  // Bank Reconciliation
  isCleared?: boolean;
  clearedAt?: string;
  bankTransactionId?: string; // For Plaid/Teller linking
  
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

  createdAt: string;
  deletedAt?: string; 
  isFlagged?: boolean;
  isLocked?: boolean;
  lockedAt?: string;
  paymentToken?: string;
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
  status?: 'active' | 'inactive' | 'blocked' | 'approved';
  is1099?: boolean;
  isForeign?: boolean;
  rating?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  balanceCents?: number;
}

export interface Bill {
  id: string;
  uid: string;
  workspaceId: string;
  vendorId: string;
  vendorName?: string;
  number?: string;
  amountCents: number;
  exchangeRate?: number;
  taxAmountCents?: number;
  taxRate?: number;
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
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'partially_paid' | 'overdue' | 'unpaid' | 'void';
  reversalEventId?: string;
  isLocked?: boolean;
  lockedAt?: string;
  paymentToken?: string;
}

export interface Invoice {
  id: string;
  uid: string;
  workspaceId: string;
  customerId: string;
  customerName?: string;
  number?: string;
  amountCents: number;
  exchangeRate?: number;
  totalCents?: number;
  date?: string;
  dueDate: string;
  tags?: string[];
  metadata?: Record<string, any>;
  status: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'sent' | 'draft' | 'approved' | 'rejected' | 'invoiced' | 'void';
  type?: 'standard' | 'recurring' | 'progress' | 'estimate' | 'quote' | 'change-order' | 'time-materials'; // For advanced billing workflows
  recurringInterval?: 'monthly' | 'weekly' | 'yearly';
  progressPercentage?: number;
  discountCents?: number;
  retainageCents?: number;
  depositCents?: number;
  taxRate?: number;
  taxInclusive?: boolean;
  currency?: string;
  milestone?: string;
  isLocked?: boolean;
  lockedAt?: string;
  paymentToken?: string;
}

export interface Customer {
  id: string;
  uid: string;
  workspaceId: string;
  name: string;
  email?: string;
  phone?: string;
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

export interface ChartAccount {
  id: string;
  uid: string;
  workspaceId: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_goods' | 'revenue';
  category?: string; // e.g. "Cash", "Inventory", "Sales"
  subtype?: string;  // e.g. "Credit Card", "Checking"
  taxCategory?: string; // e.g. "Schedule C: Office Expenses"
  currency?: string; // Multi-currency support
  balanceCents: number;
  projectAllocations?: Record<string, number>;
  openingBalanceCents?: number;
  asOfDate?: string;
  parentId?: string;
  description?: string;
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
  condition: {
    vendor?: string;
    project?: string;
    category?: string;
    descriptionContains?: string;
    amountThreshold?: number;
    exactAmount?: number;
    dateRange?: { start: string, end: string };
  };
  action: {
    targetNodeId?: string;
    targetProject?: string;
    targetCategory?: string;
    targetClass?: string;
    targetLocation?: string;
    targetDimensions?: Record<string, string>;
    flagForReview?: boolean;
  };
  confidence: number; // 0 to 1
  isHardened: boolean; // True if user confirmed
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
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
}

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

export interface AuditLog {
  id: string;
  uid: string;
  email?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  timestamp: string;
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
  isActive: boolean;
  template: Partial<Transaction>;
  createdAt: string;
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

export type AppTab = string;
