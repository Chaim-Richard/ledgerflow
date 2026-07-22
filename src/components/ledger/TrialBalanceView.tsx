import React from 'react';
import { ChartAccount } from '../../types';
import { format } from 'date-fns';
import { Scale, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface TrialBalanceViewProps {
  accounts: ChartAccount[];
  formatCurrency: (val: number) => string;
  onDrillDown: (accountId: string) => void;
}

export default function TrialBalanceView({ accounts, formatCurrency, onDrillDown }: TrialBalanceViewProps) {
  const trialBalance = React.useMemo(() => {
    let totalDebits = 0;
    let totalCredits = 0;
    
    const lines = accounts.map(acc => {
      const isDebitNature = ['asset', 'expense'].includes(acc.type);
      let debit = 0;
      let credit = 0;
      
      if (isDebitNature) {
        if (acc.balanceCents >= 0) debit = acc.balanceCents;
        else credit = Math.abs(acc.balanceCents);
      } else {
        if (acc.balanceCents >= 0) credit = acc.balanceCents;
        else debit = Math.abs(acc.balanceCents);
      }
      
      totalDebits += debit;
      totalCredits += credit;
      return { ...acc, debit, credit };
    });

    return { lines, totalDebits, totalCredits, isBalanced: Math.abs(totalDebits - totalCredits) < 0.01 };
  }, [accounts]);

  return (
    <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden relative group">
      <div className="absolute technical-grid inset-0 opacity-[0.015] pointer-events-none" />
      
      <div className="p-5 border-b border-[var(--line)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--faint)] uppercase tracking-widest truncate mb-1">
             <Scale size={12} className="shrink-0" />
             Stability Verification Protocol
          </div>
          <h3 className="text-xl font-bold text-[var(--text)] tracking-tight">Trial Balance</h3>
          <p className="text-[10px] font-semibold text-[var(--faint)] uppercase mt-1">
            ENDING: {format(new Date(), 'yyyy-MM-dd')} • Check: {trialBalance.isBalanced ? 'PASS' : 'FAIL'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-bold text-[var(--faint)] uppercase tracking-wider mb-0.5">Debits</p>
            <p className="text-base font-bold font-mono text-[var(--text)]">{formatCurrency(trialBalance.totalDebits)}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-bold text-[var(--faint)] uppercase tracking-wider mb-0.5">Credits</p>
            <p className="text-base font-bold font-mono text-[var(--text)]">{formatCurrency(trialBalance.totalCredits)}</p>
          </div>
          <motion.div 
            animate={trialBalance.isBalanced ? {} : { x: [0, -4, 4, -4, 4, 0] }}
            className={cn(
              "px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider border shadow-sm transition-all w-full sm:w-auto",
              trialBalance.isBalanced 
                ? "bg-emerald-500 text-[var(--panel)] border-emerald-400" 
                : "bg-rose-500 text-[var(--panel)] border-rose-400"
            )}
          >
            {trialBalance.isBalanced ? <CheckCircle2 size={12} className="shrink-0" /> : <AlertCircle size={12} className="shrink-0" />}
            {trialBalance.isBalanced ? "Balanced" : "System Imbalance"}
          </motion.div>
        </div>
      </div>

      <div className="overflow-x-auto relative z-10 custom-scrollbar">
        <table className="w-full text-left min-w-[700px] text-xs">
          <thead>
            <tr className="bg-[var(--ink)] text-[var(--panel)] whitespace-nowrap">
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider">Core Identifier</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-right">Debit Matrix</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-right">Credit Matrix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trialBalance.lines.map((line) => (
              <motion.tr 
                key={line.id} 
                whileHover={{ backgroundColor: "var(--ink)" }}
                onClick={() => onDrillDown(line.id)}
                className="group/row cursor-pointer transition-colors"
              >
                <td className="px-5 py-3">
                   <div className="flex items-center gap-3">
                     <span className="font-mono text-[9px] font-bold text-[var(--faint)] bg-[var(--ink)] px-1.5 py-0.5 rounded border border-[var(--line)]">{line.code}</span>
                     <div>
                       <p className="text-xs font-bold text-[var(--text)] group-hover/row:text-[var(--brass)] transition-colors uppercase">{line.name}</p>
                       <p className="text-[8px] font-bold text-[var(--faint)] uppercase tracking-wider">{line.type} Classification</p>
                     </div>
                   </div>
                </td>
                <td className="px-5 py-3 text-right font-mono text-[var(--text)] font-bold">
                  {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                </td>
                <td className="px-5 py-3 text-right font-mono text-[var(--text)] font-bold">
                  {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                </td>
              </motion.tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-250">
            <tr className="bg-[var(--ink)]/50 whitespace-nowrap">
              <td className="px-5 py-3.5">
                 <div className="flex items-center gap-2">
                   <Activity size={14} className="text-[var(--muted)] shrink-0" />
                   <span className="text-sm font-bold text-[var(--text)] uppercase">Total</span>
                 </div>
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-sm font-bold text-[var(--text)]">{formatCurrency(trialBalance.totalDebits)}</td>
              <td className="px-5 py-3.5 text-right font-mono text-sm font-bold text-[var(--text)]">{formatCurrency(trialBalance.totalCredits)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
