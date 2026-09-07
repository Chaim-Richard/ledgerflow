import { z } from 'zod';

export const SplitAllocationSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().optional(),
  projectId: z.string().optional(),
  weight: z.number().min(0).max(1),
  amountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  notes: z.string().max(500).optional(),
});

export const TransactionLineSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().optional(),
  amountCents: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  exchangeRate: z.number().positive().finite().default(1),
  description: z.string().max(500).optional(),
  class: z.string().optional(),
  location: z.string().optional(),
  project: z.string().optional(),
  dimensions: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  splitAllocations: z.array(SplitAllocationSchema).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxAmountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  quantity: z.number().positive().finite().optional(),
  unitPriceCents: z.number().int().nonnegative().optional(),
});

export const TransactionSchema = z.object({
  id: z.string().optional(),
  uid: z.string(),
  workspaceId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  description: z.string().max(2000).default(''),
  totalAmountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  currency: z.string().optional().default('USD'),
  originalCurrency: z.string().optional(),
  exchangeRate: z.number().positive().finite().default(1),
  payee: z.string().optional(),
  status: z.enum(['draft', 'pending', 'certified', 'void', 'reconciled', 'completed', 'failed', 'flagged', 'reviewed', 'overdue', 'approved']).default('pending'),
  type: z.enum(['actual', 'forecast', 'adjustment', 'reversal', 'journal', 'expense', 'income', 'bank_import']).default('actual'),
  lines: z.array(TransactionLineSchema).min(1).max(100),
  tags: z.array(z.string()).max(10).optional(),
  reference: z.string().max(100).optional(),
  projectId: z.string().optional(),
  isCleared: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ChartAccountSchema = z.object({
  id: z.string().optional(),
  uid: z.string().optional(),
  workspaceId: z.string(),
  name: z.string().min(2).max(100),
  code: z.string().regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense', 'cost_of_goods', 'revenue', 'other_income', 'other_expense']),
  category: z.string().max(100).optional(),
  subtype: z.string().optional(),
  taxCategory: z.string().optional(),
  currency: z.string().optional(),
  balanceCents: z.number().int().default(0),
  description: z.string().max(500).optional(),
  parentId: z.string().nullable().optional(),
  openingBalanceCents: z.number().int().default(0),
  isActive: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const WorkspaceSchema = z.object({
  id: z.string().optional(),
  uid: z.string(),
  name: z.string().min(2).max(100),
  isClosed: z.boolean().default(false),
  lockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  fiscalYearEnd: z.string().optional(),
  currency: z.string().default('USD'),
  admins: z.record(z.string(), z.boolean()).optional(),
  createdAt: z.string().optional(),
});

export const BankMappingRequestSchema = z.object({
  transactions: z.array(z.object({
    id: z.string(),
    description: z.string(),
    amountCents: z.number().int(),
  exchangeRate: z.number().optional(),
  })),
  workspaceId: z.string(),
  context: z.string().optional(),
});

export const WorkspaceIdSchema = z.object({
  workspaceId: z.string().min(1)
});

export const ReportRangeSchema = WorkspaceIdSchema.extend({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

// --- Enterprise Math API Schemas ---
export const DepreciationRequestSchema = z.object({
  type: z.enum(['straight_line', 'declining_balance', 'double_declining_balance', 'sum_of_years_digits']),
  costCents: z.number().int().positive(),
  salvageValueCents: z.number().int().nonnegative(),
  usefulLifePeriods: z.number().int().positive(),
  depreciationRate: z.number().min(0).max(1).optional(),
  multiplier: z.number().positive().max(5).optional(),
  currentPeriod: z.number().int().positive().optional()
}).refine(data => data.salvageValueCents <= data.costCents, {
  message: "salvageValueCents cannot exceed costCents"
});

export const ValuationRequestSchema = z.object({
  equityCents: z.number().int().nonnegative().optional(),
  debtCents: z.number().int().nonnegative().optional(),
  costOfEquity: z.number().nonnegative().optional(),
  costOfDebt: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  forecastedFCFF: z.array(z.number()).max(100, "Max forecast periods is 100").optional(),
  wacc: z.number().optional(),
  terminalGrowthRate: z.number().min(-0.5).max(0.5).optional(),
  workingCapital: z.number().optional(),
  retainedEarnings: z.number().optional(),
  ebit: z.number().optional(),
  mktValueEquity: z.number().optional(),
  totalLiabilities: z.number().optional(),
  totalAssets: z.number().optional(),
  sales: z.number().optional(),
});

export const TemporalMathRequestSchema = z.object({
  type: z.enum(['tax', 'currency']),
  amountCents: z.number().int(),
  exchangeRate: z.number().positive().finite().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  timeSeries: z.array(z.object({
    validFrom: z.string(),
    validTo: z.union([z.string(), z.null()]),
    value: z.number()
  })).max(1000, "Max time series elements is 1000")
});

export const KPIRequestSchema = z.object({
  netProfitCents: z.number().optional(),
  investmentCostCents: z.number().optional(),
  discountRate: z.number().gt(-1).optional(),
  initialInvestmentCents: z.number().optional(),
  cashFlowsCents: z.array(z.number()).max(100, "Max cashFlow elements is 100").optional(),
  revenueCents: z.number().optional(),
  cogsCents: z.number().optional(),
  fixedCostsCents: z.number().optional(),
  variableCostPerUnitCents: z.number().optional(),
  pricePerUnitCents: z.number().optional(),
  currentAssetsCents: z.number().optional(),
  currentLiabilitiesCents: z.number().optional(),
  inventoryCents: z.number().optional(),
  totalLiabilitiesCents: z.number().optional(),
  totalEquityCents: z.number().optional()
});

export const AmortizationRequestSchema = z.object({
  principalCents: z.number().int().nonnegative(),
  annualInterestRate: z.number().nonnegative(),
  totalPeriods: z.number().int().positive(),
  paymentsPerYear: z.number().int().positive().optional()
});

export const InventoryWACRequestSchema = z.object({
  currentQty: z.number().int().nonnegative(),
  currentValueCents: z.number().int().nonnegative(),
  incomingQty: z.number().int().nonnegative(),
  incomingValueCents: z.number().int().nonnegative()
});

export const InventoryEOQRequestSchema = z.object({
  annualDemand: z.number().int().nonnegative(),
  costPerOrderCents: z.number().int().nonnegative(),
  holdingCostPerUnitCents: z.number().int().nonnegative()
});

export const BankLineUpdateSchema = z.object({
  status: z.enum(['matched', 'unmatched', 'excluded', 'pending', 'reconciled', 'ignored']).optional(),
  matchedTransactionId: z.string().nullable().optional(),
  ruleId: z.string().nullable().optional(),
  category: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  isReviewed: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
}).strict();

export const InvoiceSchema = z.object({
  id: z.string().optional(),
  uid: z.string().optional(),
  workspaceId: z.string(),
  customerId: z.string().optional(),
  customerName: z.string().max(200).optional(),
  vendorId: z.string().optional(),
  number: z.string().max(100).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().optional(),
  paidAmountCents: z.number().int().nonnegative().optional(),
  amountPaidCents: z.number().int().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  exchangeRate: z.number().positive().finite().optional(),
  status: z.enum(['draft', 'pending', 'paid', 'partially_paid', 'overdue', 'sent', 'approved', 'rejected', 'invoiced', 'void']),
  date: z.string().optional(),
  dueDate: z.string().optional(),
  paymentToken: z.string().optional(),
  notes: z.string().max(2000).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxAmountCents: z.number().int().nonnegative().optional(),
  lines: z.array(z.record(z.string(), z.any())).optional(),
  items: z.array(z.record(z.string(), z.any())).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  isLocked: z.boolean().optional(),
  lockedAt: z.string().optional(),
  reversalEventId: z.string().optional(),
});

export const BillSchema = z.object({
  id: z.string().optional(),
  uid: z.string().optional(),
  workspaceId: z.string(),
  vendorId: z.string().min(1),
  vendorName: z.string().max(200).optional(),
  number: z.string().max(100).optional(),
  amountCents: z.number().int().nonnegative(),
  exchangeRate: z.number().positive().finite().optional(),
  taxAmountCents: z.number().int().nonnegative().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  receiptUrl: z.string().url().or(z.string().max(500)).optional(),
  splits: z.array(z.record(z.string(), z.any())).optional(),
  projectId: z.string().optional(),
  issueDate: z.string().optional(),
  date: z.string().optional(),
  dueDate: z.string(),
  status: z.enum(['draft', 'pending', 'approved', 'paid', 'partially_paid', 'overdue', 'unpaid', 'void']),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  reversalEventId: z.string().optional(),
  isLocked: z.boolean().optional(),
  lockedAt: z.string().optional(),
  paymentToken: z.string().optional(),
  paidAmountCents: z.number().int().nonnegative().optional(),
});

export const OrderSchema = z.object({
  id: z.string().optional(),
  uid: z.string().optional(),
  workspaceId: z.string(),
  customerId: z.string().optional(),
  customerName: z.string().max(200).optional(),
  orderNumber: z.string().max(100).optional(),
  number: z.string().max(100).optional(),
  amountCents: z.number().int().nonnegative(),
  status: z.enum(['draft', 'pending', 'shipped', 'cancelled', 'fulfilled', 'completed', 'paid']),
  date: z.string().optional(),
  items: z.array(z.record(z.string(), z.any())).optional(),
  lines: z.array(z.record(z.string(), z.any())).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ProjectSchema = z.object({
  id: z.string().optional(),
  uid: z.string().optional(),
  workspaceId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['book', 'event', 'campaign', 'general']).optional(),
  status: z.enum(['active', 'completed', 'archived']),
  pipelineStage: z.enum(['planning', 'in_progress', 'review', 'completed', 'archived']).optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  costCodes: z.array(z.record(z.string(), z.any())).optional(),
  laborBuckets: z.array(z.record(z.string(), z.any())).optional(),
  materialsBuckets: z.array(z.record(z.string(), z.any())).optional(),
  subcontractCosts: z.array(z.record(z.string(), z.any())).optional(),
  dimensions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  splitRules: z.array(z.record(z.string(), z.any())).optional(),
});

export type ValidatedTransaction = z.infer<typeof TransactionSchema>;
export type ValidatedChartAccount = z.infer<typeof ChartAccountSchema>;
export type ValidatedWorkspace = z.infer<typeof WorkspaceSchema>;
export type ValidatedTransactionLine = z.infer<typeof TransactionLineSchema>;
