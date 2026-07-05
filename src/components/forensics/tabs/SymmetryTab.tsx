import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatCurrency } from '../../../lib/utils';

interface SymmetryTabProps {
  symmetryData: any[];
  expandedSymmetryTxId: string | null;
  setExpandedSymmetryTxId: (id: string | null) => void;
}

export default function SymmetryTab({
  symmetryData,
  expandedSymmetryTxId,
  setExpandedSymmetryTxId,
}: SymmetryTabProps) {
  return (
    <motion.div
      key="symmetry-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-10 animate-fade-in"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 gap-4 text-left">
        <div>
          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Double-entry symmetry validation report</h4>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 opacity-65">Real-time check matching bilateral transaction legs (Debits equivalent to Credits)</p>
        </div>
      </div>

      <div className="space-y-6 text-left">
        <div className="flex items-center justify-between">
          <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Integrated Transaction Checks</h5>
          <span className="text-xs font-bold text-slate-500 font-mono italic">Expand a node to inspect credit split distributions</span>
        </div>

        <div className="border border-slate-200 rounded-[32px] overflow-hidden bg-white shadow-xl max-w-full overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[650px]" id="symmetry-ledger-table">
            <thead>
              <tr className="bg-slate-900 border-b border-transparent text-[9px] uppercase tracking-widest text-white font-black font-mono">
                <th className="p-5">Transaction Checkpoint ID</th>
                <th className="p-5">Debit Ledger Sum</th>
                <th className="p-5">Credit Ledger Sum</th>
                <th className="p-5 text-right">Symmetry Gap Deficit</th>
                <th className="p-5 text-center">Security Status Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ledger-line font-medium text-slate-900">
              {symmetryData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-500 text-[11px] font-mono uppercase tracking-widest">
                    Zero double-entry transactions active to validate list integrity.
                  </td>
                </tr>
              ) : (
                symmetryData.slice(0, 200).map((tx) => (
                  <React.Fragment key={tx.id}>
                    <tr 
                      onClick={() => setExpandedSymmetryTxId(expandedSymmetryTxId === tx.id ? null : tx.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          {expandedSymmetryTxId === tx.id ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                          <div>
                            <span className="font-extrabold uppercase tracking-tight text-slate-800 text-[11px]">{tx.desc}</span>
                            <span className="text-[9px] text-slate-500 font-mono mt-1 block uppercase">{(tx.id || 'xxxxxx').substring(0, 16).toUpperCase()} • {tx.date}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 font-mono font-bold">{formatCurrency(tx.debitSum)}</td>
                      <td className="p-5 font-mono font-bold">{formatCurrency(tx.creditSum)}</td>
                      <td className={cn(
                        "p-5 text-right font-mono font-extrabold",
                        tx.balanced ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {formatCurrency(tx.delta)}
                      </td>
                      <td className="p-5">
                        <div className="flex items-center justify-center">
                          {tx.balanced ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                              <ShieldCheck size={11} className="text-emerald-600" /> SYMMETRY VALID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
                              <AlertCircle size={11} className="text-rose-600 animate-pulse" /> IMBALANCED DELTA
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Folded Debit vs Credit allocations split screen */}
                    {expandedSymmetryTxId === tx.id && (
                      <tr>
                        <td colSpan={5} className="bg-slate-50 p-6">
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
                          >
                            {/* Dr Side */}
                            <div className="p-5 bg-white border border-slate-200 rounded-[32px] text-left space-y-4 shadow-sm">
                              <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2">
                                <span className="font-black text-slate-700 uppercase tracking-wider text-[10px]">Debit Ledger side (Dr)</span>
                                <span className="text-emerald-600 font-mono text-[10px] font-black">{formatCurrency(tx.debitSum)}</span>
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {tx.lines.filter((l: any) => l.amountCents > 0).map((line: any, lIdx: number) => (
                                  <div key={lIdx} className="flex justify-between items-center text-xs p-1 font-mono">
                                    <span className="text-slate-600 font-semibold">{line.accountName}</span>
                                    <span className="text-slate-800 font-black">{formatCurrency(line.amountCents)}</span>
                                  </div>
                                ))}
                                {tx.lines.filter((l: any) => l.amountCents > 0).length === 0 && (
                                  <p className="text-[10px] text-slate-400 uppercase font-mono italic">Zero Debit allocations detected</p>
                                )}
                              </div>
                            </div>

                            {/* Cr Side */}
                            <div className="p-5 bg-white border border-slate-200 rounded-[32px] text-left space-y-4 shadow-sm">
                              <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2">
                                <span className="font-black text-slate-700 uppercase tracking-wider text-[10px]">Credit Ledger side (Cr)</span>
                                <span className="text-emerald-600 font-mono text-[10px] font-black">{formatCurrency(tx.creditSum)}</span>
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {tx.lines.filter((l: any) => l.amountCents < 0).map((line: any, lIdx: number) => (
                                  <div key={lIdx} className="flex justify-between items-center text-xs p-1 font-mono">
                                    <span className="text-slate-600 font-semibold">{line.accountName}</span>
                                    <span className="text-slate-800 font-black">{formatCurrency(Math.abs(line.amountCents))}</span>
                                  </div>
                                ))}
                                {tx.lines.filter((l: any) => l.amountCents < 0).length === 0 && (
                                  <p className="text-[10px] text-slate-400 uppercase font-mono italic">Zero Credit allocations detected</p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
              {symmetryData.length > 200 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-50">
                    Showing first 200 checks (out of {symmetryData.length} records total)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
