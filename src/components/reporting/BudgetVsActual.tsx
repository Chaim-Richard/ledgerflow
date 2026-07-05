
import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { formatCurrency, cn } from '../../lib/utils';
import { Budget, Transaction } from '../../types';

interface BudgetVsActualProps {
  budgets: Budget[];
  transactions: Transaction[];
}

export default function BudgetVsActual({ budgets, transactions }: BudgetVsActualProps) {
  const data = useMemo(() => {
    return budgets.map(budget => {
      const actual = transactions
        .filter(t => t.lines.some(l => l.accountId === budget.targetId || l.category === budget.targetId))
        .reduce((sum, t) => sum + Math.abs(t.totalAmountCents), 0);
      
      const variance = budget.amountCents - actual;
      const status = actual > budget.amountCents ? 'over' : 'under';
      
      return {
        name: budget.targetId,
        budget: budget.amountCents / 100,
        actual: actual / 100,
        variance: variance / 100,
        status
      };
    });
  }, [budgets, transactions]);

  if (!budgets.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
         <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-500">
            <span className="text-2xl font-black">?</span>
         </div>
         <h4 className="text-sm font-medium uppercase tracking-wider text-slate-900">No Budgets Defined</h4>
         <p className="text-[10px] font-medium text-slate-500 max-w-xs">Define budgets in the Planning module to see variance analysis here.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
         <h3 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900">Budget Variance Analysis</h3>
         <div className="flex gap-4">
            <div className="flex items-center gap-2">
               <div className="w-3 h-3 bg-slate-900 rounded" />
               <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">Budget</span>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-3 h-3 bg-indigo-500 rounded" />
               <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">Actual</span>
            </div>
         </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 800, fill: '#1e293b' }} width={100} />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              formatter={(val: number) => [`$${val.toLocaleString()}`, '']}
            />
            <Bar dataKey="budget" fill="#1e293b" radius={[0, 4, 4, 0]} barSize={12} />
            <Bar dataKey="actual" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
         {data.slice(0, 4).map((item, i) => (
           <div key={i} className="p-4 bg-slate-50 rounded-[32px] flex items-center justify-between border border-slate-200 hover:border-slate-800/20 transition-all">
              <div>
                 <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500 mb-1">{item.name}</p>
                 <p className="text-lg font-black italic tracking-tight text-slate-900">
                    {formatCurrency(item.variance * 100)}
                 </p>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[8px] font-medium uppercase tracking-wider",
                item.status === 'over' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
              )}>
                 {item.status === 'over' ? 'Over Budget' : 'Under Budget'}
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
