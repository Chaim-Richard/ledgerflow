import type { EntityMetadata } from './ledger';

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
  /** Sold or scrapped (X-03, src/server/services/assetDisposalService.ts): the day, the money received, the gain (+) or loss (−) and its entry. */
  disposedOn?: string;
  disposalProceedsCents?: number;
  disposalGainLossCents?: number;
  disposalTransactionId?: string;
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
