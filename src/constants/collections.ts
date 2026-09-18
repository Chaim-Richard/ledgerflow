/**
 * Canonical list of workspace-scoped collections subscribed to by the client
 * and managed within a workspace environment.
 * Audit logs ('auditLogs') are kept permanently for security and compliance audit trails.
 */
export const WORKSPACE_SCOPED_COLLECTIONS = [
  'transactions',
  'chartAccounts',
  'projects',
  'taxRates',
  'customTemplates',
  'partners',
  'autoRules',
  'rulePatterns',
  'dimensionNodes',
  'invoices',
  'creditNotes',
  'payments',
  'estimates',
  'customers',
  'bills',
  'vendorCredits',
  'vendors',
  'inventory',
  'budgets',
  'payRuns',
  'employees',
  'bankLines',
  'reconciliations',
  'periods',
  'scenarios',
  'recurring',
  'assets',
  'invites',
  'journalEntries',
  'workspaceShards',
  'billingLedgerTraces',
  'supportTickets',
  'supportMessages'
] as const;

export type WorkspaceScopedCollection = typeof WORKSPACE_SCOPED_COLLECTIONS[number];
