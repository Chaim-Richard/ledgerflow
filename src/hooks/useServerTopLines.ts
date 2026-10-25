import { useEffect, useMemo, useState } from 'react';
import { getIdToken } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { workspaceScope } from '../lib/serverAction';
import { openingCutoff } from '../lib/serverBalances';
import { computeTopExpensesAndIncome } from '../lib/reportGenerators';
import { linesNeedServer, rangeRevision, type ServerTopLines, type TopLines } from '../lib/serverTopLines';

/**
 * L-123 step 4a: the largest single expense and income lines over `from`…`to` (src/lib/serverTopLines.ts). When the
 * loaded list is capped and the range reaches the oldest loaded day, lines may be missing from it, so the whole list
 * comes from the server (GET /api/v1/balances/top-lines). Otherwise, and until it answers or when it cannot be reached,
 * the loaded entries' list, as before. `source` says which, so the screen can say so.
 */
export function useServerTopLines(from: string | undefined, to: string | undefined, limit: number): TopLines & { source: 'loaded' | 'server' | 'loaded-incomplete' } {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const capped = useLedgerStore(s => Boolean(s.truncatedCollections?.transactions));
  const workspaceId = useAuthStore(s => s.currentWorkspaceId) || '';
  const cutoff = useMemo(() => openingCutoff(transactions || []), [transactions]);
  const incomplete = linesNeedServer(capped, cutoff, from);
  const needed = incomplete && !!workspaceId && !!from && !!to && from <= to;
  // any loaded entry dated from `from` on can change the server's list (a reversal dated after the range too)
  const revision = useMemo(() => (needed ? rangeRevision(transactions || [], from!) : ''), [needed, transactions, from]);
  const key = needed ? `${workspaceId}|${from}|${to}|${limit}|${(transactions || []).length}|${revision}` : '';
  const [answer, setAnswer] = useState<{ key: string; server: ServerTopLines | null } | null>(null);

  useEffect(() => {
    if (!key || !from || !to) return;
    const scope = workspaceScope(() => useAuthStore.getState().currentWorkspaceId);
    let live = true;
    (async () => {
      const query = new URLSearchParams({ workspaceId, from, to, limit: String(limit) }).toString();
      const res = await fetch(`/api/v1/balances/top-lines?${query}`, { headers: { Authorization: `Bearer ${await getIdToken()}` } });
      const body = await res.json().catch(() => ({})) as Partial<TopLines>;
      if (!res.ok || !Array.isArray(body.topExpenses) || !Array.isArray(body.topIncome)) throw new Error(`top lines ${res.status}`);
      return { workspaceId, from, to, limit, topExpenses: body.topExpenses, topIncome: body.topIncome };
    })().then(server => {
      if (live && scope.isCurrent()) setAnswer({ key, server });
    }).catch(() => {
      // best-effort: without the server's answer the screen keeps the loaded entries' list and says it may be short
      if (live && scope.isCurrent()) setAnswer({ key, server: null });
    });
    return () => { live = false; };
  }, [key, workspaceId, from, to, limit]);

  const server = key && answer?.key === key ? answer.server : null;
  return useMemo(() => {
    if (server && server.workspaceId === workspaceId) return { topExpenses: server.topExpenses, topIncome: server.topIncome, source: 'server' as const };
    const own = computeTopExpensesAndIncome(accounts, transactions, limit, from, to);
    return { ...own, source: incomplete ? 'loaded-incomplete' as const : 'loaded' as const };
  }, [server, workspaceId, accounts, transactions, limit, from, to, incomplete]);
}
