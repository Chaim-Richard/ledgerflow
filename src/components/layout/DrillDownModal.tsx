import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Table, Search } from 'lucide-react';
import { Transaction } from '../../types';

import { cn, formatDate } from '../../lib/utils';
import { useDialog } from '../../hooks/useDialog';

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountName: string;
  transactions: Transaction[];
  formatCurrency: (val: number) => string;
  /** where the drill-down came from, shown as a breadcrumb: e.g. 'Profit & Loss' (I-16) */
  from?: string;
}

export default function DrillDownModal({ isOpen, onClose, accountName, transactions, formatCurrency, from }: DrillDownModalProps) {
  const [displayLimit, setDisplayLimit] = React.useState(50);
  const { dialogProps, titleId } = useDialog(onClose, isOpen);
  return (
    <AnimatePresence>
      {isOpen && (
        <div {...dialogProps} className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl max-h-[85dvh] bg-[var(--surface)] rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-[var(--line)]"
          >
            <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--surface)]/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-[32px] flex items-center justify-center shadow-lg shadow-ledger-ink/20">
                  <Table size={24} />
                </div>
                <div>
                  {from && (
                    <nav aria-label="Breadcrumb" className="text-xs text-[var(--muted)] mb-1">
                      <button type="button" onClick={onClose} className="hover:underline">{from}</button>
                      <span aria-hidden="true"> › </span>
                      <span aria-current="page">{accountName}</span>
                    </nav>
                  )}
                  <h2 id={titleId} className="text-2xl font-black text-[var(--text)] tracking-tight">{accountName}</h2>
                  <p className="micro-label">Transaction Drill-Down • {transactions.length} matched events</p>
                </div>
              </div>
              <button aria-label="Close" 
                onClick={onClose}
                className="p-3 hover:bg-[var(--surface)] rounded-[32px] transition-all shadow-sm border border-transparent hover:border-[var(--line)]"
              ><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="micro-label text-[var(--muted)]">
                    <th className="pb-4 pl-4 font-black">Date</th>
                    <th className="pb-4 font-black">Description</th>
                    <th className="pb-4 text-right pr-4 font-black">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, displayLimit).map((tx) => {
                    const matchedLine = tx.lines?.find(l => l.accountName === accountName || l.accountId === accountName);
                    const amount = matchedLine ? matchedLine.amountCents : tx.totalAmountCents;

                    return (
                      <tr key={tx.id} className="group hover:bg-[var(--ink)] transition-all rounded-[32px] overflow-hidden">
                        <td className="py-4 pl-4 text-xs font-black text-[var(--muted)] font-mono rounded-l-2xl border-y border-l border-[var(--line)] group-hover:border-slate-300">
                          {tx.date ? formatDate(tx.date) : 'N/A'}
                        </td>
                        <td className="py-4 text-sm font-bold text-[var(--text)] border-y border-[var(--line)] group-hover:border-slate-300">
                           <div className="flex flex-col">
                             <span>{tx.description}</span>
                             {tx.payee && <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">{tx.payee}</span>}
                           </div>
                        </td>
                        <td className={cn(
                          "py-4 text-right pr-4 font-black font-mono border-y border-r border-[var(--line)] group-hover:border-slate-300 rounded-r-2xl tabular-nums",
                          amount >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {amount >= 0 ? '+' : ''}{formatCurrency(amount)}
                        </td>
                      </tr>
                    );
                  })}
                  {transactions.length > displayLimit && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center border border-dashed border-[var(--line)] rounded-[32px]">
                        <button 
                          onClick={() => setDisplayLimit(prev => prev + 50)}
                          className="px-6 py-2 bg-[var(--surface)] hover:bg-[var(--ink)] text-indigo-600 font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                        >
                          Load Next 50 (Showing {displayLimit} of {transactions.length})
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {transactions.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-[var(--surface)] rounded-[32px] flex items-center justify-center text-slate-300 mx-auto">
                    <Search size={32} />
                  </div>
                  <p className="text-sm text-[var(--muted)] font-medium italic">No underlying transactions found for this period.</p>
                </div>
              )}
            </div>

            <div className="p-4 md:p-8 border-t border-[var(--line)] bg-[var(--surface)]/30">
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em]">End of Drill-Down View</p>
                  <button onClick={onClose} className="btn-secondary" aria-label="Close Report">Close Report</button>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
