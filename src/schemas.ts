import { z } from 'zod';

export const TransactionLineSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().optional(),
  amountCents: z.number().int(),
  exchangeRate: z.number().optional(),
  description: z.string().max(500).optional(),
});

export const TransactionSchema = z.object({
  id: z.string().optional(),
  uid: z.string(),
  workspaceId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  description: z.string().min(3).max(2000),
  totalAmountCents: z.number().int(),
  status: z.enum(['pending', 'certified', 'voided', 'reconciled', 'completed', 'failed', 'flagged', 'reviewed']).default('pending'),
  type: z.enum(['journal', 'expense', 'income', 'bank_import']).default('journal'),
  lines: z.array(TransactionLineSchema).min(1).max(100),
  tags: z.array(z.string()).max(10).optional(),
  reference: z.string().max(100).optional(),
  projectId: z.string().optional(),
  isCleared: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const ChartAccountSchema = z.object({
  id: z.string().optional(),
  uid: z.string(),
  workspaceId: z.string(),
  name: z.string().min(2).max(100),
  code: z.string().regex(/^[a-zA-Z0-9_\-]+$/),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  category: z.string().max(100).optional(),
  balanceCents: z.number().int().default(0),
  description: z.string().max(500).optional(),
  parentId: z.string().optional(),
  openingBalanceCents: z.number().int().default(0),
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
  costCents: z.number().int(),
  salvageValueCents: z.number().int(),
  usefulLifePeriods: z.number().int().positive(),
  depreciationRate: z.number().optional(),
  multiplier: z.number().optional(),
  currentPeriod: z.number().int().positive().optional()
});

export const ValuationRequestSchema = z.object({
  equityCents: z.number().int().nonnegative().optional(),
  debtCents: z.number().int().nonnegative().optional(),
  costOfEquity: z.number().nonnegative().optional(),
  costOfDebt: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional(),
  forecastedFCFF: z.array(z.number()).max(100, "Max forecast periods is 100").optional(),
  wacc: z.number().optional(),
  terminalGrowthRate: z.number().optional(),
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
  exchangeRate: z.number().optional(),
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
  discountRate: z.number().optional(),
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

export type ValidatedTransaction = z.infer<typeof TransactionSchema>;
export type ValidatedChartAccount = z.infer<typeof ChartAccountSchema>;
export type ValidatedWorkspace = z.infer<typeof WorkspaceSchema>;
export type ValidatedTransactionLine = z.infer<typeof TransactionLineSchema>;
