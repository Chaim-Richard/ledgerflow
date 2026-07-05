import React, { useState, useMemo } from 'react';
import { Clock, AlertCircle, PieChart, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { differenceInDays } from 'date-fns';

interface AgingData {
  current: number;
  "1-30": number;
  "31-60": number;
  "61-90": number;
  "90+": number;
  total: number;
}

interface AgingReportProps {
  workspaceId: string;
}

const AgingReport: React.FC<AgingReportProps> = ({ workspaceId }) => {
  const { invoices, bills } = useLedgerStore();
  const [activeTab, setActiveTab] = useState<'ar' | 'ap'>('ar');

  const arData = useMemo(() => {
    const aging: AgingData = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0, total: 0 };
    if (!Array.isArray(invoices)) return aging;

    const today = new Date();
    invoices.forEach(inv => {
      if (inv.status === 'paid') return;
      const balance = inv.amountCents || 0;
      if (balance <= 0) return;

      const dueDate = new Date(inv.dueDate);
      const diffDays = differenceInDays(today, dueDate);

      if (diffDays <= 0) aging.current += balance;
      else if (diffDays <= 30) aging["1-30"] += balance;
      else if (diffDays <= 60) aging["31-60"] += balance;
      else if (diffDays <= 90) aging["61-90"] += balance;
      else aging["90+"] += balance;

      aging.total += balance;
    });
    return aging;
  }, [invoices]);

  const apData = useMemo(() => {
    const aging: AgingData = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0, total: 0 };
    if (!Array.isArray(bills)) return aging;

    const today = new Date();
    bills.forEach(bill => {
      if (bill.status === 'paid') return;
      const balance = bill.amountCents || 0;
      if (balance <= 0) return;

      const dueDate = new Date(bill.dueDate);
      const diffDays = differenceInDays(today, dueDate);

      if (diffDays <= 0) aging.current += balance;
      else if (diffDays <= 30) aging["1-30"] += balance;
      else if (diffDays <= 60) aging["31-60"] += balance;
      else if (diffDays <= 90) aging["61-90"] += balance;
      else aging["90+"] += balance;

      aging.total += balance;
    });
    return aging;
  }, [bills]);

  const formatCurrency = (cents: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);

  const data = activeTab === 'ar' ? arData : apData;

  const chartData: any[] = [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-[32px] w-fit border border-slate-200">
        <button 
          onClick={() => setActiveTab('ar')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer",
            activeTab === 'ar' ? "bg-indigo-600 text-white shadow-lg shadow-ledger-accent/20" : "text-slate-500/40 hover:text-slate-900"
          )}
        >
          Accounts Receivable (A/R)
        </button>
        <button 
          onClick={() => setActiveTab('ap')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer",
            activeTab === 'ap' ? "bg-indigo-600 text-white shadow-lg shadow-ledger-accent/20" : "text-slate-500/40 hover:text-slate-900"
          )}
        >
          Accounts Payable (A/P)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-4 md:p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-xs italic">Aging Distribution Matrix</h3>
              <p className="text-[10px] font-black text-slate-500/40 uppercase tracking-widest mt-1">Temporal mapping of outstanding liquidity</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-black text-slate-500 uppercase tracking-widest">
              <Clock size={14} className="text-indigo-600" />
              <span>Due Date Anchor</span>
            </div>
          </div>
          
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e1e1e" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }} 
                  tickFormatter={(val) => `$${val}`} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ backgroundColor: '#131314', borderRadius: '24px', border: '1px solid #27272a', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 900, marginBottom: '8px', opacity: 0.4, textTransform: 'uppercase' }}
                  formatter={(val: number) => [`$${val.toLocaleString()}`, 'Resonance']}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 p-4 md:p-8 rounded-[40px] text-white shadow-2xl shadow-ledger-accent/20 border border-indigo-600/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 md:p-8 opacity-10 group-hover:scale-110 transition-transform">
              <ArrowUpRight size={140} />
            </div>
            <p className="text-white/60 text-[10px] font-black mb-1 uppercase tracking-[0.3em]">Total Outstanding</p>
            <p className="text-3xl md:text-5xl font-black italic tracking-tighter">{formatCurrency(data.total)}</p>
            <div className="mt-8 pt-8 border-t border-slate-50/10 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">Risky Exposure (30+)</p>
                <p className="text-xl font-black italic">
                  {formatCurrency(data["31-60"] + data["61-90"] + data["90+"])}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-50/10 rounded-[32px] flex items-center justify-center backdrop-blur-sm border border-slate-50/10">
                <PieChart size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 md:p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] opacity-40">Aging Buckets</h4>
            <div className="space-y-4">
              {chartData.map((bucket) => (
                <div key={bucket.name} className="flex items-center justify-between group/item">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: bucket.color }} />
                    <span className="text-sm font-black text-slate-500 group-hover/item:text-slate-900 transition-colors uppercase tracking-tight italic">{bucket.name}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {formatCurrency(bucket.value * 100)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-rose-500/5 border border-rose-500/20 p-6 rounded-[32px] flex items-start gap-4">
        <div className="w-12 h-12 rounded-[32px] bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
          <AlertCircle size={24} />
        </div>
        <div>
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] mb-1 italic">Forensic Integrity Insight</p>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            {data["90+"] > 0 
              ? `Strategic Alert: You have ${formatCurrency(data["90+"])} that is more than 90 days overdue. This represents a critical resonance violation of your cash flow topology.`
              : "Operational Equilibrium Maintained: Your aging distribution is healthy. Most items are within the active or low-risk buckets."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgingReport;
