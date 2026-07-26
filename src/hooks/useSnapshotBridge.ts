import { useEffect } from "react";
import { repository } from "../services/repository";
import { useLedgerStore } from "../stores/useLedgerStore";
import { useAuthStore } from "../stores/useAuthStore";

export function useSnapshotBridge() {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const user = useAuthStore(s => s.user);
  const balances = useLedgerStore(state => state.runningBalances);
  const hasTransactions = useLedgerStore(state => state.transactions.length > 0);

  // 1. Save data bridge snapshot debounced
  useEffect(() => {
    if (!currentWorkspaceId || !user || !hasTransactions) return;
    
    const timeoutId = setTimeout(() => {
      
      // We only save the top-level big math totals
      repository.createDoc("ledgerSnapshots", {
        totalIncome: balances.totalIncome.toString(),
        totalExpense: balances.totalExpense.toString(),
        totalBalance: balances.totalBalance.toString(),
        updatedAt: new Date().toISOString(), uid: user.uid, workspaceId: currentWorkspaceId
      }, currentWorkspaceId).catch(console.error);
    }, 10000); // 10 second debounce to minimize writes

    return () => clearTimeout(timeoutId);
  }, [balances.totalBalance, currentWorkspaceId, user]);

  return { bridgeLoaded: hasTransactions };
}

export async function fetchSnapshotBridge(workspaceId: string) {
  if (!workspaceId) return null;
  try {
    const data = await repository.getDoc("ledgerSnapshots", workspaceId);
    if (data) {
      return data;
    }
  } catch(e) {
    console.warn("Bridge missing:", e);
  }
  return null;
}
