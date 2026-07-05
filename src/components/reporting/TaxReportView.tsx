import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { motion } from 'motion/react';
import { 
  FileText, 
  ShieldCheck, 
  Info,
  Download,
  ExternalLink,
  Cpu
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';

interface TaxReportViewProps {
  transactions: Transaction[];
  formatCurrency: (cents: number) => string;
}

export default function TaxReportView({ transactions, formatCurrency }: TaxReportViewProps) {
  const setActiveTab = useUIStore(state => state.setActiveTab);
  const taxData = useMemo(() => {
    const categories: Record<string, { total: number, count: number }> = {};
    
    // IRS-style category mapping
    const taxMapping: Record<string, string> = {
      'Advertising': 'Advertising & Marketing',
      'Travel': 'Travel & Meals',
      'Software': 'Software & Subscriptions',
      'Rent': 'Rent & Lease',
      'Utilities': 'Utilities',
      'Supplies': 'Office Supplies',
      'Legal': 'Professional Services',
      'Insurance': 'Insurance',
      'Meals': 'Meals & Entertainment (50% deductible)',
    };

    transactions.forEach(t => {
      t.lines?.forEach(l => {
        if (l.amountCents < 0) {
          const cat = l.accountName || 'Other Expenses';
          const taxCat = taxMapping[cat] || 'General Business Expenses';
          
          if (!categories[taxCat]) {
            categories[taxCat] = { total: 0, count: 0 };
          }
          categories[taxCat].total += Math.abs(l.amountCents);
          categories[taxCat].count += 1;
        }
      });
    });

    return Object.entries(categories).sort((a, b) => b[1].total - a[1].total);
  }, [transactions]);

  const totalDeductible = useMemo(() => {
    return taxData.reduce((sum, [_, data]) => sum + data.total, 0);
  }, [taxData]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      <div className="flex items-center justify-between bg-emerald-900 rounded-[40px] p-4 md:p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-emerald-400 font-bold uppercase tracking-widest text-[10px] mb-4">
            <ShieldCheck size={14} />
            Tax Compliance Ready
          </div>
          <h3 className="text-2xl md:text-4xl font-black tracking-tighter mb-2">Estimated Deductions</h3>
          <p className="text-emerald-200/60 text-sm max-w-md">Based on your categorized business expenses for the current fiscal year.</p>
        </div>
        <div className="relative z-10 text-right">
          <div className="text-4xl md:text-6xl font-black font-mono tracking-tighter">
            {formatCurrency(totalDeductible)}
          </div>
          <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mt-2">Total Potential Deductions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono mb-6">Expense Classification (Schedule C Style)</h4>
          {taxData.map(([name, data]) => (
            <div key={name} className="bg-white p-6 rounded-[32px] border border-zinc-200 flex items-center justify-between hover:border-zinc-400 transition-all group">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-zinc-50 rounded-[32px] flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-900">{name}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{data.count} Transactions</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-zinc-900 font-mono tracking-tighter">{formatCurrency(data.total)}</p>
                <button className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest hover:text-zinc-900 flex items-center gap-1 justify-end mt-1">
                  View Details
                  <ExternalLink size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-50 rounded-[32px] p-4 md:p-8 border border-zinc-200">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-6 font-mono">Tax Preparation Tips</h4>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-100">
                  <Info size={14} />
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                  Ensure all expenses over $75 have digital receipts attached for audit protection.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-100">
                  <Info size={14} />
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                  Meal expenses are generally only 50% deductible. Our system tracks the full amount; your CPA will adjust.
                </p>
              </div>
            </div>
            <button className="w-full mt-8 py-4 bg-zinc-900 text-white rounded-[32px] text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
              <Download size={14} />
              Export Tax Package
            </button>
          </div>

          <div className="bg-zinc-950 rounded-[32px] p-4 md:p-8 border border-zinc-800 text-left relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -mr-24 -mt-24 blur-2xl animate-pulse" />
            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono mb-4">
              <Cpu size={12} className="animate-spin" />
              Advanced CFO Advisory
            </div>
            <h5 className="text-lg font-black tracking-tight mb-2 uppercase">AI Tax Strategy Node</h5>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium mb-6">
              Tax liabilities are modeled dynamically based on corporate structures, dependent credits, S-Corp split ratios, and Specified Service regulations. Access tax savings simulations today.
            </p>
            <button 
              onClick={() => setActiveTab('tax-optimizer' as any)}
              className="w-full py-4 bg-emerald-600 text-white rounded-[32px] text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              Launch AI Tax Planner
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
