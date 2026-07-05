import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { 
  Users, 
  UserPlus
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency } from '../../lib/utils';
import { 
  XAxis, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface CustomerInsightsProps {
  transactions: Transaction[];
  onAction: (action: string, details?: any) => void;
}

export default function CustomerInsights({ transactions, onAction }: CustomerInsightsProps) {
  const customerMetrics = useMemo(() => {
    const metrics: Record<string, any> = {};

    transactions.forEach(t => {
      // Look for income transactions
      const incomeLines = t.lines?.filter(l => l.amountCents > 0) || [];
      if (incomeLines.length === 0) return;

      const customerName = t.payee || 'Direct Sale';
      if (!metrics[customerName]) {
        metrics[customerName] = {
          name: customerName,
          totalValueCents: 0,
          orderCount: 0,
          history: []
        };
      }
      
      const val = incomeLines.reduce((s, l) => s + l.amountCents, 0);
      metrics[customerName].totalValueCents += val;
      metrics[customerName].orderCount += 1;
      metrics[customerName].history.push({ date: t.date, value: val / 100 });
    });

    return Object.values(metrics)
      .sort((a, b) => b.totalValueCents - a.totalValueCents)
      .map(c => ({
        ...c,
        avgTicket: c.totalValueCents / c.orderCount,
        clv: c.totalValueCents // Simplified Customer Lifetime Value
      }));
  }, [transactions]);

  const topCustomers = customerMetrics.slice(0, 5);

  return (
    <div className="space-y-12">
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate mb-4">
            <Users size={14} />
            Customer Capital Analytics
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Customer Matrix</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">High-fidelity analysis of revenue generation units and acquisition efficiency.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 p-4 md:p-10 bg-zinc-950 text-white rounded-[32px] shadow-2xl relative overflow-hidden flex flex-col justify-between">
           <div className="absolute technical-grid inset-0 opacity-[0.05] pointer-events-none" />
           <div className="space-y-2 relative z-10">
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate">Active Segments</span>
             <h3 className="text-2xl md:text-4xl font-black tracking-tighter">{customerMetrics.length} Profiles</h3>
           </div>
           <div className="pt-10 space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Growth Velocity</span>
                <span className="text-emerald-500 font-bold">MONITORING</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: '65%' }} />
              </div>
           </div>
        </div>

        <div className="lg:col-span-3 p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Revenue Concentration</h3>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-40">Cohort Verification Active</span>
            </div>
          </div>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={customerMetrics.slice(0, 10)}>
                   <defs>
                      <linearGradient id="customerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F172A" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#0F172A" stopOpacity={0}/>
                      </linearGradient>
                   </defs>
                   <XAxis dataKey="name" hide />
                   <Tooltip />
                   <Area type="monotone" dataKey="clv" stroke="#0F172A" strokeWidth={4} fill="url(#customerGrad)" />
                </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {customerMetrics.slice(0, 6).map((customer, i) => (
          <motion.div 
            key={customer.name}
            whileHover={{ y: -8 }}
            className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] hover:border-slate-800 transition-all group shadow-sm flex flex-col justify-between"
          >
             <div className="flex items-center justify-between mb-8">
               <div className="w-14 h-14 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                 <UserPlus size={26} />
               </div>
               <div className="text-right">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40">Lifetime Value</span>
                 <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(customer.totalValueCents)}</p>
               </div>
             </div>
             <div>
                <h4 className="text-xl font-black text-slate-900 leading-tight uppercase italic mb-6 break-words">{customer.name}</h4>
                <div className="grid grid-cols-2 gap-4 py-6 border-t border-slate-200">
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Frequency</p>
                      <p className="text-sm font-black text-slate-900">{customer.orderCount} Orders</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Avg Ticket</p>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(customer.avgTicket)}</p>
                   </div>
                </div>
             </div>
           </motion.div>
        ))}
      </div>
    </div>
  );
}
