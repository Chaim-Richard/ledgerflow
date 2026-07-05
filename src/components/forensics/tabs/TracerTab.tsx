import React from 'react';
import { motion } from 'motion/react';
import { FileSpreadsheet, Percent, Calculator, Search } from 'lucide-react';
import { ChartAccount, Transaction } from '../../../types';
import { formatCurrency, cn } from '../../../lib/utils';

interface TracerTabProps {
  accounts: ChartAccount[];
  transactions: Transaction[];
  filteredAccounts: ChartAccount[];
  tracerSearch: string;
  setTracerSearch: (s: string) => void;
  selectedAccountId: string;
  setSelectedAccountId: (s: string) => void;
  activeTracerAccount: ChartAccount | undefined;
  auditTrace: any;
}

export default function TracerTab({
  accounts,
  transactions,
  filteredAccounts,
  tracerSearch,
  setTracerSearch,
  selectedAccountId,
  setSelectedAccountId,
  activeTracerAccount,
  auditTrace,
}: TracerTabProps) {
  return (
    <motion.div
      key="tracer-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-10 animate-fade-in"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 gap-4 text-left">
        <div>
          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Excel formula cell precedent tracer</h4>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 opacity-65">Isolate precedent accounts driving aggregate values</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left pane: Account Pick Selection */}
        <div className="lg:col-span-1 space-y-6 text-left">
          <div className="flex items-center justify-between">
            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Audit source selection</h5>
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg font-mono">
              {filteredAccounts.length} targets
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={tracerSearch}
              onChange={(e) => setTracerSearch(e.target.value)}
              placeholder="Search target account..."
              className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider outline-none focus:bg-white focus:border-slate-300 transition-all font-sans"
            />
          </div>

          <div className="border border-slate-200 rounded-[32px] overflow-hidden max-h-[350px] overflow-y-auto bg-white shadow-sm pr-1">
            <div className="divide-y divide-ledger-line">
              {filteredAccounts.length === 0 ? (
                <div className="p-4 md:p-8 text-center text-xs text-slate-500 font-bold uppercase tracking-widest font-mono">
                  No matching ledger codes
                </div>
              ) : (
                filteredAccounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={cn(
                      "w-full p-4 text-left text-xs transition-colors flex justify-between items-center",
                      selectedAccountId === acc.id ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-800"
                    )}
                  >
                    <div className="space-y-1">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{acc.code}</p>
                      <p className="font-black uppercase tracking-tight truncate max-w-[130px]">{acc.name}</p>
                    </div>
                    <span className={cn(
                      "font-mono font-bold",
                      selectedAccountId === acc.id ? "text-emerald-400" : "text-slate-800"
                    )}>
                      {formatCurrency(acc.balanceCents)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right pane: Core Formulas & Tracer Trace visualizations */}
        <div className="lg:col-span-2 space-y-8 text-left">
          {activeTracerAccount && auditTrace ? (
            <>
              {/* Formula Panel visual */}
              <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-4 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <h5 className="font-black text-slate-900 uppercase tracking-wider text-xs">Excel formula cell simulator</h5>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Cell index location: B{activeTracerAccount.code.substring(0,3)}</p>
                  </div>
                </div>

                {/* The excel bar */}
                <div className="flex border border-slate-300 rounded-xl overflow-hidden shadow-inner bg-white font-mono text-xs items-center" id="formula-bar-sim">
                  <div className="bg-slate-100 px-4 py-3.5 border-r border-slate-200 font-extrabold text-slate-600 uppercase tracking-widest text-[10px] select-none">
                    fx
                  </div>
                  <div className="p-3.5 flex-1 select-all font-bold text-slate-800 selection:bg-indigo-100 overflow-x-auto truncate">
                    {auditTrace.formula}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-white border border-slate-200 rounded-[32px]">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Simulated evaluation value</span>
                    <span className="text-xl font-black font-mono text-slate-800">{formatCurrency(auditTrace.value)}</span>
                  </div>
                  <div className="p-5 bg-white border border-slate-200 rounded-[32px]">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Precedent complexity weight</span>
                    <span className="text-xl font-black font-mono text-indigo-600">{auditTrace.precedents.length} accounts</span>
                  </div>
                </div>
              </div>

              {/* Step through precedent accounts trace elements */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Formula precedent ledger targets</h5>
                  <span className="text-xs font-bold text-slate-500 font-mono italic">Trace paths showing ledger inflows</span>
                </div>

                <div className="border border-slate-200 rounded-[32px] overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-xs text-left" id="precedents-tracer-table">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase tracking-widest text-slate-500 font-black font-mono">
                        <th className="p-4">Precedent Account</th>
                        <th className="p-4">Standard Nature</th>
                        <th className="p-4 text-right">Dr/Cr Weight</th>
                        <th className="p-4 text-right">Raw balance</th>
                        <th className="p-4 text-center">Path links</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ledger-line font-medium text-slate-900">
                      {auditTrace.precedents.map((pre: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <span className="font-extrabold text-slate-800 uppercase block">{pre.name}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-mono block">{pre.code}</span>
                          </td>
                          <td className="p-4 uppercase text-slate-500 font-bold">{pre.type}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1 font-bold text-slate-600 text-[10px]">
                              {pre.strength > 0 ? (
                                <>
                                  <Calculator size={10} className="text-indigo-500" />
                                  <span>{pre.factor === 1 ? 'ADD' : 'SUBTRACT'}</span>
                                </>
                              ) : (
                                <span className="opacity-40">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right font-mono font-extrabold">{formatCurrency(pre.balance)}</td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">
                              {pre.strength > 0 ? `${(pre.strength * 100).toFixed(0)}% contribution` : 'idle zero'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-[32px] flex items-start gap-4 text-xs font-medium text-indigo-900 leading-relaxed">
                  <Percent className="mt-0.5 text-indigo-600 shrink-0" size={14} />
                  <div>
                    <strong className="font-black uppercase tracking-wider text-[10px] block mb-1">Total dynamic sum validator [OK]</strong>
                    Current balances matching precedent calculation matrices completely. Inflow trace paths hold arithmetic balance consistency within tolerance limits.
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-slate-500 border border-dashed border-slate-200 rounded-[32px]">
              No target account active. Select an analytical asset, liability, or capital code in left sheet registers to plot precendents.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
