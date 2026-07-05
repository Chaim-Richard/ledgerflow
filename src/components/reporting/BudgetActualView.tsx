import React, { useMemo, useState } from 'react';
import { Transaction, Budget, ChartAccount } from '../../types';
import { motion } from 'motion/react';
import { 
  Target, 
  AlertCircle, 
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

interface BudgetActualViewProps {
  budgets: Budget[];
  transactions: Transaction[];
  accounts: ChartAccount[];
  formatCurrency: (cents: number) => string;
}

const BudgetActualView = React.memo(({ budgets, transactions, accounts, formatCurrency }: BudgetActualViewProps) => {
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));

  const data = useMemo(() => {
    if (!Array.isArray(budgets) || !Array.isArray(transactions)) return [];
    
    // O(N) pass for budget tracking
    const accountTotals = new Map<string, number>();
    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        if (t.deletedAt) continue;
        const d = new Date(t.date);
        const tMonth = format(d, 'yyyy-MM');
        if (tMonth !== reportMonth) continue;

        const lines = t.lines || [];
        for (let j = 0; j < lines.length; j++) {
            const l = lines[j];
            if (l.accountId) {
              accountTotals.set(l.accountId, (accountTotals.get(l.accountId) || 0) + Math.abs(l.amountCents || 0));
            }
        }
    }

    return budgets.map(b => {
      const actual = accountTotals.get(b.targetId) || 0;
      const budget = b.amountCents || 0;
      const variance = budget - actual; // Variance is Budget - Actual for expenses
      const percent = budget > 0 ? (actual / budget) * 100 : 0;

      const targetLabel = b.targetType === 'account' 
        ? accounts.find(a => a.id === b.targetId)?.name 
        : b.targetId;

      return {
        id: b.id,
        name: targetLabel || 'Unnamed Budget',
        accountName: targetLabel || 'Unknown Account',
        budget,
        actual,
        variance,
        percent,
        status: percent > 100 ? 'over' : percent > 90 ? 'warning' : 'on-track'
      } as any;
    });
  }, [budgets, transactions, reportMonth, accounts]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-zinc-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Reporting Period</p>
            <input 
              type="month" 
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="text-sm font-black text-zinc-900 bg-transparent border-none p-0 focus:ring-0"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {data.map((item, i) => (
          <div key={i} className="bg-white p-4 md:p-8 rounded-[40px] border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-[32px] flex items-center justify-center",
                  (item?.percent || 0) > 100 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  <Target size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-zinc-900 tracking-tighter">{item?.accountName || 'Unknown'}</h4>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Monthly Budget</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-zinc-900 font-mono tracking-tighter">
                  {Math.round(item?.percent || 0)}%
                </p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Utilized</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest font-mono">
                <span className="text-zinc-500">Actual: {formatCurrency(item?.actual || 0)}</span>
                <span className="text-zinc-500">Budget: {formatCurrency(item?.budget || 0)}</span>
              </div>
              <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(item?.percent || 0, 100)}%` }}
                  className={cn(
                    "h-full rounded-full transition-colors",
                    (item?.percent || 0) > 100 ? "bg-rose-500" : 
                    (item?.percent || 0) > 80 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                />
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-[32px] flex items-center gap-3",
              (item?.variance || 0) >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            )}>
              {(item?.variance || 0) >= 0 ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <p className="text-xs font-bold uppercase tracking-widest">
                {(item?.variance || 0) >= 0 
                  ? `${formatCurrency(item?.variance || 0)} Under Budget` 
                  : `${formatCurrency(Math.abs(item?.variance || 0))} Over Budget`}
              </p>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <div className="lg:col-span-2 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-[40px] p-20 text-center">
            <div className="w-20 h-20 bg-white rounded-[32px] flex items-center justify-center text-zinc-300 mx-auto mb-6 shadow-sm">
              <Target size={40} />
            </div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tighter mb-2">No Budgets Defined</h3>
            <p className="text-zinc-500 max-w-sm mx-auto text-sm">Set up budgets for categories or projects to track your spending limits and variance.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default BudgetActualView;
