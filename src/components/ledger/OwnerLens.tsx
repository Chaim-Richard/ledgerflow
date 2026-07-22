import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { ArrowUpRight, ArrowDownRight, Wallet, ArrowRight } from 'lucide-react';
import { explainNetProfit } from '../../lib/algorithms/number-explainer';

export default function OwnerLens() {
  const transactions = useLedgerStore(s => s.transactions);
  const [showAllActivity, setShowAllActivity] = React.useState(false);

  const stats = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;
    
    transactions.forEach(t => {
      if (t.totalAmountCents > 0) moneyIn += t.totalAmountCents;
      else moneyOut += Math.abs(t.totalAmountCents);
    });
    
    const left = moneyIn - moneyOut;
    return { moneyIn, moneyOut, left };
  }, [transactions]);

  const monthStr = new Date().toISOString().slice(0, 7);
  const explainer = useMemo(() => explainNetProfit(transactions, monthStr), [transactions, monthStr]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-black text-[var(--text)] tracking-tight">Plain English Books</h1>
        <p className="text-[var(--muted)] mt-2 text-lg">No debits or credits. Just what you need to know.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl shadow-sm">
          <div className="p-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-emerald-800 font-bold uppercase tracking-wider text-sm">Money In</h3>
              <ArrowUpRight className="text-emerald-500 w-6 h-6" />
            </div>
            <p className="text-4xl font-black text-emerald-900">${(stats.moneyIn / 100).toFixed(0)}</p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100 rounded-2xl shadow-sm">
          <div className="p-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-rose-800 font-bold uppercase tracking-wider text-sm">Money Out</h3>
              <ArrowDownRight className="text-rose-500 w-6 h-6" />
            </div>
            <p className="text-4xl font-black text-rose-900">${(stats.moneyOut / 100).toFixed(0)}</p>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm">
          <div className="p-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-indigo-800 font-bold uppercase tracking-wider text-sm">Left Over</h3>
              <Wallet className="text-indigo-500 w-6 h-6" />
            </div>
            <p className="text-4xl font-black text-indigo-900">${(stats.left / 100).toFixed(0)}</p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-indigo-100 rounded-2xl shadow-sm">
        <div className="p-8">
          <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2">Explain this month's number</h3>
          <p className="text-2xl font-medium text-[var(--text)] leading-relaxed">
            {explainer.sentence}
          </p>
        </div>
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--text)]">Recent Activity</h3>
          {transactions.length > 5 && (
            <button 
              onClick={() => setShowAllActivity(!showAllActivity)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              {showAllActivity ? 'Show Top 5' : `View All (${transactions.length})`}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {(showAllActivity ? transactions : transactions.slice(0, 5)).map(t => (
            <div key={t.id} className="flex items-center justify-between p-4 bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.totalAmountCents > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                  {t.totalAmountCents > 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-bold text-[var(--text)]">{t.payee || t.description}</p>
                  <p className="text-sm text-[var(--muted)]">{t.date}</p>
                </div>
              </div>
              <p className={`font-black text-lg ${t.totalAmountCents > 0 ? 'text-emerald-600' : 'text-[var(--text)]'}`}>
                {t.totalAmountCents > 0 ? '+' : ''}${(t.totalAmountCents / 100).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
