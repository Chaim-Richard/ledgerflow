import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { cn, formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

export default function StatementReconciliation() {
  const accounts = useLedgerStore(state => state.accounts || []);
  const transactions = useLedgerStore(state => state.transactions || []);
  const updateTransaction = useLedgerStore(state => state.updateTransaction);

  const cashAccounts = useMemo(() => accounts.filter(a => a.type === 'asset' && 
    (a.category?.toLowerCase() === 'cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('checking'))
  ), [accounts]);

  const [selectedAccountId, setSelectedAccountId] = useState(cashAccounts[0]?.id || '');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalanceStr, setStatementBalanceStr] = useState('');
  const [isReconciling, setIsReconciling] = useState(false);

  const activeAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

  // Derive target ending balance
  const targetBalance = TruthEngine.parseAmountToCents(statementBalanceStr) || 0;

  // Derive Uncleared & Cleared Items for the active account
  const { clearedTransactions, unclearedTransactions, clearedBalance } = useMemo(() => {
    let clearedBal = activeAccount?.openingBalanceCents || 0;
    const cleared: any[] = [];
    const uncleared: any[] = [];

    transactions.forEach(tx => {
      if (tx.deletedAt) return;
      tx.lines?.forEach(line => {
        if (line.accountId === selectedAccountId) {
          if (tx.isCleared) {
            clearedBal += line.amountCents;
            cleared.push({ tx, line });
          } else {
            uncleared.push({ tx, line });
          }
        }
      });
    });

    // Sort descending by date
    uncleared.sort((a, b) => new Date(b.tx.date).getTime() - new Date(a.tx.date).getTime());

    return { clearedTransactions: cleared, unclearedTransactions: uncleared, clearedBalance: clearedBal };
  }, [transactions, selectedAccountId, activeAccount]);

  const difference = clearedBalance - targetBalance;
  const isPerfectMatch = difference === 0 && statementBalanceStr !== '';

  const handleToggleClear = (txId: string, currentCleared: boolean) => {
    updateTransaction(txId, {
      isCleared: !currentCleared,
      clearedAt: !currentCleared ? new Date().toISOString() : undefined,
      status: !currentCleared ? 'reconciled' : 'pending'
    });
  };

  const handleFinishReconciliation = () => {
    if (!isPerfectMatch) {
      toast.error('Cannot finish reconciliation until difference is exactly $0.00');
      return;
    }
    setIsReconciling(true);
    setTimeout(() => {
      // Typically in QB this generates a report. We will just show success.
      toast.success('Reconciliation completed! Statement is strictly balanced to the ledger.');
      setIsReconciling(false);
      setStatementBalanceStr(''); // Reset for next period
    }, 800);
  };

  if (!cashAccounts.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-500 font-medium">No cash accounts available to reconcile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate mb-4">
            <CheckCircle2 size={14} />
            Period Statement Reconciler
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Bank Reconciliation</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">
            Compare your physical bank statement to your accounting ledger truthfully.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Panel: Statement Setup */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono block mb-2">Target Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full text-sm font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {cashAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono block mb-2">Statement Ending Date</label>
                <input
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  className="w-full text-sm font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono block mb-2">Statement Ending Balance</label>
                <div className="relative">
                  <span className="absolute left-4 top-[14px] text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={statementBalanceStr}
                    onChange={(e) => setStatementBalanceStr(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-[32px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black uppercase text-slate-500">Cleared Balance</span>
                <span className="font-mono font-bold text-slate-800 text-sm">{formatCurrency(clearedBalance)}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-slate-500">Statement Ending</span>
                <span className="font-mono font-bold text-slate-800 text-sm">{formatCurrency(targetBalance)}</span>
              </div>
              <div className="h-px bg-slate-300 w-full mb-3" />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-500">Difference</span>
                <span className={cn(
                  "font-mono font-black text-xl",
                  isPerfectMatch ? "text-emerald-500" : "text-amber-600"
                )}>
                  {formatCurrency(Math.abs(difference))}
                </span>
              </div>
              
              {!isPerfectMatch && statementBalanceStr !== '' && (
                <div className="mt-4 flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[9px] text-amber-800 font-bold uppercase tracking-widest leading-relaxed">
                    Clear transactions on the right to bring the difference to strictly zero.
                  </p>
                </div>
              )}
              {isPerfectMatch && (
                <div className="mt-4 flex items-start gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-[9px] text-emerald-800 font-bold uppercase tracking-widest leading-relaxed">
                    Zero Difference reached. You may now close this period reconciliation.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleFinishReconciliation}
              disabled={!isPerfectMatch || isReconciling}
              className="w-full flex items-center justify-center py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isReconciling ? 'Locking Period...' : 'Finish Reconciliation'}
            </button>
          </div>
        </div>

        {/* Right Panel: Transaction Clearance */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border text-left border-slate-200 rounded-[32px] overflow-hidden shadow-sm flex flex-col h-[700px]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h4 className="font-black text-slate-800 uppercase tracking-tight">Active Uncleared Ledger</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select items that appear on your statement</p>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
                {unclearedTransactions.length} Pending Actions
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {unclearedTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                  <CheckCircle2 size={48} className="opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">All ledger items are cleared for this account.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white shadow-sm border-b border-slate-200 z-10 text-[9px] font-black uppercase text-slate-400 tracking-widest text-left">
                    <tr>
                      <th className="py-4 pl-6 pr-4">Clear</th>
                      <th className="py-4 px-4 w-32">Date</th>
                      <th className="py-4 px-4">Description</th>
                      <th className="py-4 px-4">Payee</th>
                      <th className="py-4 pr-6 pl-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unclearedTransactions.map((item) => (
                      <tr key={item.tx.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => handleToggleClear(item.tx.id, !!item.tx.isCleared)}>
                        <td className="py-4 pl-6 pr-4">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                            item.tx.isCleared ? "bg-emerald-500 border-emerald-500" : "border-slate-300 group-hover:border-indigo-600"
                          )}>
                            {item.tx.isCleared && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono text-[10px] text-slate-500">{item.tx.date}</td>
                        <td className="py-4 px-4 font-medium text-slate-800">{item.tx.description || 'Ledger Posting'}</td>
                        <td className="py-4 px-4 text-slate-500">{item.tx.payee || '-'}</td>
                        <td className={cn(
                          "py-4 pr-6 pl-4 text-right font-mono font-bold text-sm",
                          item.line.amountCents > 0 ? "text-emerald-600" : "text-slate-800"
                        )}>
                          {formatCurrency(item.line.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
