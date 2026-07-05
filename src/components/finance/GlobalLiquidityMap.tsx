import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { Globe, Shield, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '../../lib/utils';

export default function GlobalLiquidityMap({ transactions }: { transactions: Transaction[] }) {
  const regions = useMemo(() => {
    const locMap: Record<string, number> = {};
    transactions.forEach(tx => {
      tx.lines?.forEach(line => {
        const loc = line.location || 'Unassigned';
        locMap[loc] = (locMap[loc] || 0) + Math.abs(line.amountCents || 0);
      });
    });

    const regions: any[] = [];

    const total = regions.reduce((sum, r) => sum + r.value, 0);
    if (total === 0 && transactions.length > 0) {
      regions[0].value = transactions.reduce((sum, t) => sum + Math.abs(t.totalAmountCents || 0), 0);
    }

    return regions;
  }, [transactions]);

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Globe size={24} className="text-slate-600" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              Global Liquidity Distribution
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Liquidity Map
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold max-w-2xl">
            Real-time geographic distribution of enterprise liquidity and exposure risk
          </p>
        </div>
        <div className="flex gap-4">
           <div className="px-6 py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-2">
              <Shield size={16} className="text-emerald-500" />
              Compliance Monitor Active
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-9 p-4 md:p-8 bg-slate-900 border border-slate-800 rounded-[32px] shadow-xl relative overflow-hidden group">
           <div className="absolute technical-grid inset-0 opacity-[0.03]" />
           
           <div className="relative h-[350px] md:h-[600px] w-full flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center opacity-20 transition-transform group-hover:scale-105 duration-1000 pointer-events-none">
                 <Globe size={500} className="text-white/10" strokeWidth={0.5} />
              </div>

               {regions.filter(r => r.value > 0).map((reg, i) => (
                <div 
                  key={i} 
                  className="absolute p-4 md:p-6 bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-[32px] hover:bg-slate-800 transition-all cursor-crosshair group/node shadow-xl shadow-slate-950/50"
                  style={{ top: `${reg.pos[0]}%`, left: `${reg.pos[1]}%` }}
                >
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{reg.name}</span>
                      <span className="text-lg md:text-2xl font-black text-white font-mono tracking-tight">{formatCurrency(reg.value)}</span>
                      
                      <div className="mt-3 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(1 - reg.risk) * 100}%` }} />
                      </div>
                      
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full animate-ping opacity-60" />
                   </div>
                </div>
              ))}

              <svg className="absolute inset-0 pointer-events-none opacity-20">
                 <path d="M 200 300 Q 400 100 600 300" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="4,8" className="animate-[dash_20s_linear_infinite]" />
                 <path d="M 300 400 Q 500 600 700 400" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="4,8" className="animate-[dash_15s_linear_infinite]" />
              </svg>
           </div>
        </div>

        <div className="lg:col-span-3 space-y-6 flex flex-col">
           <div className="p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm flex-1">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate mb-8">Exposure Metrics</h3>
              <div className="space-y-8">
                 {regions.filter(r => r.value > 0).map((reg, i) => (
                   <div key={i} className="space-y-3">
                      <div className="flex justify-between items-baseline">
                         <span className="text-[11px] font-black uppercase tracking-tight text-slate-800">{reg.name}</span>
                         <span className="text-[9px] font-black text-slate-400 font-mono">Risk: {(reg.risk * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${(reg.value / Math.max(1, regions[0].value)) * 100}%` }}
                           className="h-full bg-slate-800 rounded-full" 
                         />
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="p-8 bg-indigo-600 text-white rounded-[32px] shadow-xl relative overflow-hidden group border border-indigo-700 flex-1">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
                 <Zap size={100} />
              </div>
              <div className="relative z-10 flex flex-col h-full">
                 <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">System Update</span>
                 <p className="mt-4 text-lg font-black tracking-tight leading-snug">
                    Market volatility detected in specific regions. Ensure hedging strategies are aligned with jurisdictional requirements.
                 </p>
                 <button className="mt-auto pt-8 px-6 py-4 bg-white text-indigo-700 rounded-[32px] text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-md active:scale-95 text-center flex items-center justify-center w-full">
                    Review Exposure
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
