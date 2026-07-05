import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DollarSign, Clock, Users, ArrowDownRight, AlertTriangle, TrendingDown, Target, Zap, Waves } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';

export default function BusinessOxygen() {
  const { accounts, transactions } = useLedgerStore();
  
  const cashAccounts = accounts.filter(a => a.type === 'asset' && a.subtype === 'cash').reduce((a, b) => a + b.balanceCents, 0);
  const arAccounts = accounts.filter(a => a.type === 'asset' && a.subtype === 'accounts_receivable').reduce((a, b) => a + b.balanceCents, 0);
  const apAccounts = accounts.filter(a => a.type === 'liability' && a.subtype === 'accounts_payable').reduce((a, b) => a + b.balanceCents, 0);

  // Simulated historical cashflow projection based on past transactions
  const burnRateCents = transactions.slice(0, 30).reduce((acc, t) => acc + (t.status === 'completed' ? 150000 : 0), 0) || 500000;
  const runwayMonths = cashAccounts > 0 ? (cashAccounts / burnRateCents) : 0;

  const projectionData = Array.from({ length: 12 }).map((_, i) => {
    const month = new Date();
    month.setMonth(month.getMonth() + i);
    const projectedCash = Math.max(0, (cashAccounts / 100) - ((burnRateCents / 100) * i));
    const projectedARCollection = (arAccounts / 100) * (Math.exp(-i/3));
    return {
      name: month.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
      cash: projectedCash,
      trapped: projectedARCollection
    };
  });

  const agingData: any[] = [];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2 block">Survival Matrix</span>
           <h2 className="text-3xl md:text-5xl font-black text-slate-800 uppercase italic tracking-tighter leading-none flex items-center gap-4">
             <Waves className="text-indigo-600" size={40} />
             Oxygen / Cashflow
           </h2>
        </div>
        <div className="px-6 py-3 bg-slate-50 border border-slate-200 rounded-full flex items-center gap-3">
           <div className={cn(
             "w-2.5 h-2.5 rounded-full animate-pulse",
             runwayMonths > 6 ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-orange-500 shadow-[0_0_8px_#f97316]"
           )} />
           <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
             {runwayMonths > 6 ? 'Stable Runway' : 'Critical Runway Warning'}
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start mb-12">
            <div>
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Liquid Oxygen</h3>
               <p className="text-xs font-bold text-emerald-600">Total Cash Reserves</p>
            </div>
            <div className="w-12 h-12 rounded-[32px] bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
               <DollarSign size={24} />
            </div>
          </div>
          <div>
            <span className="text-4xl md:text-5xl font-light font-mono text-slate-900 tracking-tighter">{formatCurrency(cashAccounts)}</span>
            <div className="flex items-center gap-2 mt-4">
               <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">
                 + Active Selling
               </span>
               <span className="text-[10px] font-medium text-slate-400">Oxygen is good.</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-500/30 transition-all"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start mb-12">
            <div>
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Trapped Energy</h3>
               <p className="text-xs font-bold text-rose-600">Accounts Receivable</p>
            </div>
            <div className="w-12 h-12 rounded-[32px] bg-rose-500/10 text-rose-600 flex items-center justify-center border border-rose-500/20">
               <Clock size={24} />
            </div>
          </div>
          <div>
            <span className="text-4xl md:text-5xl font-light font-mono text-slate-900 tracking-tighter">{formatCurrency(arAccounts)}</span>
            <div className="flex items-center gap-2 mt-4">
               <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-rose-100 flex items-center gap-1">
                 <AlertTriangle size={10} /> Call Today
               </span>
               <span className="text-[10px] font-medium text-slate-400">Don't be a frier.</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-500/30 transition-all"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start mb-12">
            <div>
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Obligations</h3>
               <p className="text-xs font-bold text-indigo-600">Accounts Payable</p>
            </div>
            <div className="w-12 h-12 rounded-[32px] bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-500/20">
               <ArrowDownRight size={24} />
            </div>
          </div>
          <div>
            <span className="text-4xl md:text-5xl font-light font-mono text-slate-900 tracking-tighter">{formatCurrency(apAccounts)}</span>
            <div className="flex items-center gap-2 mt-4">
               <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-100">
                 Pay On Time
               </span>
               <span className="text-[10px] font-medium text-slate-400">Maintain vendors.</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-8">
             <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Runway Projection</h3>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">Cash Burn vs Expected Collections (12 Months)</p>
             </div>
             <div className="flex flex-col items-end">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estimated Runway</span>
               <span className={cn("text-xl font-black italic", runwayMonths > 6 ? "text-emerald-500" : "text-orange-500")}>
                 {runwayMonths.toFixed(1)} Months
               </span>
             </div>
           </div>
           
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                   </linearGradient>
                   <linearGradient id="colorTrapped" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `$${(val/1000).toFixed(0)}k`} />
                 <Tooltip 
                   cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                   labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}
                   formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, undefined]}
                 />
                 <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }} />
                 <Area type="monotone" dataKey="cash" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCash)" name="Available Cash" />
                 <Area type="monotone" dataKey="trapped" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorTrapped)" name="Trapped AR" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-8">
             <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Aging Buckets</h3>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">Accounts Receivable vs Accounts Payable (30/60/90)</p>
             </div>
           </div>
           
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={agingData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={8}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `$${(val/1000).toFixed(0)}k`} />
                 <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                   labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}
                   formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, undefined]}
                 />
                 <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }} />
                 <Bar dataKey="ar" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} name="Receivables (They Owe)" />
                 <Bar dataKey="ap" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} name="Payables (You Owe)" />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[32px] p-8 md:p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.2),transparent_50%)] pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-4 flex items-center gap-3">
            <Users className="text-indigo-400" size={28} />
            Top Friers (Call List)
          </h3>
          {arAccounts > 0 ? (
             <div className="max-w-2xl space-y-6">
                <p className="text-sm font-medium text-slate-300 leading-relaxed italic">
                   Based on your Accounts Receivable pool of <strong className="text-rose-400 font-mono text-lg">{formatCurrency(arAccounts)}</strong>, review your aging ledger to identify overdue invoices and follow up manually.
                </p>
                <div className="flex flex-wrap gap-4 mt-6">
                  <button className="px-6 py-3 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                    Generate Call Scripts
                  </button>
                  <button className="px-6 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all border border-slate-700">
                    Export Aging Report
                  </button>
                </div>
             </div>
          ) : (
             <div className="p-8 bg-slate-800/50 rounded-[32px] border border-slate-700/50 inline-block">
                <p className="text-emerald-400 font-bold tracking-wide flex items-center gap-2">
                   <Target size={20} />
                   No one currently owes you money! Beautiful. Keep selling.
                </p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
