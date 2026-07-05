import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PNLViewProps {
  transactions: any[];
  periodLabel: string;
  formatCurrency: (val: number) => string;
  onDrillDown?: (accountName: string) => void;
  accountTypeMap: Map<string, string>;
}

const PNLView = React.memo(({ transactions, periodLabel, formatCurrency, onDrillDown, accountTypeMap }: PNLViewProps) => {
  const pnlData = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const categories: Record<string, number> = {};
    let taxes = 0;

    if (Array.isArray(transactions)) {
      for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        if (t.deletedAt) continue;
        const lines = t.lines || [];
        for (let j = 0; j < lines.length; j++) {
          const l = lines[j];
          const rawName = l.accountName || '';
          const accNameLower = rawName.toLowerCase();
          const amount = l.amountCents || 0;
          
          // Use provided map first (by accountId or lowercased name), fallback to string-based heuristics
          let type = (l.accountId ? accountTypeMap.get(l.accountId) : undefined) || accountTypeMap.get(accNameLower);
          
          if (!type) {
            if (accNameLower.includes('income') || accNameLower.includes('revenue')) type = 'income';
            else if (accNameLower.includes('expense') || accNameLower.includes('cost')) type = 'expense';
          }

          if (type === 'income') {
            income += -amount;
          } else if (type === 'expense') {
            expenses += amount;
            if (rawName) categories[rawName] = (categories[rawName] || 0) + amount;
            if (accNameLower.includes('tax')) taxes += amount;
          }
        }
      }
    }

    return {
      income,
      expenses,
      taxes,
      netIncome: income - expenses,
      margin: income > 0 ? ((income - expenses) / income) * 100 : 0,
      categories
    };
  }, [transactions]);

  const maxExpenses = useMemo(() => 
    Math.max(...Object.values(pnlData.categories || {}), 0)
  , [pnlData.categories]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-4 md:p-6 lg:p-8 rounded-xl border border-slate-200 shadow-3xs max-w-4xl mx-auto relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-6 opacity-[0.015] select-none pointer-events-none text-slate-800">
        <h2 className="text-[6rem] font-black tracking-tighter leading-none m-0">FIN</h2>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-10 relative z-10">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-emerald-400">
               <TrendingUp size={18} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-slate-800 tracking-tight">Profit & Loss</h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{periodLabel} • Operational Ledger Flow</p>
             </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Corporate Yield</p>
          <div className="flex items-center gap-4">
            <p className={cn(
              "text-3xl font-black tracking-tight tabular-nums",
              pnlData.netIncome >= 0 ? "text-emerald-700" : "text-rose-700"
            )}>
              {formatCurrency(pnlData.netIncome)}
            </p>
            <div className={cn(
              "p-1.5 rounded-lg border",
              pnlData.netIncome >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
            )}>
               {pnlData.netIncome >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-12 relative z-10">
        <section>
          <div className="flex items-end justify-between border-b border-slate-200 pb-3 mb-6">
            <div>
              <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Operating Revenue</h3>
              <span className="text-xs font-bold text-slate-700">Total Gross Income</span>
            </div>
            <span className="text-xl font-mono font-bold tracking-tight text-emerald-700">{formatCurrency(pnlData.income)}</span>
          </div>
          
          <div className="space-y-2">
            <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center group hover:bg-slate-100/60 transition-all border border-slate-200/40">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                <span className="text-sm font-semibold text-slate-800">Core Services Portfolio</span>
              </div>
              <span className="text-sm font-mono font-bold text-slate-800">{formatCurrency(pnlData.income)}</span>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between border-b border-slate-200 pb-3 mb-6">
            <div>
              <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Operating Expenses</h3>
              <span className="text-xs font-bold text-slate-700">Total Expenditures</span>
            </div>
            <span className="text-xl font-mono font-bold tracking-tight text-rose-700">({formatCurrency(pnlData.expenses)})</span>
          </div>

          <div className="space-y-2">
            {Object.entries(pnlData.categories || {}).map(([cat, amt]) => (
              <div 
                onClick={() => onDrillDown?.(cat)}
                key={cat} 
                className="group cursor-pointer p-4 hover:bg-slate-50 rounded-xl transition-all border border-slate-100"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-rose-500/80" />
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-800 transition-colors uppercase tracking-wider">{cat}</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-slate-800 group-hover:scale-102 transition-transform tabular-nums">{formatCurrency(amt)}</span>
                </div>
                {/* Excel-style Data Bar */}
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(amt / maxExpenses) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-rose-500/20 group-hover:bg-rose-500/35 transition-colors"
                  />
                </div>
              </div>
            ))}
            
            <div className="mt-12 pt-6 border-t border-slate-250/90 flex justify-between items-end">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Accounting Summary</span>
                <span className="text-sm font-bold uppercase tracking-wider text-slate-800">Net Profit</span>
              </div>
              <div className="flex items-center gap-8">
                 <div className="flex flex-col items-end opacity-75">
                    <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-slate-400">Gross Margin</span>
                    <span className="text-sm font-mono font-bold text-slate-800">{((pnlData.income > 0 ? (pnlData.netIncome / pnlData.income) : 0) * 100).toFixed(1)}%</span>
                 </div>
                 <span className={cn(
                   "text-2xl font-black tracking-tight tabular-nums",
                   pnlData.netIncome >= 0 ? "text-emerald-700" : "text-rose-700"
                 )}>
                   {formatCurrency(pnlData.netIncome)}
                 </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
});

export default PNLView;
