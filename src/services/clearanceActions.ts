import { getIdToken } from '../firebase';

/**
 * Mark entries cleared by the bank, with the day it cleared (CA-04), or not cleared any more —
 * through the server (writers only; the period lock and the entry's own date are checked there).
 */
export async function setCleared(workspaceId: string, transactionIds: string[], change: { cleared: true; clearanceDate?: string } | { cleared: false }): Promise<void> {
  const token = await getIdToken().catch(() => null);
  const res = await fetch('/api/v1/transactions/reconciliation/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ workspaceId, transactionIds, ...change }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || 'The entry could not be marked');
  }
}
