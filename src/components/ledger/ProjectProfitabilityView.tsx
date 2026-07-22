import React, { useState } from 'react';
import { Transaction } from '../../types';
import { TrendingUp, Filter, Maximize2, Download, Zap, Compass, Activity, BrainCircuit } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface ProjectProfitabilityViewProps {
  transactions: Transaction[];
  formatCurrency: (val: number) => string;
}

export default function ProjectProfitabilityView({ transactions, formatCurrency }: ProjectProfitabilityViewProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'high-yield' | 'loss'>('all');
  const [showAllChart, setShowAllChart] = useState(false);

  const projectProfitability = React.useMemo(() => {
    const projectData: Record<string, { income: number, expense: number, net: number, name: string, transactionsCount: number }> = {};
    
    transactions.forEach(t => {
      t.lines?.forEach(l => {
        const pId = l.project || 'General Topology';
        if (!projectData[pId]) {
          projectData[pId] = { income: 0, expense: 0, net: 0, name: pId, transactionsCount: 0 };
        }
        const accName = (l.accountName || '').toLowerCase();
        if (accName.includes('income') || accName.includes('revenue')) {
          projectData[pId].income += Math.abs(l.amountCents);
          projectData[pId].net += Math.abs(l.amountCents);
          projectData[pId].transactionsCount += 1;
        } else if (accName.includes('expense') || accName.includes('cost')) {
          projectData[pId].expense += Math.abs(l.amountCents);
          projectData[pId].net -= Math.abs(l.amountCents);
          projectData[pId].transactionsCount += 1;
        }
      });
    });

    let results = Object.values(projectData).sort((a, b) => b.net - a.net);
    if (filterMode === 'high-yield') {
      results = results.filter(r => r.income > 0 && r.net / r.income > 0.4);
    } else if (filterMode === 'loss') {
      results = results.filter(r => r.net < 0);
    }

    return results;
  }, [transactions, filterMode]);

  const totalIncome = projectProfitability.reduce((sum, p) => sum + p.income, 0);
  const totalExpense = projectProfitability.reduce((sum, p) => sum + p.expense, 0);
  const totalNet = totalIncome - totalExpense;

  const chartData = projectProfitability.map(p => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    income: p.income / 100,
    expense: p.expense / 100,
    net: p.net / 100,
    margin: p.income > 0 ? (p.net / p.income) * 100 : 0
  })).slice(0, showAllChart ? undefined : 10);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.4em] mb-2 block">Project Matrix</span>
           <h2 className="text-3xl md:text-5xl font-black text-[var(--text)] uppercase italic tracking-tighter leading-none">Profitability Engine</h2>
        </div>
        <div className="flex items-center gap-3">
           {['all', 'high-yield', 'loss'].map((mode) => (
             <button
               key={mode}
               onClick={() => setFilterMode(mode as any)}
               className={cn(
                 "px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                 filterMode === mode ? "bg-[var(--ink)] text-[var(--panel)] shadow-lg" : "bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--ink)] border border-[var(--line)]"
               )}
             >
               {mode.replace('-', ' ')}
             </button>
           ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: 'Total Global Income', val: formatCurrency(totalIncome), color: 'text-indigo-600', icon: TrendingUp },
           { label: 'Total Energy Expense', val: formatCurrency(totalExpense), color: 'text-rose-500', icon: Zap },
           { label: 'Net System Amount', val: formatCurrency(totalNet), color: 'text-emerald-500', icon: Activity },
           { label: 'Overall Margin Resonance', val: totalIncome > 0 ? `${((totalNet / totalIncome) * 100).toFixed(1)}%` : '0%', color: 'text-purple-500', icon: BrainCircuit },
         ].map((kpi, idx) => (
           <div key={idx} className="bg-[var(--panel)] p-6 rounded-2xl border border-[var(--line)] shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <kpi.icon size={48} className={kpi.color} />
             </div>
             <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] mb-2">{kpi.label}</p>
             <h3 className={cn("text-3xl font-mono font-light tracking-tight", kpi.color)}>{kpi.val}</h3>
           </div>
         ))}
      </div>

      {/* Advanced Charting */}
      {chartData.length > 0 && (
        <div className="bg-[var(--panel)] p-8 rounded-2xl border border-[var(--line)] shadow-sm">
           <div className="flex justify-between items-center mb-8">
             <div>
                <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-widest">{showAllChart ? 'All Projects Vector Analysis' : 'Top 10 Vector Analysis'}</h3>
                <p className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-widest mt-1">Income vs Expense vs Net Margin</p>
             </div>
             <div className="flex items-center gap-2">
               {projectProfitability.length > 10 && (
                 <button 
                   onClick={() => setShowAllChart(!showAllChart)}
                   className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-[var(--ink)] hover:bg-slate-200 border border-[var(--line)] transition-all cursor-pointer text-[var(--text)]"
                 >
                   {showAllChart ? 'Show Top 10' : `Show All (${projectProfitability.length})`}
                 </button>
               )}
               <button className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--ink)] text-[var(--muted)] hover:bg-slate-100 transition-all">
                  <Maximize2 size={16} />
               </button>
             </div>
           </div>
           
           <div className="h-[400px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                 <XAxis 
                   dataKey="name" 
                   axisLine={false}
                   tickLine={false}
                   tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                   dy={10}
                 />
                 <YAxis 
                   yAxisId="left"
                   axisLine={false}
                   tickLine={false}
                   tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                   tickFormatter={(value) => `$${value.toLocaleString()}`}
                 />
                 <YAxis 
                   yAxisId="right"
                   orientation="right"
                   axisLine={false}
                   tickLine={false}
                   tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                   tickFormatter={(value) => `${value}%`}
                 />
                 <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                   itemStyle={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}
                   labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', color: '#0f172a', marginBottom: '8px' }}
                   formatter={(value: number, name: string) => [
                     name === 'margin' ? `${value.toFixed(1)}%` : `$${value.toLocaleString()}`, 
                     name.toUpperCase()
                   ]}
                 />
                 <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }} />
                 <Bar yAxisId="left" dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} name="Flux Income" />
                 <Bar yAxisId="left" dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} name="Energy Expense" />
                 <Line yAxisId="right" type="monotone" dataKey="margin" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} name="Margin Resonance %" />
               </ComposedChart>
             </ResponsiveContainer>
           </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]/50">
          <div>
            <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-widest">Project Ledger Engine</h3>
            <p className="text-[10px] font-black text-[var(--faint)] uppercase tracking-[0.2em] mt-1">Real-time vector synchronization</p>
          </div>
          <button className="px-4 py-2 bg-[var(--panel)] border border-[var(--line)] rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-[var(--ink)] flex items-center gap-2 transition-all">
            <Download size={14} /> Export Node
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[var(--ink)]/80 border-b border-[var(--line)]">
                <th className="px-8 py-4 text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.2em]">Project Node</th>
                <th className="px-8 py-4 text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.2em] text-right">Transactions</th>
                <th className="px-8 py-4 text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.2em] text-right">Flux Income</th>
                <th className="px-8 py-4 text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.2em] text-right">Energy Expense</th>
                <th className="px-8 py-4 text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.2em] text-right">Net Amount</th>
                <th className="px-8 py-4 text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.2em] text-right">Yield Resonance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {projectProfitability.map((p, idx) => (
                <tr key={idx} className="hover:bg-[var(--ink)]/50 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--muted)] group-hover:bg-[var(--ink)] group-hover:text-[var(--panel)] transition-all transform group-hover:rotate-6">
                        <Compass size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-[var(--text)] tracking-tight">{p.name}</span>
                        <p className="text-[9px] font-mono text-[var(--faint)] mt-1 uppercase tracking-widest">Active Node</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right font-mono text-slate-600 font-bold text-xs">{p.transactionsCount}</td>
                  <td className="px-8 py-5 text-right font-mono text-indigo-600 font-bold text-sm">{formatCurrency(p.income)}</td>
                  <td className="px-8 py-5 text-right font-mono text-rose-500/80 font-bold text-sm">{formatCurrency(p.expense)}</td>
                  <td className="px-8 py-5 text-right font-mono font-black text-[var(--text)] text-sm">{formatCurrency(p.net)}</td>
                  <td className="px-8 py-5 text-right">
                    <span className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm border",
                      p.income > 0 ? (p.net / p.income > 0.3 ? "bg-[var(--ink)]/10 text-indigo-600 border-indigo-600/20" : "bg-orange-500/10 text-orange-600 border-orange-500/20") : "bg-slate-100 text-[var(--muted)] border-[var(--line)]"
                    )}>
                      {p.income > 0 ? `${((p.net / p.income) * 100).toFixed(1)}%` : '0%'}
                    </span>
                  </td>
                </tr>
              ))}
              {projectProfitability.length === 0 && (
                <tr>
                   <td colSpan={6} className="px-8 py-16 text-center">
                     <div className="flex flex-col items-center justify-center text-[var(--faint)]">
                        <Filter size={32} className="mb-4 opacity-50" />
                        <p className="text-sm font-bold uppercase tracking-widest">No Projects Match Filter</p>
                     </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
