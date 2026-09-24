import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency, cn } from '../../lib/utils';
import { BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Transaction } from '../../types';
import { isPostable } from '../../lib/txFilters';

interface Props {
  selectedYear?: number;
  startDate?: string;
  endDate?: string;
}

export const JournalSheetReportView: React.FC<Props> = ({ selectedYear, startDate, endDate }) => {
  const transactions = useLedgerStore(s => s.transactions);

  const evaluatedTransactions = useMemo(() => {
    return (transactions || []).filter(tx => {
      if (!isPostable(tx)) return false;
      if (startDate && tx.date && tx.date < startDate) return false;
      if (endDate && tx.date && tx.date > endDate) return false;
      if (selectedYear && tx.date && !tx.date.startsWith(selectedYear.toString())) return false;
      return true;
    }).map(tx => {
      let totalDebits = 0;
      let totalCredits = 0;
      (tx.lines || []).forEach(line => {
        const amt = line.amountCents || 0;
        if (amt > 0) totalDebits += amt;
        else totalCredits += Math.abs(amt);
      });
      const isBalanced = Math.abs(totalDebits - totalCredits) === 0;
      return {
        ...tx,
        totalDebits,
        totalCredits,
        isBalanced,
        imbalanceCents: Math.abs(totalDebits - totalCredits)
      };
    });
  }, [transactions, selectedYear, startDate, endDate]);

  const unbalancedCount = evaluatedTransactions.filter(t => !t.isBalanced).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" id="journal-sheet-report">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Journal Sheet & Audit Integrity
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Chronological view of all double-entry journal transactions with automated debit/credit tie-out verification.
          </p>
        </div>
        <div>
          {unbalancedCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
              <AlertTriangle size={16} />
              {unbalancedCount} Unbalanced Transaction(s) Detected
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold">
              <CheckCircle2 size={16} />
              All Transactions Balanced
            </div>
          )}
        </div>
      </div>

      {evaluatedTransactions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 text-neutral-500 text-xs">
          No transactions found for the selected period.
        </div>
      ) : (
        <div className="space-y-4">
          {evaluatedTransactions.map((tx: any) => (
            <div 
              key={tx.id} 
              className={cn(
                "bg-white rounded-2xl border p-5 shadow-xs transition-all",
                !tx.isBalanced ? "border-rose-300 bg-rose-50/20" : "border-neutral-200"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-neutral-500">{tx.date}</span>
                  <span className="font-bold text-neutral-900 text-sm">{tx.description}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 uppercase">
                    {tx.type}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>Debits: <span className="font-bold text-neutral-900">{formatCurrency(tx.totalDebits)}</span></div>
                  <div>Credits: <span className="font-bold text-neutral-900">{formatCurrency(tx.totalCredits)}</span></div>
                  {!tx.isBalanced && (
                    <div className="flex items-center gap-1 text-rose-600 font-bold bg-rose-100 px-2.5 py-1 rounded-lg">
                      <AlertTriangle size={14} />
                      Imbalance: {formatCurrency(tx.imbalanceCents)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-neutral-400 font-bold uppercase text-[10px]">
                      <th className="pb-2">Account</th>
                      <th className="pb-2">Description / Memo</th>
                      <th className="pb-2 text-right">Debit</th>
                      <th className="pb-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {(tx.lines || []).map((line: any, lIdx: number) => {
                      const amt = line.amountCents || 0;
                      const isDebit = amt > 0;
                      return (
                        <tr key={lIdx} className="hover:bg-neutral-50/50">
                          <td className="py-2 font-medium text-neutral-900">{line.accountName || line.accountId}</td>
                          <td className="py-2 text-neutral-500">{line.description || '-'}</td>
                          <td className="py-2 text-right font-mono text-neutral-800">
                            {isDebit ? formatCurrency(amt) : '-'}
                          </td>
                          <td className="py-2 text-right font-mono text-neutral-800">
                            {!isDebit ? formatCurrency(Math.abs(amt)) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalSheetReportView;
