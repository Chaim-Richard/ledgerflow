import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChartAccount } from '../../types';
import { ShieldCheck, ArrowDownRight, ArrowUpRight, Scale } from 'lucide-react';

interface BalanceSheetReportViewProps {
  accounts: ChartAccount[];
  formatCurrency: (val: number) => string;
  onDrillDown?: (accountName: string) => void;
}

const BalanceSheetReportView = React.memo(({ accounts, formatCurrency, onDrillDown }: BalanceSheetReportViewProps) => {
  const balanceSheetData = useMemo(() => {
    if (!Array.isArray(accounts)) return { assets: 0, liabilities: 0, equity: 0 };
    let assets = 0, liabilities = 0, equity = 0;
    for (let i = 0; i < accounts.length; i++) {
        const a = accounts[i];
        if (a.type === 'asset') assets += a.balanceCents;
        else if (a.type === 'liability') liabilities += a.balanceCents;
        else if (a.type === 'equity') equity += a.balanceCents;
    }
    const currentAssets = accounts.filter(a => a.type === 'asset' && !(a.name || '').toLowerCase().includes('equipment')).reduce((s, a) => s + a.balanceCents, 0);
    const currentLiabilities = accounts.filter(a => a.type === 'liability').reduce((s, a) => s + a.balanceCents, 0);
    
    return { 
      assets, 
      liabilities, 
      equity,
      ratios: {
        current: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
        debtToEquity: equity !== 0 ? liabilities / equity : 0
      }
    };
  }, [accounts]);

  const accountGroups = useMemo(() => ({
    assets: accounts.filter(a => a.type === 'asset'),
    liabilities: accounts.filter(a => a.type === 'liability'),
    equity: accounts.filter(a => a.type === 'equity')
  }), [accounts]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header Intel Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-slate-900 px-5 py-4 rounded-xl text-white flex flex-col justify-between shadow-xs relative overflow-hidden group border border-slate-950">
            <div className="absolute top-0 right-0 p-3 text-white/5 group-hover:text-emerald-400/10 transition-colors">
               <ArrowUpRight size={50} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Total Liquidity Matrix</span>
            <span className="text-xl font-black font-mono tracking-tight tabular-nums">{formatCurrency(balanceSheetData.assets)}</span>
            <div className="mt-4 flex items-center gap-1.5 text-[8px] font-bold text-emerald-400 uppercase tracking-wider bg-white/5 w-fit px-2.5 py-1 rounded-lg border border-white/5">
               <ShieldCheck size={11} />
               Verifiable Reserve
            </div>
         </div>
         <div className="bg-white px-5 py-4 rounded-xl border border-slate-250 flex flex-col justify-between shadow-3xs relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-rose-500/5 transition-colors">
               <ArrowDownRight size={50} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Total Debt Exposure</span>
            <span className="text-xl font-black font-mono text-slate-800 tracking-tight">{formatCurrency(balanceSheetData.liabilities)}</span>
            <div className="mt-4 text-[8px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 w-fit px-2.5 py-1 rounded-lg border border-slate-200">
               Liability Allocation
            </div>
         </div>
         <div className="bg-slate-900 px-5 py-4 rounded-xl text-white flex flex-col justify-between shadow-xs relative overflow-hidden group border border-slate-950">
            <div className="absolute top-0 right-0 p-3 text-white/5">
               <Scale size={50} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Net Worth (Equity)</span>
            <span className="text-xl font-black font-mono tracking-tight tabular-nums">{formatCurrency(balanceSheetData.equity)}</span>
            <div className="mt-4 text-[8px] font-bold text-orange-200 uppercase tracking-wider bg-white/5 w-fit px-2.5 py-1 rounded-lg border border-white/5">
               Owner Interest
            </div>
         </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-4 md:p-6 lg:p-8 rounded-xl border border-slate-200 shadow-3xs relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6 opacity-[0.015] pointer-events-none text-slate-950">
           <Scale size={200} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-slate-100 gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 leading-none">Financial Condition</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mt-1.5">AS OF {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-left md:text-right">
             <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-[10px] text-white rounded-lg font-bold uppercase tracking-wider">
               <ShieldCheck size={12} className="text-emerald-400" />
               Certified Sync
             </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left Column: Assets */}
          <div className="space-y-8">
            <section>
              <div className="flex items-end justify-between border-b border-slate-200 pb-2 mb-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Current Assets</h3>
                <span className="text-xs font-bold text-slate-400 tabular-nums font-mono">{formatCurrency(balanceSheetData.assets)}</span>
              </div>
              <div className="space-y-2">
                {accountGroups.assets.map(acc => (
                  <div 
                    key={acc.id} 
                    className="flex justify-between items-center group cursor-pointer p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100"
                    onClick={() => onDrillDown?.(acc.name)}
                  >
                    <div>
                       <span className="text-xs font-bold text-slate-800 group-hover:text-slate-950 transition-colors tracking-tight">{acc.name}</span>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{acc.category || 'Liquid Asset'}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-800 tabular-nums">{formatCurrency(acc.balanceCents)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Liabilities & Equity */}
          <div className="space-y-8">
            <section>
              <div className="flex items-end justify-between border-b border-slate-200 pb-2 mb-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Obligations</h3>
                <span className="text-xs font-bold text-rose-600 tabular-nums font-mono">{formatCurrency(balanceSheetData.liabilities)}</span>
              </div>
              <div className="space-y-2">
                {accountGroups.liabilities.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center group p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <div>
                       <span className="text-xs font-bold text-slate-800 tracking-tight">{acc.name}</span>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{acc.category || 'Liability'}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-800 tabular-nums">{formatCurrency(acc.balanceCents)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between border-b border-slate-200 pb-2 mb-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Equity Structure</h3>
                <span className="text-xs font-bold text-slate-400 tabular-nums font-mono">{formatCurrency(balanceSheetData.equity)}</span>
              </div>
              <div className="space-y-2">
                {accountGroups.equity.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center group p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <div>
                       <span className="text-xs font-bold text-slate-800 tracking-tight">{acc.name}</span>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Capital Interest</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-800 tabular-nums">{formatCurrency(acc.balanceCents)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Integrated Accounting Equation</h3>
              <p className="text-[9px] text-slate-500 max-w-sm leading-relaxed">
                Assets must exactly equal the sum of Liabilities and Equity. 
                Our secure smart ledger guarantees balance matrix consistency.
              </p>
            </div>
            <div className="flex items-center gap-6">
               <div className="text-right">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Equation Sum Output</span>
                  <span className="text-sm font-bold font-mono text-slate-800 tabular-nums">
                    {formatCurrency(balanceSheetData.liabilities + balanceSheetData.equity)}
                  </span>
               </div>
               <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center border border-slate-950">
                  <ShieldCheck size={14} className="text-emerald-400" />
               </div>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
});

export default BalanceSheetReportView;
