import ChartFrame, { ChartTooltip } from '../charts/ChartFrame';
import { useAuthStore } from '../../stores/useAuthStore';


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
 const currency = useAuthStore(state => state.getCurrentWorkspace()?.currency);
 const rows = projectStats.map(row => ({...row,label:row.name}));
 return (<motion.div
                key="roi"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                   <div className="min-w-0">
                     <ChartFrame title="Project Raw Revenue & Profit Matrix" rows={rows} currency={currency} series={[{key:'profit',name:'Profit',unit:'majorMoney'}]}>
                       {({rows:visible,hidden}) => <ResponsiveContainer width="100%" height="100%"><BarChart data={visible} onClick={event => { const project = event?.activePayload?.[0]?.payload; if (project?.id) onAction('filter_project',{projectId:project.id}); }}>
                         <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis />
                         <Tooltip content={<ChartTooltip currency={currency} series={[{key:'profit',name:'Profit',unit:'majorMoney'}]} />} />
                         <Bar dataKey="profit" name="Profit" fill="#6366f1" hide={hidden.has('profit')} />
                       </BarChart></ResponsiveContainer>}
                     </ChartFrame>
                     <p className="text-sm text-[var(--muted)]">Click columns to filter transactions by project.</p>
                   </div>
                   <ChartFrame title="Relative Profit Margins" rows={rows} series={[{key:'margin',name:'Operational Margin',unit:'percent'}]}>
                     {({rows:visible,hidden}) => <ResponsiveContainer width="100%" height="100%"><AreaChart data={visible}>
                       <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis tickFormatter={value => `${value}%`} />
                       <Tooltip content={<ChartTooltip series={[{key:'margin',name:'Operational Margin',unit:'percent'}]} />} />
                       <Area dataKey="margin" name="Operational Margin" stroke="#10b981" fill="#10b981" fillOpacity={0.12} hide={hidden.has('margin')} />
                     </AreaChart></ResponsiveContainer>}
                   </ChartFrame>
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
