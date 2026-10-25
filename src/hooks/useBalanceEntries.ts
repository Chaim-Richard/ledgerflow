import { useMemo } from 'react';
import { useLedgerStore } from '../stores/useLedgerStore';
import { foldServerOpening, opensFromServer } from '../lib/serverBalances';
import type { Transaction } from '../types';

/**
 * L-123 step 3c: `transactions` with the server's balances through the oldest loaded day folded in
 * (src/lib/serverBalances.ts balanceEntries), for a balance as of `asOfDate`. Also says whether it was folded in.
 */
export function useBalanceEntries(transactions: Transaction[], asOfDate?: string, workspaceId?: string): { entries: Transaction[]; serverAsOf: string } {
  const opening = useLedgerStore(s => s.serverOpening);
  return useMemo(() => {
    const list = transactions || [];
    return opensFromServer(list, opening, asOfDate, workspaceId) ? { entries: foldServerOpening(list, opening), serverAsOf: opening.asOf } : { entries: list, serverAsOf: '' };
  }, [transactions, opening, asOfDate, workspaceId]);
}
