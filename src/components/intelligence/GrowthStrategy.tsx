import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Megaphone, CheckCircle, Plus, PieChart, Users, ArrowUpRight, TrendingUp, Compass, Zap } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';

export default function GrowthStrategy() {
  const { transactions } = useLedgerStore();
  
  const [campaigns, setCampaigns] = useState<{ id: string, name: string, spend: number, clients: number, revenue: number, status: 'active' | 'paused' }[]>([
    { id: '1', name: 'Google Search Ads', spend: 450000, clients: 12, revenue: 1500000, status: 'active' },
    { id: '2', name: 'LinkedIn Outreach', spend: 120000, clients: 3, revenue: 600000, status: 'active' },
    { id: '3', name: 'Facebook Retargeting', spend: 200000, clients: 8, revenue: 350000, status: 'paused' },
    { id: '4', name: 'Direct Mail (Q3)', spend: 350000, clients: 1, revenue: 100000, status: 'paused' }
  ]);

  const totalCampaignSpend = campaigns.reduce((a, b) => a + b.spend, 0);
  const totalCampaignRevenue = campaigns.reduce((a, b) => a + b.revenue, 0); 
  const totalClients = campaigns.reduce((a, b) => a + b.clients, 0);
  
  const overallRoi = totalCampaignSpend > 0 ? (totalCampaignRevenue / totalCampaignSpend).toFixed(1) : '0.0';
  const overallCpa = totalClients > 0 ? (totalCampaignSpend / totalClients) : 0;
  const overallLtv = totalClients > 0 ? (totalCampaignRevenue / totalClients) : 0;

  const chartData = campaigns.map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
    spend: c.spend / 100,
    revenue: c.revenue / 100,
    roi: c.spend > 0 ? Number((c.revenue / c.spend).toFixed(1)) : 0,
    cpa: c.clients > 0 ? (c.spend / c.clients) / 100 : 0,
    clients: c.clients
  }));

  const addCampaign = () => {
    const name = prompt("Enter Campaign Name:");
    if (!name) return;
    const spend = Number(prompt("Marketing Spend ($):") || 0);
    const clients = Number(prompt("New Clients Acquired:") || 0);
    const revenue = Number(prompt("Revenue Generated ($):") || 0);
    
    setCampaigns(prev => [...prev, {
      id: crypto.randomUUID(),
      name,
      spend: spend * 100,
      clients,
      revenue: revenue * 100,
      status: 'active'
    }]);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2 block">Acquisition Engine</span>
           <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase italic tracking-tighter leading-none flex items-center gap-4">
             <Target className="text-indigo-600" size={40} />
             Growth Matrix
           </h2>
        </div>
        <button 
          onClick={addCampaign}
          className="px-6 py-3 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-2"
        >
          <Plus size={14} /> Add Campaign Tracker
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            Total Capital Deployed
          </h3>
          <p className="text-3xl font-light font-mono text-slate-900 tracking-tight">{formatCurrency(totalCampaignSpend)}</p>
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
             <Megaphone size={40} className="text-slate-500" />
          </div>
        </motion.div>

        <motion.div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
          <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
            Realized Revenue
          </h3>
          <p className="text-3xl font-light font-mono text-emerald-600 tracking-tight">{formatCurrency(totalCampaignRevenue)}</p>
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
             <TrendingUp size={40} className="text-emerald-500" />
          </div>
        </motion.div>

        <motion.div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
          <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
            System ROI Multiplier
          </h3>
          <p className="text-3xl font-black text-slate-900 tracking-tight italic">{overallRoi}x</p>
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
             <PieChart size={40} className="text-indigo-500" />
          </div>
        </motion.div>

        <motion.div className="bg-slate-900 rounded-[32px] p-6 border border-slate-800 shadow-xl relative overflow-hidden group">
          <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
            Global CPA (Cost Per Client)
          </h3>
          <p className="text-3xl font-light font-mono text-white tracking-tight">{formatCurrency(overallCpa)}</p>
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-30 transition-opacity">
             <Users size={40} className="text-indigo-600" />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
           <div className="mb-8">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Spend vs Revenue Topology</h3>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">Campaign impact visualization</p>
           </div>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={8}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `$${(val/1000).toFixed(0)}k`} />
                 <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                   labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}
                   formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                 />
                 <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }} />
                 <Bar dataKey="spend" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} name="Capital Deployed" />
                 <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} name="Revenue Generated" />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
           <div className="mb-8">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Client Acquisition Scatter</h3>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">CPA vs ROI Quadrants</p>
           </div>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                 <XAxis type="number" dataKey="cpa" name="CPA" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `$${val}`} />
                 <YAxis type="number" dataKey="roi" name="ROI" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} tickFormatter={val => `${val}x`} />
                 <ZAxis type="number" dataKey="clients" range={[100, 500]} name="Clients" />
                 <Tooltip 
                   cursor={{ strokeDasharray: '3 3' }}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                   labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a' }}
                 />
                 <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }} />
                 <Scatter name="Campaign Nodes" data={chartData} fill="#3b82f6">
                   {chartData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.roi >= 2 ? '#10b981' : entry.roi >= 1 ? '#f59e0b' : '#ef4444'} />
                   ))}
                 </Scatter>
               </ScatterChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Campaign Engine</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Manual node tracking</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          {campaigns.length === 0 ? (
            <div className="text-center p-16">
               <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">No Data Vectors Available</p>
               <button onClick={addCampaign} className="px-6 py-3 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-md inline-flex items-center gap-2">
                 <Plus size={14} /> Initialize Tracking
               </button>
            </div>
          ) : (
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Campaign Node</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Capital Spend</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Client Yield</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">CPA</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Generated Revenue</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Status / ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {campaigns.map(c => {
                const campRoi = c.spend > 0 ? c.revenue / c.spend : 0;
                const campCpa = c.clients > 0 ? c.spend / c.clients : 0;
                return (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-[32px] border border-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                        <Compass size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 tracking-tight flex items-center gap-2">
                           {c.name}
                           {c.status === 'paused' && <span className="px-2 py-0.5 rounded bg-slate-200 text-[8px] uppercase tracking-widest text-slate-500">Paused</span>}
                        </span>
                        <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase tracking-widest">Active Node</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right font-mono text-slate-600 font-bold text-sm">{formatCurrency(c.spend)}</td>
                  <td className="px-8 py-5 text-right font-mono text-indigo-600 font-bold text-sm">{c.clients}</td>
                  <td className="px-8 py-5 text-right font-mono text-orange-500 font-bold text-sm">{formatCurrency(campCpa)}</td>
                  <td className="px-8 py-5 text-right font-mono text-emerald-500 font-bold text-sm">{formatCurrency(c.revenue)}</td>
                  <td className="px-8 py-5 text-right">
                    <span className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm border",
                      campRoi >= 2 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : campRoi >= 1 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-rose-50 text-rose-600 border-rose-200"
                    )}>
                      {campRoi.toFixed(1)}x Yield
                    </span>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          )}
        </div>
      </div>
      
      {/* Automation Actions */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-8 md:p-12">
         <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-8 flex items-center gap-3">
            <Zap className="text-amber-500" size={24} />
            Strategic Directives
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.filter(c => c.spend > 0 && c.revenue / c.spend < 1).map(c => (
              <div key={c.id} className="p-6 bg-rose-50/50 border border-rose-100 rounded-[32px] flex flex-col justify-between">
                 <div>
                    <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3">Critical Warning</h4>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                       The <strong>{c.name}</strong> campaign is yielding a negative ROI ({(c.revenue/c.spend).toFixed(1)}x). Recommend immediate termination to conserve capital.
                    </p>
                 </div>
                 <button className="mt-6 w-full py-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-50 transition-all">
                    Execute Termination
                 </button>
              </div>
            ))}
            <div className="p-6 bg-white border border-slate-200 rounded-[32px] flex flex-col justify-between group hover:border-slate-300 transition-all">
               <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 group-hover:text-indigo-600 transition-colors">Action Protocol</h4>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                     Send physical gift baskets to the top 5 referring clients this quarter. Referrals consistently yield a 0.00 CPA.
                  </p>
               </div>
               <button className="mt-6 w-full py-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all">
                  Generate Dispatch List
               </button>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-[32px] flex flex-col justify-between group hover:border-slate-300 transition-all">
               <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 group-hover:text-indigo-600 transition-colors">Action Protocol</h4>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                     Manually call all leads generated in the last 72 hours. Phone conversions currently outperform email sequencing by 3.2x.
                  </p>
               </div>
               <button className="mt-6 w-full py-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all">
                  Open Call Queue
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
