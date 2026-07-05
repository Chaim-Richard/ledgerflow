import React, { useMemo } from 'react';
import { Project, Transaction } from '../../types';
import { 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  Briefcase,
  TrendingUp,
  TrendingDown,
  Activity as Pulse,
  ChevronRight,
  Filter,
  BarChart3
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

interface ConsolidatedLedgerProps {
  projects: Project[];
  transactions: Transaction[];
  onAction: (action: string, details?: any) => void;
}

export default function ConsolidatedLedger({ projects, transactions, onAction }: ConsolidatedLedgerProps) {
  const consolidatedMetrics = useMemo(() => {
    return projects.map(p => {
      const projectTxs = transactions.filter(t => t.project === p.id);
      const revenue = projectTxs.filter(t => t.totalAmountCents > 0).reduce((s, t) => s + t.totalAmountCents, 0);
      const expenses = projectTxs.filter(t => t.totalAmountCents < 0).reduce((s, t) => s + Math.abs(t.totalAmountCents), 0);
      const net = revenue - expenses;
      
      return {
        id: p.id,
        name: p.name,
        revenue,
        expenses,
        net,
        count: projectTxs.length,
        status: p.status || 'Active'
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [projects, transactions]);

  const totals = useMemo(() => {
    return consolidatedMetrics.reduce((acc, curr) => ({
      rev: acc.rev + curr.revenue,
      exp: acc.exp + curr.expenses,
      net: acc.net + curr.net,
      txCount: acc.txCount + curr.count
    }), { rev: 0, exp: 0, net: 0, txCount: 0 });
  }, [consolidatedMetrics]);

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate mb-4">
            <Layers size={14} />
            Enterprise Synthesis
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Consolidated Ledger</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">Aggregate view across all architectural project clusters.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {[
          { label: 'Total Enterprise Revenue', value: totals.rev, icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Aggregate Burn Rate', value: totals.exp, icon: TrendingDown, color: 'text-rose-500' },
          { label: 'Consolidated Position', value: totals.net, icon: Pulse, color: 'text-indigo-600' },
          { label: 'Active Clusters', value: projects.length, icon: Layers, color: 'text-indigo-500', isRaw: true },
        ].map((stat, i) => (
          <div key={i} className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
               <stat.icon size={48} />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40">{stat.label}</span>
            <p className={cn("text-3xl font-black tracking-tighter mt-4", stat.color)}>
              {stat.isRaw ? stat.value : formatCurrency(stat.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden mb-12">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Project Performance Matrix</h3>
          <div className="flex gap-2">
            <button className="p-3 bg-slate-50 rounded-xl text-slate-900 hover:bg-slate-900 hover:text-white transition-all">
              <Filter size={16} />
            </button>
            <button className="p-3 bg-slate-50 rounded-xl text-slate-900 hover:bg-slate-900 hover:text-white transition-all">
              <BarChart3 size={16} />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-6 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Entity Cluster</th>
                <th className="pb-6 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Revenue Intensity</th>
                <th className="pb-6 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Burn Coefficient</th>
                <th className="pb-6 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 text-right">Net Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ledger-line/50">
              {consolidatedMetrics.map((m, i) => (
                <tr key={m.id} className="group hover:bg-slate-50/30 transition-colors">
                  <td className="py-8 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-900 group-hover:bg-white transition-all">
                        <Briefcase size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 tracking-tight uppercase italic">{m.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider opacity-40">{m.count} Transactions</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-8 px-4">
                    <p className="text-sm font-black text-emerald-500 tabular-nums">{formatCurrency(m.revenue)}</p>
                    <div className="w-24 h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                       <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (m.revenue / totals.rev) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="py-8 px-4">
                    <p className="text-sm font-black text-rose-500 tabular-nums">{formatCurrency(m.expenses)}</p>
                    <div className="w-24 h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                       <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, (m.expenses / totals.exp) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="py-8 px-4 text-right">
                    <div className="inline-flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl group-hover:bg-white transition-all">
                      <span className={cn("text-sm font-black tabular-nums", m.net > 0 ? "text-emerald-500" : "text-rose-500")}>
                        {formatCurrency(m.net)}
                      </span>
                      {m.net > 0 ? <ArrowUpRight size={14} className="text-emerald-500" /> : <ArrowDownRight size={14} className="text-rose-500" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="p-4 md:p-10 bg-zinc-950 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
            <div className="absolute technical-grid inset-0 opacity-[0.05]" />
            <div className="relative z-10 flex items-start justify-between">
               <div className="space-y-6">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate">System Recommendation</span>
                  <p className="text-xl font-black tracking-tight leading-relaxed italic">
                    Cluster <span className="text-indigo-600">"{consolidatedMetrics[0]?.name}"</span> is currently showing peak capital intensity. Recommend allocating surplus liquidity to secondary nodes.
                  </p>
                  <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 hover:text-white transition-colors">
                     Execution Details <ChevronRight size={14} />
                  </button>
               </div>
            </div>
         </div>
         <div className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm flex flex-col justify-between">
            <div>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40">Architectural Distribution</span>
               <div className="mt-8 space-y-4">
                  {consolidatedMetrics.slice(0, 3).map(m => (
                    <div key={m.id} className="space-y-2">
                       <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                          <span>{m.name}</span>
                          <span className="text-slate-500 opacity-44">{Math.round((m.revenue / totals.rev) * 100)}% weight</span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-900" style={{ width: `${(m.revenue / totals.rev) * 100}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
