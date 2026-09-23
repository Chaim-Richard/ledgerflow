import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { isPostable, lineAmount } from '../../lib/txFilters';

export default function StatusBar() {
  const isOnline = useUIStore(s => s.isOnline);
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const workspaces = useAuthStore(s => s.workspaces);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  const isBalanced = useMemo(() => {
    let imbalance = 0;
    for (const tx of transactions) {
      if (!isPostable(tx)) continue;
      if (Array.isArray(tx.lines)) {
        for (const line of tx.lines) {
          imbalance += lineAmount(line, tx);
        }
      }
    }
    return Math.abs(imbalance) === 0;
  }, [transactions]);

  return (
    <div className="hidden md:flex h-8 bg-[var(--surface)] border-t border-[var(--line)] items-center justify-between px-6 overflow-hidden text-[var(--faint)] font-mono text-[10.5px] relative select-none shrink-0 z-50">
      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOnline ? "bg-[var(--pos)]" : "bg-[var(--faint)]"
            )} 
          />
          <span className="font-semibold uppercase tracking-wider leading-none text-[var(--muted)]">
            {isOnline ? "ledgerflow ONLINE" : "OFFLINE MODE"}
          </span>
        </div>
        <span className="text-[var(--brass)]">·</span>
        <span>{accounts.length} Accounts · {transactions.length} Transactions</span>
      </div>

      <div className="flex items-center gap-4 text-[var(--faint)]">
        <span>Base Currency: {currentWorkspace?.currency || 'USD'}</span>
        <span className="text-[var(--brass)]">·</span>
        {isBalanced ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Double-Entry Balanced</span>
        ) : (
          <span className="text-amber-600 dark:text-amber-400 font-semibold">Out of balance</span>
        )}
      </div>
    </div>
  );
}
