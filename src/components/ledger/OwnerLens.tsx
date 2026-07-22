import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { ArrowUpRight, ArrowDownRight, Wallet, ArrowRight, Compass, Sparkles } from 'lucide-react';
import { explainNetProfit } from '../../lib/algorithms/number-explainer';

export default function OwnerLens() {
  const transactions = useLedgerStore(s => s.transactions);
  const [showAllActivity, setShowAllActivity] = React.useState(false);

  const stats = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;
    
    transactions.forEach(t => {
      if (t.totalAmountCents > 0) moneyIn += t.totalAmountCents;
      else moneyOut += Math.abs(t.totalAmountCents);
    });
    
    const left = moneyIn - moneyOut;
    return { moneyIn, moneyOut, left };
  }, [transactions]);

  const monthStr = new Date().toISOString().slice(0, 7);
  const explainer = useMemo(() => explainNetProfit(transactions, monthStr), [transactions, monthStr]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6 px-2 sm:px-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-[var(--brass)] opacity-10 rounded-full blur-3xl hidden md:block pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 text-[10px] font-mono text-[var(--brass)] font-semibold mb-2 shadow-xs">
              <Compass size={12} />
              EXECUTIVE SUMMARY
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">Plain English Books</h1>
            <p className="text-xs text-[var(--muted)] font-medium mt-1">No debits or credits. Just clean, immediate clarity on your bottom line.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--pos)]/50 rounded-2xl shadow-sm p-6 bg-gradient-to-b from-[var(--brass-soft)]/20 via-[var(--panel)] to-[var(--panel)] transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[var(--pos)] font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              Money In
            </h3>
            <span className="w-2 h-2 rounded-full bg-[var(--pos)] animate-pulse" />
          </div>
          <p className="text-3xl sm:text-4xl font-mono font-bold text-[var(--text)] tracking-tight">${(stats.moneyIn / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
          <p className="text-[11px] font-mono text-[var(--muted)] mt-2">Verified Revenue Collected</p>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--neg)]/50 rounded-2xl shadow-sm p-6 bg-gradient-to-b from-[var(--brass-soft)]/20 via-[var(--panel)] to-[var(--panel)] transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[var(--neg)] font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownRight className="w-4 h-4" />
              Money Out
            </h3>
            <span className="w-2 h-2 rounded-full bg-[var(--neg)]" />
          </div>
          <p className="text-3xl sm:text-4xl font-mono font-bold text-[var(--text)] tracking-tight">${(stats.moneyOut / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
          <p className="text-[11px] font-mono text-[var(--muted)] mt-2">Operating Expenditures</p>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--brass-line)] rounded-2xl shadow-sm p-6 bg-gradient-to-b from-[var(--brass-soft)] via-[var(--brass-soft)]/30 to-[var(--panel)] transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[var(--brass)] font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-[var(--brass)]" />
              Net Capital Remaining
            </h3>
            <span className="w-2 h-2 rounded-full bg-[var(--brass)] shadow-[0_0_8px_var(--brass)]" />
          </div>
          <p className="text-3xl sm:text-4xl font-mono font-bold text-[var(--text)] tracking-tight">${(stats.left / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
          <p className="text-[11px] font-mono text-[var(--muted)] mt-2">Unencumbered Liquidity</p>
        </div>
      </div>

      <div className="bg-[var(--panel)] border border-[var(--brass-line)]/80 rounded-2xl shadow-sm p-6 relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)]/30 via-[var(--panel)] to-[var(--panel)]">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--brass)] uppercase tracking-wider mb-2">
          <Sparkles size={14} />
          Explain This Month's Performance
        </div>
        <p className="text-xl sm:text-2xl font-medium text-[var(--text)] leading-relaxed">
          {explainer.sentence}
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--text)] tracking-tight">Recent Activity Stream</h3>
          {transactions.length > 5 && (
            <button 
              onClick={() => setShowAllActivity(!showAllActivity)}
              className="text-xs font-mono font-semibold text-[var(--brass)] hover:underline transition-colors cursor-pointer"
            >
              {showAllActivity ? 'Show Top 5' : `View All (${transactions.length})`}
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {transactions.length === 0 ? (
            <div className="p-8 text-center bg-[var(--panel)] border border-[var(--line)] rounded-2xl text-[var(--muted)] text-sm font-mono">
              No transactions recorded yet in this workspace.
            </div>
          ) : (
            (showAllActivity ? transactions : transactions.slice(0, 5)).map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--brass-line)]/60 rounded-xl shadow-xs transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${t.totalAmountCents > 0 ? 'bg-[var(--brass-soft)] border-[var(--brass-line)] text-[var(--pos)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)]'}`}>
                    {t.totalAmountCents > 0 ? <ArrowUpRight className="w-5 h-5 text-[var(--pos)]" /> : <ArrowRight className="w-5 h-5 text-[var(--muted)]" />}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--text)] text-sm">{t.payee || t.description}</p>
                    <p className="text-xs font-mono text-[var(--muted)]">{t.date}</p>
                  </div>
                </div>
                <p className={`font-mono font-bold text-base ${t.totalAmountCents > 0 ? 'text-[var(--pos)]' : 'text-[var(--text)]'}`}>
                  {t.totalAmountCents > 0 ? '+' : ''}${(t.totalAmountCents / 100).toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

