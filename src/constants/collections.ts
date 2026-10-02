/**
 * Workspace-scoped collections: deleting a workspace deletes these (workspacePurgeService). The
 * browser loads most of them (src/lib/ledgerCollections.ts); rules-coverage-guard.test.ts checks
 * both lists. Audit logs ('auditLogs') are kept permanently for security and compliance audit trails.
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
