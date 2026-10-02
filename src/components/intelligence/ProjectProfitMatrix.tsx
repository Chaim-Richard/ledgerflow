

import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

import { useCommandDispatcher } from '../../hooks/useSystemContext';

interface ProjectProfitMatrixProps {
 projectStats: { id: string; name: string; profit: number; margin: number; expense: number }[];
 onAction: ReturnType<typeof useCommandDispatcher>['handleAction'];
}

export function ProjectProfitMatrix({ projectStats, onAction }: ProjectProfitMatrixProps) {
 return (<motion.div
                key="roi"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                   <div className="p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] shadow-3xs flex flex-col h-[320px]">
                      <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-3 pb-2 border-b border-[var(--line)]">Project Raw Revenue & Profit Matrix</h3>
                      <div className="flex-1 min-h-[180px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={projectStats}
                              onClick={(eventData) => {
                                if (eventData && eventData.activePayload && eventData.activePayload[0] && onAction) {
                                  onAction('filter_project', { projectId: eventData.activePayload[0].payload.id });
                                }
                              }}
                              className="cursor-crosshair"
                            >
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                               <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} />
                               <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                               <Tooltip 
                                 contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.05)', fontSize: '10px' }}
                                 formatter={(val) => [`$${val.toLocaleString()}`, 'Profit']}
                               />
                               <Bar dataKey="profit" fill="#6366f1" radius={[3, 3, 0, 0]} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                      <p className="text-[8px] font-mono text-[var(--muted)] uppercase text-center mt-3 tracking-wider">Click columns to filter transaction explorer down to project bounds</p>
                   </div>

                   <div className="p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] shadow-3xs flex flex-col h-[320px]">
                      <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-3 pb-2 border-b border-[var(--line)]">Relative Profit Margins</h3>
                      <div className="flex-1 min-h-[180px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={projectStats}>
                               <defs>
                                 <linearGradient id="marginColorGrad" x1="0" y1="0" x2="0" y2="100%">
                                   <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                                   <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                 </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                               <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} />
                               <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                               <Tooltip 
                                 contentStyle={{ fontSize: '10px', borderRadius: '0.5rem' }} 
                                 formatter={(val) => [`${parseFloat(val as string).toFixed(1)}%`, 'Operational Margin']}
                               />
                               <Area type="monotone" dataKey="margin" stroke="#10b981" strokeWidth={1.8} fillOpacity={1} fill="url(#marginColorGrad)" />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                      <p className="text-[8px] font-mono text-[var(--muted)] uppercase text-center mt-3 tracking-wider">Dynamic mathematical ratio derived from live journal lines</p>
                   </div>
                </div>

                {/* Strategic Profitability List */}
                <div className="p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-[32px] shadow-3xs">
                   <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-3">Enterprise Segment Allocations Performance</h3>
                   <div className="space-y-2">
                      {projectStats.map(p => (
                         <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[var(--ink)]/50 border border-[var(--line)]/60 rounded-xl hover:bg-slate-100/40 transition-colors gap-3">
                            <div className="flex items-center gap-3">
                               <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                                  <TrendingUp aria-hidden="true" size={11} className="stroke-[2.5px]" />
                               </div>
                               <div>
                                  <p className="text-xs font-bold text-slate-850">{p.name}</p>
                                  <p className="text-[9.5px] text-[var(--muted)] mt-0.5 leading-none">
                                     Operating profit bounds: <span className="font-semibold text-slate-700 whitespace-nowrap">${p.profit.toLocaleString()}</span>
                                  </p>
                               </div>
                            </div>
                            
                            {/* Project profitability indicators */}
                            <div className="flex items-center gap-4">
                               <div className="flex flex-col items-end text-right">
                                  <span className="text-[10px] font-extrabold text-[var(--text)]">{p.margin.toFixed(1)}% Margin</span>
                                  <span className="text-[8px] text-[var(--muted)] uppercase tracking-wider">Ratio yield</span>
                               </div>
                               <span className={cn(
                                 "text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded border shadow-3xs",
                                 p.margin > 30 ? "bg-emerald-50 text-emerald-700 border-emerald-150" : "bg-indigo-50 text-indigo-700 border-indigo-150"
                               )}>
                                 {p.margin > 30 ? 'EFFICIENT' : 'STABLE'}
                               </span>
                            </div>
                         </div>
                      ))}
                      {projectStats.length === 0 && (
                        <p className="text-center text-[11px] text-[var(--muted)] font-mono py-6">No enterprise segments categorized inside active ledger bounds.</p>
                      )}
                   </div>
                </div>
              </motion.div>);
}
