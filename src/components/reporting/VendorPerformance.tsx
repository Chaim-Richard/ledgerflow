import React, { useMemo } from 'react';
import { Transaction, Vendor } from '../../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Building2, 
  Activity,
  Target
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../../lib/utils';

interface VendorPerformanceProps {
  transactions: Transaction[];
  vendors: Vendor[];
  onAction: (action: string, details?: any) => void;
}

export default function VendorPerformance({ transactions, vendors, onAction }: VendorPerformanceProps) {
  const vendorMetrics = useMemo(() => {
    const metrics: Record<string, any> = {};

    transactions.forEach(t => {
      const vendorName = t.payee || 'Unknown';
      if (!metrics[vendorName]) {
        metrics[vendorName] = {
          name: vendorName,
          totalSpendCents: 0,
          transactionCount: 0,
          amounts: [],
          dates: [],
          categories: new Set<string>()
        };
      }
      
      const amt = Math.abs(t.totalAmountCents);
      metrics[vendorName].totalSpendCents += amt;
      metrics[vendorName].transactionCount += 1;
      metrics[vendorName].amounts.push(amt);
      metrics[vendorName].dates.push(new Date(t.date));
      t.lines?.forEach(l => metrics[vendorName].categories.add(l.accountName));
    });

    return Object.values(metrics)
      .map(v => {
        const avg = v.totalSpendCents / v.transactionCount;
        const variance = v.amounts.reduce((acc: number, val: number) => acc + Math.pow(val - avg, 2), 0) / v.transactionCount;
        const volatility = Math.sqrt(variance) / (avg || 1);
        
        return {
          ...v,
          averageSpendCents: avg,
          volatility: Number(volatility.toFixed(2)),
          categories: Array.from(v.categories),
          healthScore: Math.max(0, Math.min(100, 100 - (volatility * 20) + (v.transactionCount > 5 ? 20 : 0)))
        };
      })
      .sort((a, b) => b.totalSpendCents - a.totalSpendCents);
  }, [transactions]);

  const chartData = vendorMetrics.slice(0, 10).map(v => ({
    name: v.name,
    spend: v.totalSpendCents / 100,
    volatility: v.volatility * 100
  }));

  const COLORS = ['#F97316', '#10B981', '#6366F1', '#EC4899', '#8B5CF6', '#3B82F6'];

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate mb-4">
            <Target size={14} />
            Supply Chain Intelligence
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Vendor Matrix</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">Behavioral analysis of organizational spending patterns and vendor reliability.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Spending Chart */}
        <div className="lg:col-span-2 p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Top Capital Inflow</h3>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-600" />
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Spend Intensity</span>
               </div>
            </div>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F7" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#667085' }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-4 rounded-[32px] shadow-2xl border border-white/10">
                          <p className="text-[10px] font-medium uppercase tracking-wider mb-1 opacity-40">{payload[0].payload.name}</p>
                          <p className="text-xl font-black">{formatCurrency(payload[0].value as number * 100)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="spend" radius={[8, 8, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volatility Index */}
        <div className="p-4 md:p-10 bg-zinc-950 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-[0.05] pointer-events-none" />
          <div className="relative z-10 space-y-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider truncate text-zinc-500">Stability Index</span>
              <Activity size={24} className="text-indigo-600" />
            </div>
            
            <div className="space-y-6">
              {vendorMetrics.slice(0, 5).map((v, i) => (
                <div key={v.name} className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
                    <span>{v.name}</span>
                    <span className={cn(v.volatility > 0.5 ? "text-rose-500" : "text-emerald-500")}>
                      {v.healthScore.toFixed(0)}% Stability
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${v.healthScore}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        v.healthScore > 70 ? "bg-emerald-500" : v.healthScore > 40 ? "bg-amber-500" : "bg-rose-500"
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-white/5">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] leading-relaxed">
                Aggregated volatility measures variance in invoice frequency and unit cost deviation.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {vendorMetrics.slice(0, 9).map((vendor, i) => (
          <motion.div 
            key={vendor.name}
            whileHover={{ y: -5 }}
            className="p-4 md:p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.02] group-hover:opacity-[0.08] transition-all">
               <Building2 size={120} />
            </div>
            
            <div className="flex items-center justify-between mb-8">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all">
                <Building2 size={20} />
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] opacity-40">Total Volume</span>
                <p className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(vendor.totalSpendCents)}</p>
              </div>
            </div>

            <h4 className="text-xl font-black text-slate-900 tracking-tight uppercase italic mb-6 truncate pr-10">{vendor.name}</h4>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-200/50">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">Frequency</span>
                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{vendor.transactionCount} Cycles</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-200/50">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">Primary Domain</span>
                <span className="text-xs font-black text-indigo-600 uppercase tracking-tight">{vendor.categories[0] || 'Unsorted'}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">Risk Pulse</span>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", vendor.volatility < 0.3 ? "bg-emerald-500" : vendor.volatility < 0.6 ? "bg-amber-500" : "bg-rose-500")} />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{vendor.volatility < 0.4 ? 'Low' : 'Dynamic'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
