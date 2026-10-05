


export const AVAILABLE_SCOPES = [
  { id: 'read:transactions', label: 'Read Transactions', desc: 'Allows querying and reading financial ledger transactions and journal entries.' },
  { id: 'write:transactions', label: 'Write Transactions', desc: 'Allows creating, modifying, and voiding journal entries.' },
  { id: 'read:projects', label: 'Read Projects', desc: 'Allows querying project codes, tags, and cost centers.' },
  { id: 'write:projects', label: 'Write Projects', desc: 'Allows creating and managing project codes and dimensional tags.' },
  { id: 'read:ledger', label: 'Read Chart of Accounts', desc: 'Allows reading account hierarchies, balances, and classifications.' },
  { id: 'write:ledger', label: 'Write Chart of Accounts', desc: 'Allows creating and structuring accounts and ledger rules.' },
  { id: 'read:workspaces', label: 'Read Workspaces', desc: 'Allows accessing workspace metadata, tax profile, and currency settings.' },
  { id: 'brain:analyze', label: 'Brain / AI Analysis', desc: 'Allows calling Bayesian classification and AI analysis endpoints.' }
];

export interface ApiLogEntry { id: string; timestamp: string; method: string; path: string; statusCode: number; latencyMs?: number; apiKeyUsed: string }

export interface PublicKeyRow { id: string; name: string; scopes: string[]; expiresAt: string; lastUsedAt: string | null; totalRequests: number; createdAt?: string }
