import { getIdToken } from '../firebase';

export type NumberedDocument = 'invoice' | 'bill' | 'estimate' | 'creditNote' | 'vendorCredit' | 'payment';

/**
 * The next number of a document series (BA-07), allocated by the server in one database
 * transaction so two people never get the same one. Throws with the server's reason.
 */
export async function nextDocumentNumber(workspaceId: string, type: NumberedDocument): Promise<string> {
  const token = await getIdToken().catch(() => '');
  const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/next-number`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.number !== 'string') throw new Error(data.message || data.error || 'The next document number is not available right now');
  return data.number;
}
