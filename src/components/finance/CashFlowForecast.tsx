
import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Target,
  Activity,
  Zap,
  Info
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

interface CashFlowForecastProps {
  currentCashCents: number;
  monthlyBurnCents: number;
  monthlyRevenueCents: number;
}

export default function CashFlowForecast({ currentCashCents, monthlyBurnCents, monthlyRevenueCents }: CashFlowForecastProps) {
  const forecastData = useMemo(() => {
    const data = [];
    let runningBalance = currentCashCents;
    const netMonthly = monthlyRevenueCents - monthlyBurnCents;
    
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      data.push({
        month: date.toLocaleString('default', { month: 'short' }),
        balance: runningBalance / 100,
        net: netMonthly / 100,
      });
      runningBalance += netMonthly;
    }
    return data;
  }, [currentCashCents, monthlyBurnCents, monthlyRevenueCents]);

  const runwayMonths = monthlyBurnCents > monthlyRevenueCents 
    ? Math.floor(currentCashCents / (monthlyBurnCents - monthlyRevenueCents)) 
    : 99;

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-2xl">
      <div className="p-4 md:p-10 border-b border-slate-200">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#38bdf8]/10 text-indigo-600 border border-[#38bdf8]/20 rounded-[32px] flex items-center justify-center shadow-xl">
                 <TrendingUp size={24} />
              </div>
              <div className="flex flex-col">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-slate-900">12-Month Cash Forecast</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate mt-2 opacity-50">Liquidity Pathway Analysis</p>
              </div>
           </div>
           <div className="flex gap-4">
              <div className="px-6 py-2 bg-slate-50 rounded-xl border border-slate-200">
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Projected Runway</p>
                 <p className={cn(
                   "text-lg font-black italic tracking-tighter",
                   runwayMonths < 6 ? "text-rose-400" : "text-emerald-400"
                 )}>
                    {runwayMonths === 99 ? '99+ Months' : `${runwayMonths} Months`}
                 </p>
              </div>
           </div>
        </div>
      </div>

      <div className="p-4 md:p-10 space-y-10">
         <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 900, fill: '#8B949E' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 900, fill: '#8B949E' }}
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#161b22', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 900, color: '#f0f6fc' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#38bdf8" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorBalance)" 
                  />
               </AreaChart>
            </ResponsiveContainer>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-4 md:p-8 bg-slate-50/20 border border-slate-200 rounded-[32px] flex flex-col justify-between group hover:border-[#38bdf8]/40 transition-all">
               <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                     <TrendingUp size={20} />
                  </div>
                  <Target size={16} className="text-slate-500 opacity-20" />
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Monthly Inflow</p>
                  <p className="text-3xl font-black text-slate-900 italic tracking-tighter">{formatCurrency(monthlyRevenueCents)}</p>
               </div>
            </div>

            <div className="p-4 md:p-8 bg-slate-50/20 border border-slate-200 rounded-[32px] flex flex-col justify-between group hover:border-[#38bdf8]/40 transition-all">
               <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-400">
                     <TrendingDown size={20} />
                  </div>
                  <Activity size={16} className="text-slate-500 opacity-20" />
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Monthly Outflow</p>
                  <p className="text-3xl font-black text-slate-900 italic tracking-tighter">{formatCurrency(monthlyBurnCents)}</p>
               </div>
            </div>

            <div className="p-4 md:p-8 bg-gradient-to-br from-[#121c2c] to-[#040810] text-[#f0f6fc] border border-slate-200 rounded-[32px] flex flex-col justify-between relative overflow-hidden group shadow-xl">
               <div className="absolute technical-grid inset-0 opacity-[0.05]" />
               <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 bg-[#34d399]/15 rounded-xl flex items-center justify-center text-[#34d399] border border-[#34d399]/20">
                     <Zap size={20} />
                  </div>
                  <Info size={16} className="text-white/20" />
               </div>
               <div className="relative z-10">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Current Net Velocity</p>
                  <p className={cn(
                     "text-3xl font-black italic tracking-tighter",
                     (monthlyRevenueCents - monthlyBurnCents) >= 0 ? "text-emerald-400" : "text-rose-400"
                   )}>
                     {formatCurrency(monthlyRevenueCents - monthlyBurnCents)}
                  </p>
               </div>
            </div>
         </div>
      </div>

      <div className="p-4 md:p-8 bg-slate-50/40 border-t border-slate-200 flex items-center gap-4">
         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Projection based on weighted 90-day moving average historical data.</p>
      </div>
    </div>
  );
}
