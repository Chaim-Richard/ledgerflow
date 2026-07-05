import { useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useLedgerStore } from "../stores/useLedgerStore";
import { useAuthStore } from "../stores/useAuthStore";

export function useSnapshotBridge() {
  const { currentWorkspaceId, user } = useAuthStore();
  const balances = useLedgerStore(state => state.runningBalances);
  const hasTransactions = useLedgerStore(state => state.transactions.length > 0);

  // 1. Save data bridge snapshot debounced
  useEffect(() => {
    if (!currentWorkspaceId || !user || !hasTransactions) return;
    
    const timeoutId = setTimeout(() => {
      const snapDoc = doc(db, "ledgerSnapshots", currentWorkspaceId);
      // We only save the top-level big math totals
      setDoc(snapDoc, {
        totalIncome: balances.totalIncome.toString(),
        totalExpense: balances.totalExpense.toString(),
        totalBalance: balances.totalBalance.toString(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(console.error);
    }, 10000); // 10 second debounce to minimize writes

    return () => clearTimeout(timeoutId);
  }, [balances.totalBalance, currentWorkspaceId, user]);

  return { bridgeLoaded: hasTransactions };
}

export async function fetchSnapshotBridge(workspaceId: string) {
  if (!workspaceId) return null;
  const snapDoc = doc(db, "ledgerSnapshots", workspaceId);
  try {
    const snap = await getDoc(snapDoc);
    if (snap.exists()) {
      return snap.data();
    }
  } catch(e) {
    console.warn("Bridge missing:", e);
  }
  return null;
}
