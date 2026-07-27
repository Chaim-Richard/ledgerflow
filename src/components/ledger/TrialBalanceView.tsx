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

import { Download } from "lucide-react";
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

  
  const handleExportCSV = () => {
    const headers = ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit'];
    const rows = trialBalance.lines.map(line => [
      line.id,
      line.name,
      line.type,
      (line.debit / 100).toFixed(2),
      (line.credit / 100).toFixed(2)
    ]);
    rows.push(['TOTAL', '', '', (trialBalance.totalDebits / 100).toFixed(2), (trialBalance.totalCredits / 100).toFixed(2)]);
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trial_balance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/80 shadow-3xs overflow-hidden relative group">
      <div className="absolute technical-grid inset-0 opacity-[0.015] pointer-events-none" />
      
      <div className="p-5 border-b border-[var(--line)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate mb-1">
             <Scale size={12} className="shrink-0" />
             Stability Verification Protocol
          </div>
          <h3 className="text-xl font-bold text-[var(--text)] tracking-tight">Trial Balance</h3>
          <p className="text-[10px] font-semibold text-slate-400 uppercase mt-1">
            ENDING: {format(new Date(), 'yyyy-MM-dd')} • Check: {trialBalance.isBalanced ? 'PASS' : 'FAIL'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Debits</p>
            <p className="text-base font-bold font-mono text-[var(--text)]">{formatCurrency(trialBalance.totalDebits)}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Credits</p>
            <p className="text-base font-bold font-mono text-[var(--text)]">{formatCurrency(trialBalance.totalCredits)}</p>
          </div>
          <motion.div 
            animate={trialBalance.isBalanced ? {} : { x: [0, -4, 4, -4, 4, 0] }}
            className={cn(
              "px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider border shadow-3xs transition-all w-full sm:w-auto",
              trialBalance.isBalanced 
                ? "bg-emerald-500 text-white border-emerald-400" 
                : "bg-rose-500 text-white border-rose-400"
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
            <tr className="bg-slate-900 text-white whitespace-nowrap">
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
                     <span className="font-mono text-[9px] font-bold text-slate-400 bg-[var(--ink)] px-1.5 py-0.5 rounded border border-[var(--line)]">{line.code}</span>
                     <div>
                       <p className="text-xs font-bold text-[var(--text)] group-hover/row:text-[var(--brass)] transition-colors uppercase">{line.name}</p>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{line.type} Classification</p>
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
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] rounded-lg text-[9px] font-bold uppercase tracking-wider hover:text-[var(--text)] transition-all cursor-pointer">
              <Download size={12} /> Export CSV
            </button>
                   <Activity size={14} className="text-slate-500 shrink-0" />
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
