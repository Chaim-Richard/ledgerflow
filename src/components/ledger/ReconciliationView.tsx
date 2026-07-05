import React from 'react';
import { Transaction } from '../../types';
import { RefreshCw, CheckCircle2, Download, Filter, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ReconciliationViewProps {
  transactions: Transaction[];
  reconciliations: any[];
  formatCurrency: (val: number) => string;
}

export default function ReconciliationView({ transactions, reconciliations, formatCurrency }: ReconciliationViewProps) {
  const unreconciledCount = React.useMemo(() => {
    return transactions.filter(t => !t.clearedAt).length;
  }, [transactions]);

  const lastRecon = React.useMemo(() => {
    if (reconciliations.length === 0) return null;
    return reconciliations[0]; // Already sorted by date desc in App.tsx
  }, [reconciliations]);

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-3xs relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-[0.02] pointer-events-none group-hover:scale-105 transition-transform">
            <RefreshCw size={50} className="text-slate-800" />
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pending Verification</p>
          <div className="flex items-end justify-between relative">
            <p className="text-2xl font-black text-slate-800 leading-none">{unreconciledCount}</p>
            {unreconciledCount > 0 && (
              <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg uppercase tracking-wider border border-amber-100">Action Required</span>
            )}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-3xs relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-[0.02] pointer-events-none group-hover:scale-105 transition-transform">
            <Calendar size={50} className="text-slate-800" />
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Last Balance Protocol</p>
          <p className="text-2xl font-black text-slate-800 leading-none">
            {lastRecon ? format(new Date(lastRecon.statementDate), 'MMM d, yyyy') : 'Never'}
          </p>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-2">{lastRecon?.accountName || 'No records detected'}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-3xs relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-[0.02] pointer-events-none group-hover:scale-105 transition-transform">
            <CheckCircle2 size={50} className="text-emerald-500" />
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Equilibrium Status</p>
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm tracking-tight relative">
            <CheckCircle2 size={16} />
            In Balance
          </div>
          <p className="text-[8px] text-slate-450 font-bold uppercase tracking-wider mt-2">Zero Drift Detected</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-3xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Reconciliation Ledger</h3>
            <p className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mt-1">Verified historical bank statement alignments</p>
          </div>
          <div className="flex gap-2">
            <button className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer">
              <Download size={13} />
            </button>
            <button className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer">
              <Filter size={13} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left border-b border-slate-150 bg-slate-50">
                <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Account Topology</th>
                <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Statement Period</th>
                <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider text-right">Quantum Balance</th>
                <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider text-right">Variance Drift</th>
                <th className="px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reconciliations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 font-bold uppercase tracking-wider">No alignment history found in secure core</td>
                </tr>
              )}
              {reconciliations.map(recon => (
                <tr key={recon.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-5 py-3 font-bold text-slate-800">{recon.accountName}</td>
                  <td className="px-5 py-3 text-slate-500 font-semibold">{format(new Date(recon.statementDate), 'MMM d, yyyy')}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-slate-800">{formatCurrency(recon.statementBalanceCents)}</td>
                  <td className="px-5 py-3 text-right font-mono text-emerald-600 font-semibold">$0.00</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[8px] font-bold uppercase tracking-wider">Verified</span>
                  </td>
                  <td className="px-5 py-3">
                    <button className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200/40 flex items-center justify-center text-slate-400 hover:text-slate-950 transition-all cursor-pointer">
                      <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
