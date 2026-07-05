import React from 'react';
import { motion } from 'motion/react';
import { Building2, ShieldCheck, AlertCircle } from 'lucide-react';
import { ChartAccount } from '../../../types';
import { cn, formatCurrency } from '../../../lib/utils';

interface CashReconcilerTabProps {
  cashAccounts: ChartAccount[];
  selectedCashAccountId: string;
  setSelectedCashAccountId: (id: string) => void;
  activeCashAccount: ChartAccount | undefined;
  cashReconData: any;
  handleClearTransaction: (id: string, s: boolean) => void;
}

export default function CashReconcilerTab({
  cashAccounts,
  selectedCashAccountId,
  setSelectedCashAccountId,
  activeCashAccount,
  cashReconData,
  handleClearTransaction,
}: CashReconcilerTabProps) {
  return (
    <motion.div
      key="cash-reconciler-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-10 animate-fade-in"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 gap-4 text-left">
        <div>
          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reconcile checking & liquid cash deposits</h4>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 opacity-65">Reconcile current cash ledger positions against live bank statements</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase text-slate-400 font-mono">Select target account:</span>
          <select
            value={selectedCashAccountId}
            onChange={(e) => setSelectedCashAccountId(e.target.value)}
            className="text-[10px] font-medium uppercase tracking-wider p-3 bg-white border border-slate-200 rounded-xl cursor-pointer outline-none font-sans"
          >
            {cashAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.code} - {(acc.name || 'UNKNOWN').toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {activeCashAccount && cashReconData ? (
        <div className="space-y-10 text-left">
          {/* Bridge Reconciliation panel */}
          <div className="p-4 md:p-8 bg-slate-50 border border-slate-200 rounded-[32px] space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md">
                <Building2 size={16} />
              </div>
              <div>
                <h5 className="font-black text-slate-900 uppercase tracking-wider text-xs">Direct statement bridging ledger</h5>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Physical ledger balance reconciled against live institutional accounts</p>
              </div>
            </div>

            {/* Reconciliation mathematical bridges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 space-y-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Book ledger balance</span>
                <span className="text-xl font-black font-mono text-slate-800">{formatCurrency(cashReconData.ledgerBalance)}</span>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 space-y-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Uncleared ledger delta</span>
                <span className={cn(
                  "text-xl font-black font-mono",
                  cashReconData.unclearedDelta === 0 ? "text-slate-400" : "text-amber-600"
                )}>
                  {formatCurrency(cashReconData.unclearedDelta)}
                </span>
              </div>
              <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 space-y-2 text-white">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block text-emerald-400">Reconciled statement balance</span>
                <span className="text-xl font-black font-mono text-emerald-400">{formatCurrency(cashReconData.statementBalance)}</span>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-[32px] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Sovereign Statement Lock status</span>
                <p className="text-[11px] font-bold text-slate-700 leading-relaxed font-sans">
                  {cashReconData.cleared ? 'All pending ledger statement items have been reconciled cleanly.' : 'Attention: Unreconciled transaction items exist between target books and statement.'}
                </p>
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                {cashReconData.cleared ? (
                  <>
                    <ShieldCheck className="text-emerald-400 size-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Perfectly reconciled truth</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="text-amber-700 size-4 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">{cashReconData.unclearedList.length} uncleared items outstanding</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Outstanding item triggers list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Pending transaction posting clearances</h5>
              <span className="text-xs font-bold text-slate-500 font-mono italic">Tap checkbox to toggle live cleared statement clearance</span>
            </div>

            <div className="border border-slate-200 rounded-[32px] overflow-hidden max-h-[300px] overflow-y-auto bg-white shadow-sm">
              <table className="w-full text-xs text-left" id="uncleared-posting-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase tracking-widest text-slate-500 font-black font-mono">
                    <th className="p-4">Date Posting</th>
                    <th className="p-4">Reference description</th>
                    <th className="p-4 text-right">Value Amount</th>
                    <th className="p-4 text-center">Clearance Status Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ledger-line font-medium text-slate-900">
                  {cashReconData.unclearedList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-500 text-[11px] font-mono uppercase">
                        [OK] Zero cash ledger outstanding discrepancies. Ledger balances are equal to live statements.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {cashReconData.unclearedList.slice(0, 200).map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50 animate-fade-in">
                          <td className="p-4 font-mono text-[10px] text-slate-500">{item.date}</td>
                          <td className="p-4 uppercase font-black tracking-tight text-slate-800 truncate max-w-[200px]">{item.desc}</td>
                          <td className={cn(
                            "p-4 text-right font-mono font-bold",
                            item.amount > 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleClearTransaction(item.id, true)}
                              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-medium uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-md active:scale-95"
                            >
                              Reconcile Clear
                            </button>
                          </td>
                        </tr>
                      ))}
                      {cashReconData.unclearedList.length > 200 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Showing first 200 pending clearances (of {cashReconData.unclearedList.length})
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-24 text-center text-slate-500 border border-dashed border-slate-200 rounded-[32px]">
          No active checking or asset cash accounts found to reconcile. Register a cash account to enable.
        </div>
      )}
    </motion.div>
  );
}
