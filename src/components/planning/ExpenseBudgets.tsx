import React, { useState } from 'react';
import { Target, PieChart, ArrowUpRight, ArrowDownRight, BarChart } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ExpenseBudgets() {
  const [activeTab, setActiveTab] = useState<'budgets'>('budgets');

  const budgets: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Target className="w-6 h-6 text-blue-400" />
            Departmental Expense Budgets
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track actual spend against approved budgets and trigger warnings on overruns.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Department / Period</div>
            <div className="col-span-2 text-right">Budget Limit</div>
            <div className="col-span-4 text-center">Actual Spend</div>
            <div className="col-span-1 text-right">Var %</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {budgets.map(b => {
               const percent = (b.actual / b.limit) * 100;
               const variance = ((b.actual - b.limit) / b.limit) * 100;
               return (
                 <div key={b.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                   <div className="col-span-3">
                     <div className="font-bold text-slate-900">{b.dept}</div>
                     <div className="text-[10px] font-mono text-slate-400 mt-0.5">{b.period}</div>
                   </div>
                   <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                      ${b.limit.toLocaleString()}
                   </div>
                   <div className="col-span-4 px-8">
                      <div className="flex items-center justify-between text-[10px] font-bold font-mono mb-1">
                         <span className={cn(percent > 100 ? "text-rose-600" : "text-emerald-600")}>${b.actual.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                         <div 
                            className={cn("h-full rounded-full", percent > 100 ? "bg-rose-500" : percent > 80 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                         />
                      </div>
                   </div>
                   <div className="col-span-1 text-right font-mono text-xs font-bold">
                      <span className={variance > 0 ? "text-rose-600" : "text-emerald-600"}>
                         {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                      </span>
                   </div>
                   <div className="col-span-2 flex justify-end">
                      <span className={cn(
                         "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                         b.status === 'On Track' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                         "bg-rose-50 text-rose-700 border-rose-200"
                      )}>
                         {b.status}
                      </span>
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
