import React, { useMemo } from 'react';
import { Transaction, ChartAccount } from '../../types';
import { motion } from 'motion/react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface CashFlowViewProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  formatCurrency: (cents: number) => string;
}

const CashFlowView = React.memo(({ transactions, accounts, formatCurrency }: CashFlowViewProps) => {
  const data = useMemo(() => {
    if (!Array.isArray(transactions)) return { operating: { total: 0, items: [] }, investing: { total: 0, items: [] }, financing: { total: 0, items: [] }, netChange: 0 };
    
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    let operating = 0, investing = 0, financing = 0;
    const operatingItems: any[] = [], investingItems: any[] = [], financingItems: any[] = [];

    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        if (t.deletedAt) continue;
        const lines = t.lines || [];
        for (let j = 0; j < lines.length; j++) {
            const l = lines[j];
            const acc = accountMap.get(l.accountId);
            if (!acc) continue;
            
            const amount = -l.amountCents; 
            const accName = (acc.name || '').toLowerCase();
            if (acc.type === 'income' || acc.type === 'expense') {
                operating += amount;
                if (operatingItems.length < 5) operatingItems.push({ name: acc.name, amount });
            } else if (acc.type === 'asset' && accName.includes('equipment')) {
                investing += amount;
                if (investingItems.length < 5) investingItems.push({ name: acc.name, amount });
            } else if (acc.type === 'equity' || acc.type === 'liability') {
                financing += amount;
                if (financingItems.length < 5) financingItems.push({ name: acc.name, amount });
            }
        }
    }

    return {
        operating: { total: operating, items: operatingItems },
        investing: { total: investing, items: investingItems },
        financing: { total: financing, items: financingItems },
        netChange: operating + investing + financing
    };
  }, [transactions, accounts]);
  if (!data) return null;

  const sections: any[] = [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs space-y-3">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              section.color === 'emerald' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
              section.color === 'blue' ? "bg-blue-50 text-blue-600 border border-blue-100" :
              "bg-purple-50 text-purple-600 border border-purple-100"
            )}>
              <section.icon size={16} />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">{section.title}</h4>
              <p className={cn(
                "text-lg font-bold mt-0.5 font-mono tracking-tight",
                section.value >= 0 ? "text-emerald-700" : "text-rose-700"
              )}>
                {formatCurrency(section.value)}
              </p>
            </div>
            <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
              {section.items.slice(0, 3).map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-400 truncate max-w-[130px]">{item.name}</span>
                  <span className={item.amount >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl p-5 text-white relative overflow-hidden border border-slate-950">
        <div className="absolute top-0 right-0 w-60 h-60 bg-white/5 rounded-full -mr-32 -mt-32 blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight mb-1">Net Cash Flow</h3>
            <p className="text-slate-400 text-[11px] max-w-sm">The net change in liquid status across all operating, investing, and financing items.</p>
          </div>
          <div className="text-left md:text-right">
            <div className="text-2xl font-black font-mono tracking-tight">
              {formatCurrency(data?.netChange || 0)}
            </div>
            <div className="flex items-center justify-start md:justify-end gap-1.5 mt-1">
              {(data?.netChange || 0) >= 0 ? (
                <div className="flex items-center gap-1 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                  <ArrowUpRight size={12} />
                  Net Influx Position
                </div>
              ) : (
                <div className="flex items-center gap-1 text-rose-400 text-[9px] font-bold uppercase tracking-wider">
                  <ArrowDownRight size={12} />
                  Net Expenditure Position
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default CashFlowView;
