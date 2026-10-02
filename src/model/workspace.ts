import type { LockException } from '../lib/periodLock';
import type { EmailTemplates } from '../lib/emailTemplates';
import type { ReminderSettings } from '../lib/reminders';
import type { NotificationType } from '../lib/notifications';
import type { EntityMetadata, DimensionDefinition, Transaction } from './ledger';

// Workspaces, people and the app: members, invites, notifications, audit log, dashboards, partners.
// Part of src/types.ts (F-10): import from '../types' as before; it re-exports this file.

/** One person's in-app notification (table `notifications`, created by the server). */
export interface AppNotification {
  id: string;
  workspaceId: string;
  uid: string;
  kind: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
  linkTab?: string;
  recordId?: string;
  eventKey?: string;
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
  importColumnMaps?: Record<string, import('../lib/importColumnMaps').SavedColumnMap>;
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
  /** First-run setup finished (src/server/services/openingBalanceService.ts). Server-only. */
  setupCompletedAt?: string;
  /** The start date of the books (opening balances). Server-only. */
  openingBalanceDate?: string;
  /** How long logs are kept, recovery window, legal hold (src/lib/retention.ts). Server-only. */
  retention?: Partial<import('../lib/retention').RetentionSettings>;
  /** 'pending_deletion' while a deleted workspace waits out its 30 days */
  status?: string;
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

export interface PartnerSplit {
  id: string;
  name: string;
  share: number; // Percentage
  initialCapitalCents: number;
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
  metadata?: EntityMetadata;
  plan?: 'free' | 'growth' | 'enterprise';
  seatIndex?: number;
  isActiveSession?: boolean;
}

export type UserProfile = User;

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

export type AppTab = string;
