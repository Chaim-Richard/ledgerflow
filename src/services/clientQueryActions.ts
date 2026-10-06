import { useCallback, useEffect, useState } from 'react';
import { db, getIdToken } from '../firebase';
import { collection, getDocs, limit, onSnapshot, query, where } from '../lib/db/firestore';
import { sortQueries, type ClientQuery } from '../lib/clientQueries';

/** Questions about entries (BD-07): written through the server, which checks who may ask, answer or close. */
async function call(workspaceId: string, path: string, body: unknown) {
  const token = await getIdToken().catch(() => null);
  const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/queries${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'The question could not be sent');
  return data.data;
}

export async function askAboutEntry(workspaceId: string, transactionId: string, question: string): Promise<ClientQuery> {
  return (await call(workspaceId, '', { transactionId, question })).query as ClientQuery;
}

export async function replyToQuery(workspaceId: string, queryId: string, text: string): Promise<ClientQuery> {
  return (await call(workspaceId, `/${encodeURIComponent(queryId)}/reply`, { text })).query as ClientQuery;
}

export async function closeQuery(workspaceId: string, queryId: string): Promise<void> {
  await call(workspaceId, `/${encodeURIComponent(queryId)}/close`, {});
}

/**
 * The workspace's questions, live (the Questions screen), or one entry's, read once with `reload`
 * after each change (the entry's window: no live connection held open for every entry opened).
 * Waiting ones first.
 */
export function useClientQueries(workspaceId: string | null | undefined, transactionId?: string) {
  const [queries, setQueries] = useState<ClientQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound(r => r + 1), []);

  useEffect(() => {
    setFailed(false);
    if (!workspaceId) { setQueries([]); setLoading(false); return undefined; }
    setLoading(true);
    const filters = [where('workspaceId', '==', workspaceId), ...(transactionId ? [where('transactionId', '==', transactionId)] : [])];
    const q = query(collection(db, 'clientQueries'), ...filters, limit(500));
    const show = (docs: Array<{ id: string; data: () => unknown }>) =>
      setQueries(sortQueries(docs.map(d => ({ ...(d.data() as Omit<ClientQuery, 'id'>), id: d.id }))));
    if (transactionId) {
      let live = true;
      getDocs(q).then(snap => { if (live) { show(snap.docs); setLoading(false); } })
        .catch(() => { if (live) { setFailed(true); setLoading(false); } });
      return () => { live = false; };
    }
    return onSnapshot(q, snap => { show(snap.docs); setLoading(false); }, () => { setFailed(true); setLoading(false); });
  }, [workspaceId, transactionId, round]);

  return { queries, loading, failed, reload };
}
