import React from 'react';
import { calculateSafeToSpend } from '../../lib/algorithms/tax-set-aside';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { ShieldCheck, ArrowDownToLine, Landmark } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export function TaxReserveWidget() {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  
  // Calculate
  const { estimatedTax, safeToSpend, rawCash } = calculateSafeToSpend(transactions, accounts, 0.30); // 30% flat tax assumption

  return (
    <div className="bg-[var(--panel)] border border-[var(--brass-line)]/50 rounded-2xl p-5 relative overflow-hidden shadow-sm bg-gradient-to-r from-[var(--brass-soft)]/20 via-[var(--panel)] to-[var(--panel)]">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-[var(--brass)]/50 via-[var(--brass-line)]/30 to-transparent" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-sm text-[var(--text)]">Tax & Liquidity Shield</h3>
          <p className="font-mono text-[11px] text-[var(--faint)]">algorithm: tax-set-aside · 30% rate</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 flex items-center justify-center text-[var(--brass)] shadow-xs">
          <Landmark size={16} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--surface)]/80 border border-[var(--line)] rounded-xl flex flex-col justify-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-1">Gross Cash</p>
          <p className="font-mono text-xl font-bold text-[var(--text)]">{formatCurrency(rawCash)}</p>
        </div>
        
        <div className="p-4 bg-[var(--surface)]/80 border border-[var(--neg)]/30 rounded-xl flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <ArrowDownToLine className="w-16 h-16 text-[var(--neg)]" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-1 flex items-center gap-1.5">
            Est. Tax Reserve
          </p>
          <p className="font-mono text-xl font-bold text-[var(--neg)]">{formatCurrency(estimatedTax)}</p>
        </div>
        
        <div className="p-4 bg-gradient-to-br from-[var(--brass-soft)] via-[var(--brass-soft)]/30 to-[var(--surface)] border border-[var(--brass-line)] rounded-xl flex flex-col justify-center relative shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--brass)] font-bold mb-1">Safe to Spend</p>
          <p className="font-mono text-xl font-bold text-[var(--text)]">{formatCurrency(safeToSpend)}</p>
        </div>
      </div>
    </div>
  );
}
