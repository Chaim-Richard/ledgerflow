import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Play, CheckCircle2, BarChart3 } from 'lucide-react';
import { LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { FINANCIAL_ALGORITHMS } from '../../lib/financial-algorithms';

interface ToolSandboxProps {
  toolId: string;
  toolName: string;
  onClose: () => void;
}

export default function ToolSandbox({ toolId, toolName, onClose }: ToolSandboxProps) {
  const transactions = useLedgerStore(state => state.transactions || []);
  const accounts = useLedgerStore(state => state.accounts || []);
  const invoices = useLedgerStore(state => state.invoices || []);
  const bills = useLedgerStore(state => state.bills || []);
  
  const algorithm = FINANCIAL_ALGORITHMS[toolId] || FINANCIAL_ALGORITHMS['1'];
  
  // Custom user inputs per algorithm
  const [params, setParams] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    algorithm.inputs.forEach((i: any) => init[i.key] = i.defaultValue);
    return init;
  });

  // Re-run anytime params change, using REAL user dataset
  const results = useMemo(() => {
    return algorithm.compute(transactions, accounts, params, { invoices, bills });
  }, [algorithm, transactions, accounts, params]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0c0d0e]/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-4 md:p-8"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 180 }}
        className="bg-[#fafafa] dark:bg-[#161718] border border-[var(--line)] rounded-[32px] w-full max-w-6xl h-[85dvh] flex flex-col overflow-hidden shadow-2xl relative"
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--line)] bg-[var(--surface)] dark:bg-[#1b1c1d]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-900 text-emerald-400 rounded-xl flex items-center justify-center font-mono font-black text-xs border border-[var(--line)]">
                {toolId}
             </div>
             <div>
                <div className="flex items-center gap-2">
                   <h2 className="text-xl font-black uppercase italic text-[var(--text)] dark:text-white tracking-tight leading-none">{algorithm.name}</h2>
                   <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] font-medium uppercase tracking-wider rounded">
                     Real-Time Data Connected
                   </span>
                </div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#8a8a8f] dark:text-neutral-400 mt-1">
                   {algorithm.description}
                </p>
             </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-3 bg-neutral-100 dark:bg-neutral-800 text-slate-500 rounded-xl transition-all cursor-pointer hover:bg-neutral-200"><X size={16} /></button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
           {/* Parameters Pane */}
           <div className="w-full md:w-80 border-b md:border-r md:border-b-0 border-[var(--line)] bg-[var(--surface)] dark:bg-[#1b1c1d] flex flex-col shrink-0">
              <div className="p-6 border-b border-[var(--line)]">
                 <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text)] dark:text-white flex items-center gap-2">
                    <Play size={14} className="text-indigo-600" /> Analysis Parameters
                 </h3>
                 <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1 opacity-60">Tune computational vectors</p>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {algorithm.inputs.map((inp: any) => (
                    <div key={inp.key} className="space-y-3">
                       <div className="flex justify-between items-center text-xs font-bold font-mono">
                          <span className="text-[10px] text-[#8a8a8f] uppercase tracking-wider font-sans">{inp.label}</span>
                          <span className="text-[var(--text)] dark:text-white">{params[inp.key]}</span>
                       </div>
                       <input 
                         type="range" min={inp.min} max={inp.max} step={inp.step} 
                         value={params[inp.key]} 
                         onChange={e => setParams({...params, [inp.key]: Number(e.target.value)})}
                         className="w-full accent-ledger-ink"
                       />
                    </div>
                 ))}
                 
                 <div className="p-4 bg-[var(--ink)] rounded-xl border border-[var(--line)]">
                    <span className="text-[9px] uppercase tracking-wider font-black text-slate-500 block mb-2">Ingestion Status</span>
                    <div className="space-y-1 font-mono text-[10px] font-bold text-[var(--text)] dark:text-white">
                       <div className="flex justify-between"><span>Transactions:</span> <span className="text-emerald-500">{transactions.length}</span></div>
                       <div className="flex justify-between"><span>Active Accounts:</span> <span className="text-emerald-500">{accounts.length}</span></div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Metrics & Visualization Workspace */}
           <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#fafafa] dark:bg-[#161718] p-4 md:p-8 space-y-8">
               {/* Metrics Row */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.metrics.map((m: any, idx: number) => (
                     <div key={idx} className="p-6 bg-[var(--surface)] dark:bg-[#1b1c1d] border border-[var(--line)] rounded-[32px] shadow-sm">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 block mb-1">{m.label}</span>
                        <h4 className="text-3xl font-black text-[var(--text)] dark:text-white tracking-tighter italic">
                           {m.value}
                        </h4>
                        {m.trend && <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider mt-2">{m.trend}</p>}
                     </div>
                  ))}
               </div>

               {/* Engine Output Chart */}
               {results.charts.map((c: any, idx: number) => (
                  <div key={idx} className="p-6 bg-[var(--surface)] dark:bg-[#1b1c1d] border border-[var(--line)] rounded-[32px] shadow-sm h-96 flex flex-col">
                     <div className="flex justify-between items-center mb-6">
                         <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text)] dark:text-white flex items-center gap-2">
                            <BarChart3 size={16} /> Operational Topology Projection
                         </h3>
                     </div>
                     <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={c.data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                              <XAxis dataKey={c.config.xKey} fontSize={10} tickLine={false} tickMargin={10} />
                              <YAxis fontSize={10} tickLine={false} />
                              <Tooltip contentStyle={{ background: '#111', color: '#fff', borderRadius: '8px', border: 'none' }} />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }} />
                              {c.config.yKeys.map((y: any) => y.type === 'bar' ? (
                                 <Bar key={y.key} dataKey={y.key} fill={y.color} name={y.name} radius={[4, 4, 0, 0]} />
                              ) : (
                                 <Line key={y.key} type="monotone" dataKey={y.key} stroke={y.color} strokeWidth={3} name={y.name} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                              ))}
                           </ComposedChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
               ))}

               {/* Insights Engine */}
               <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-[32px] space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-400">Algorithmic Consensus Output</h3>
                  <div className="space-y-2">
                     {results.insights.map((ins: string, i: number) => (
                        <div key={i} className="flex gap-3 text-sm text-indigo-900 dark:text-indigo-200">
                           <CheckCircle2 size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                           <p className="leading-relaxed font-medium">{ins}</p>
                        </div>
                     ))}
                  </div>
               </div>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
