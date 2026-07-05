import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, DollarSign, Users, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell, ReferenceLine, Legend } from 'recharts';

export default function PricingOptimizer() {
  const [currentPrice, setCurrentPrice] = useState(100);
  const [currentClients, setCurrentClients] = useState(50);
  const [increasePercent, setIncreasePercent] = useState(25);
  const [churnPercent, setChurnPercent] = useState(10);

  const currentRevenue = currentPrice * currentClients;
  const newPrice = currentPrice * (1 + increasePercent / 100);
  const newClients = Math.round(currentClients * (1 - churnPercent / 100));
  const newRevenue = newPrice * newClients;
  const revenueDifference = newRevenue - currentRevenue;

  const chartData = useMemo(() => {
    return [
      {
        name: 'Current State',
        revenue: currentRevenue,
        workload: currentClients,
        price: currentPrice
      },
      {
        name: 'Proposed State',
        revenue: newRevenue,
        workload: newClients,
        price: newPrice
      }
    ];
  }, [currentRevenue, newRevenue, currentClients, newClients, currentPrice, newPrice]);

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={24} className="text-indigo-600" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600">
              Pricing Optimization Engine
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Value Elasticity
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold max-w-2xl">
            "Don't be afraid to double your price. You might lose some clients, but you will work less and make more."
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Monthly Revenue</p>
            <h3 className="text-xl font-bold text-slate-850 font-mono tracking-tight">
              {currentRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 group-hover:scale-105 transition-transform">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projected Monthly Revenue</p>
            <h3 className="text-xl font-bold text-emerald-600 font-mono tracking-tight">
              {newRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workload Reduction</p>
            <h3 className="text-xl font-bold text-slate-850 font-mono tracking-tight">
              -{currentClients - newClients} Clients
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:scale-105 transition-transform">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-900 rounded-[32px] p-6 shadow-sm hover:shadow-lg transition-all flex items-center justify-between group text-white">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Net Revenue Difference</p>
            <h3 className={cn("text-xl font-black font-mono tracking-tight", revenueDifference > 0 ? "text-emerald-400" : "text-rose-400")}>
              {revenueDifference > 0 ? '+' : ''}{revenueDifference.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800 text-white border border-slate-700 group-hover:scale-105 transition-transform">
            <Activity size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-[32px]">
                <DollarSign size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Current State Calibration</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Define your base unit economics and volume</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[32px] border border-slate-200">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Current Unit Price ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                  <input 
                    type="number"
                    value={currentPrice || ''}
                    onChange={(e) => setCurrentPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-black font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Current Client Volume</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">#</span>
                  <input 
                    type="number"
                    value={currentClients || ''}
                    onChange={(e) => setCurrentClients(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-black font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-[32px]">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">The "What If" Scenario</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Model elasticity of demand against price hikes</p>
              </div>
            </div>

            <div className="space-y-8 bg-slate-50 p-6 rounded-[32px] border border-slate-200">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Price Increase (%)</label>
                  <span className="text-[10px] font-black text-indigo-600 font-mono">+{increasePercent}% = ${newPrice.toFixed(2)}</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="200"
                  step="5"
                  value={increasePercent}
                  onChange={(e) => setIncreasePercent(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estimated Client Churn (%)</label>
                  <span className="text-[10px] font-black text-rose-600 font-mono">-{churnPercent}% = {newClients} remaining</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={churnPercent}
                  onChange={(e) => setChurnPercent(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 flex flex-col">
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-6 flex-1 flex flex-col">
             <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
               <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-[32px] font-black">
                 <Activity size={20} />
               </div>
               <div>
                 <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Revenue & Workload Impact</h2>
                 <p className="text-[10px] text-slate-500 uppercase tracking-wide">Visualizing the outcome of your pricing strategy</p>
               </div>
             </div>

             <div className="h-[250px] w-full flex-1 min-h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                   <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `$${(val/1000).toFixed(0)}k`} />
                   <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `${val} clients`} />
                   <RechartsTooltip 
                     contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                     labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}
                     formatter={(value: number, name: string) => {
                       if (name === 'revenue') return [value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), 'Total Revenue'];
                       if (name === 'workload') return [value, 'Client Volume'];
                       return [value, name];
                     }}
                   />
                   <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', marginTop: '10px' }} />
                   <Bar yAxisId="left" dataKey="revenue" name="revenue" fill="#10b981" radius={[8, 8, 0, 0]} maxBarSize={60}>
                     {chartData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={index === 0 ? '#94a3b8' : '#10b981'} />
                     ))}
                   </Bar>
                   <Bar yAxisId="right" dataKey="workload" name="workload" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={60}>
                     {chartData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={index === 0 ? '#cbd5e1' : '#6366f1'} />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>

             <motion.div 
               className={cn(
                 "p-6 rounded-[32px] border flex items-center justify-between",
                 revenueDifference > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
               )}
             >
                <div>
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", revenueDifference > 0 ? "text-emerald-600" : "text-rose-600")}>
                    {revenueDifference > 0 ? "Net Positive Outcome" : "Net Negative Outcome"}
                  </span>
                  <h4 className={cn("text-lg font-black tracking-tight font-display uppercase mt-1", revenueDifference > 0 ? "text-emerald-800" : "text-rose-800")}>
                    {revenueDifference > 0 ? "Smart Move." : "Bad Math."}
                  </h4>
                </div>
                <div className="text-right">
                   <p className="text-xs font-bold leading-relaxed max-w-[200px]">
                     Make <strong className="font-mono text-sm">{Math.abs(revenueDifference).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</strong> {revenueDifference > 0 ? "MORE" : "LESS"} while doing {currentClients - newClients} LESS jobs.
                   </p>
                </div>
             </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

