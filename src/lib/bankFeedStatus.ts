/**
 * A bank connection's state as the server reports it (`GET /api/v1/plaid/banks`), its sync history
 * (Z-29: the last attempts, newest first, each with what came of it) and its health in words (Z-28).
 */
export interface SyncLogEntry {
  at: string;
  result: 'ok' | 'login_required' | 'error';
  /** bank lines the bank sent (a successful sync) */
  lines?: number;
  /** the bank's error code (a failed sync) */
  error?: string;
}
export interface BankStatus { id: string; institutionName: string; status: string; lastSyncedAt?: string | null; syncLog?: SyncLogEntry[] }

/** Sync attempts kept per connection */
export const MAX_SYNC_LOG = 20;
/** A connection that has not synced for longer than this many days is said to be behind */
export const STALE_DAYS = 3;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isIso = (value: unknown): value is string => typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** The log with this attempt first, at most MAX_SYNC_LOG long (anything unreadable is dropped). */
export function appendSyncLog(log: unknown, entry: SyncLogEntry): SyncLogEntry[] {
  return [entry, ...readSyncLog(log)].slice(0, MAX_SYNC_LOG);
}

export function readSyncLog(value: unknown): SyncLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw: unknown) => {
    const e = (raw || {}) as Record<string, unknown>;
    if (!isIso(e.at) || !['ok', 'login_required', 'error'].includes(String(e.result))) return [];
    return [{
      at: e.at, result: e.result as SyncLogEntry['result'],
      ...(typeof e.lines === 'number' && Number.isInteger(e.lines) && e.lines >= 0 ? { lines: e.lines } : {}),
      ...(typeof e.error === 'string' && e.error ? { error: e.error.slice(0, 100) } : {}),
    }];
  }).slice(0, MAX_SYNC_LOG);
}

/** Z-28: how the connection is doing, in words, and whether someone has to act. */
export function bankHealth(bank: Pick<BankStatus, 'status' | 'lastSyncedAt' | 'syncLog'>, nowMs: number): { level: 'ok' | 'behind' | 'action'; words: string } {
  if (bank.status === 'login_required') return { level: 'action', words: 'Login expired: reconnect it' };
  if (bank.status === 'error') {
    const code = bank.syncLog?.find(e => e.result === 'error')?.error;
    return { level: 'action', words: `The last sync failed${code ? ` (${code})` : ''}: try again, or reconnect it` };
  }
  if (!bank.lastSyncedAt) return { level: 'behind', words: 'Not synced yet' };
  const days = Math.floor((nowMs - Date.parse(bank.lastSyncedAt)) / 86_400_000);
  if (days > STALE_DAYS) return { level: 'behind', words: `No sync for ${days} days` };
  return { level: 'ok', words: 'Connected' };
}

export function readBankStatuses(value: unknown): BankStatus[] {
  if (!value || typeof value !== 'object' || !('banks' in value) || !Array.isArray(value.banks)) throw new Error('The server did not return bank connection status.');
  return value.banks.map((bank: unknown) => {
    if (!bank || typeof bank !== 'object' || !('id' in bank) || typeof bank.id !== 'string' || bank.id.length > 500) throw new Error('Invalid bank connection status.');
    let sync: Pick<BankStatus, 'lastSyncedAt'> = {};
    if ('lastSyncedAt' in bank) {
      const value = bank.lastSyncedAt;
      if (value === null) sync = { lastSyncedAt: null };
      else if (isIso(value)) sync = { lastSyncedAt: value };
      else throw new Error('Invalid bank last successful sync timestamp.');
    }
    const log = 'syncLog' in bank ? { syncLog: readSyncLog(bank.syncLog) } : {};
    return { ...sync, ...log, id: bank.id, institutionName: 'institutionName' in bank && typeof bank.institutionName === 'string' ? bank.institutionName : 'Bank', status: 'status' in bank && typeof bank.status === 'string' ? bank.status : 'unknown' };
  });
}
