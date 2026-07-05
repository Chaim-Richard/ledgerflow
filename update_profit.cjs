const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Briefcase, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Target, Search, BarChart3, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_METRICS = [
  { id: 'PRJ-2001', name: 'Downtown Highrise', rev: 950000, costs: 850000, margin: 10.5, status: 'At Risk', manager: 'S. Connor' },
  { id: 'PRJ-2002', name: 'ERP Implementation', rev: 250000, costs: 180000, margin: 28, status: 'On Track', manager: 'M. Johnson' },
  { id: 'PRJ-2003', name: 'Cloud Migration Phase 1', rev: 120000, costs: 85000, margin: 29.1, status: 'On Track', manager: 'A. Chen' },
  { id: 'PRJ-2004', name: 'Retail Store Buildout', rev: 450000, costs: 460000, margin: -2.2, status: 'Critical Loss', manager: 'T. Hanks' },
  { id: 'PRJ-2005', name: 'Data Center Upgrade', rev: 800000, costs: 600000, margin: 25, status: 'On Track', manager: 'E. Hunt' },
];

export default function ProjectProfitability() {
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis'>('overview');
  const [metrics] = useState(MOCK_METRICS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.manager.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [metrics, searchTerm]);

  const totalRev = metrics.reduce((sum, m) => sum + m.rev, 0);
  const totalCost = metrics.reduce((sum, m) => sum + m.costs, 0);
  const aggregateMargin = ((totalRev - totalCost) / totalRev) * 100;
  
  const criticalCount = metrics.filter(m => m.margin < 5).length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-teal-400" />
            Project Profitability Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Analyze real-time margins, labor costs, and revenue per project.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aggregate Gross Margin</span>
             <span className={cn("text-lg font-mono font-bold flex items-center gap-1", aggregateMargin >= 20 ? "text-teal-400" : "text-amber-400")}>
               {aggregateMargin >= 20 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
               {aggregateMargin.toFixed(1)}%
             </span>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Portfolio Rev</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">\${(totalRev / 1000000).toFixed(2)}M</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Job Costs</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">\${(totalCost / 1000000).toFixed(2)}M</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Healthy Projects</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{metrics.length - criticalCount}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Margin &lt; 5%</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-700">{criticalCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['overview', 'analysis'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'overview' ? 'Project Overview' : 'Variance Analysis'}
                 </button>
               ))}
             </div>
             
             {activeTab === 'overview' && (
               <div className="relative max-w-sm w-full">
                 <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Search project name or manager..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                 />
               </div>
             )}
          </div>

          {activeTab === 'overview' ? (
             <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                <div className="col-span-4">Project Name / Manager</div>
                <div className="col-span-2 text-right">Revenue</div>
                <div className="col-span-2 text-right">Job Costs</div>
                <div className="col-span-2 text-center">Gross Margin</div>
                <div className="col-span-2 text-right">Status</div>
              </div>
              
              <div className="divide-y divide-slate-100 min-w-[800px]">
                <AnimatePresence>
                  {filteredMetrics.map((m, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={m.id} 
                      className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                           <Briefcase size={18} className="text-slate-400 group-hover:text-teal-500 transition-colors" />
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors truncate">{m.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">{m.id} • Mgr: {m.manager}</div>
                        </div>
                      </div>
                      
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-600 text-base">
                         \${m.rev.toLocaleString()}
                      </div>
                      
                      <div className="col-span-2 text-right font-mono font-bold text-rose-600 text-base">
                         \${m.costs.toLocaleString()}
                      </div>
                      
                      <div className="col-span-2 flex flex-col items-center justify-center">
                         <div className={cn(
                           "font-mono font-bold text-lg flex items-center gap-1",
                           m.margin >= 20 ? "text-emerald-600" : m.margin >= 5 ? "text-amber-600" : "text-rose-600"
                         )}>
                            {m.margin >= 20 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                            {m.margin}%
                         </div>
                         <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                           <div 
                             className={cn("h-full rounded-full transition-all duration-500", 
                               m.margin >= 20 ? 'bg-emerald-500' : 
                               m.margin >= 5 ? 'bg-amber-500' : 'bg-rose-500'
                             )} 
                             style={{ width: \`\${Math.min(Math.max(m.margin, 0), 100)}%\` }} 
                           />
                         </div>
                      </div>
                      
                      <div className="col-span-2 flex justify-end">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          m.status === 'On Track' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          m.status === 'At Risk' ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" :
                          "bg-rose-50 text-rose-700 border-rose-200 shadow-sm ring-1 ring-rose-200"
                        )}>
                          {m.status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredMetrics.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <Briefcase size={32} className="mx-auto mb-3 text-slate-300" />
                    No projects found matching your search.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-50 min-h-[400px]">
               <BarChart3 size={48} className="text-slate-300 mb-4" />
               <h3 className="text-lg font-bold text-slate-700">Budget vs Actual Variance</h3>
               <p className="text-sm mt-2 max-w-md text-center">Detailed forensic breakdown of labor, materials, and overhead cost overruns by project phase.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/ProjectProfitability.tsx', code);
