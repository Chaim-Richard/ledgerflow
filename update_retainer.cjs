const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Briefcase, CreditCard, PieChart, Activity, TrendingDown, Clock, Search, RotateCw, AlertTriangle, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_RETAINERS = [
  { id: 'RET-001', client: 'Acme Corp', amount: 15000, hours: 100, usedHours: 85, renewDate: '2026-07-01', status: 'Active', autoRenew: true },
  { id: 'RET-002', client: 'TechFlow Inc', amount: 5000, hours: 25, usedHours: 10, renewDate: '2026-07-15', status: 'Active', autoRenew: false },
  { id: 'RET-003', client: 'Global Ind.', amount: 25000, hours: 150, usedHours: 145, renewDate: '2026-06-30', status: 'Low Balance', autoRenew: true },
  { id: 'RET-004', client: 'Wayne Tech', amount: 10000, hours: 50, usedHours: 50, renewDate: '2026-06-15', status: 'Depleted', autoRenew: false },
  { id: 'RET-005', client: 'Stark Ind.', amount: 50000, hours: 250, usedHours: 50, renewDate: '2026-12-31', status: 'Active', autoRenew: true },
];

export default function Retainers() {
  const [activeTab, setActiveTab] = useState<'active' | 'depleted'>('active');
  const [retainers] = useState(MOCK_RETAINERS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRetainers = useMemo(() => {
    let filtered = retainers.filter(r => 
      r.client.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'active') {
      filtered = filtered.filter(r => r.status !== 'Depleted');
    } else {
      filtered = filtered.filter(r => r.status === 'Depleted');
    }
    return filtered;
  }, [retainers, searchTerm, activeTab]);

  const activeCount = retainers.filter(r => r.status !== 'Depleted').length;
  const totalValue = retainers.reduce((sum, r) => sum + r.amount, 0);
  const totalRemainingHours = retainers.reduce((sum, r) => sum + Math.max(0, r.hours - r.usedHours), 0);
  const lowBalanceCount = retainers.filter(r => r.status === 'Low Balance').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Clock className="w-6 h-6 text-purple-400" />
            Retainer Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track prepaid service retainers, burn down hours, and auto-renewals.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Retainer Value</span>
             <span className="text-lg font-mono font-bold text-emerald-400">\${totalValue.toLocaleString()}</span>
           </div>
           <button className="h-10 px-4 bg-purple-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> New Retainer
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Briefcase className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Retainers</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{activeCount}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Remaining Hours</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{totalRemainingHours}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Low Balance (&lt;20%)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{lowBalanceCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <RotateCw className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Auto-Renewing</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{retainers.filter(r => r.autoRenew).length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['active', 'depleted'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'active' ? 'Active Retainers' : 'Depleted'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search clients or references..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-3">Client / Ref</div>
              <div className="col-span-2 text-right">Retainer Amount</div>
              <div className="col-span-4 text-center">Hours Burn Down</div>
              <div className="col-span-2 text-center">Next Renewal</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredRetainers.map((r, i) => {
                   const percent = Math.min((r.usedHours / r.hours) * 100, 100);
                   return (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: i * 0.05 }}
                       key={r.id} 
                       className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                     >
                       <div className="col-span-3 flex items-center gap-3">
                         <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Briefcase size={18} className="text-slate-400 group-hover:text-purple-500 transition-colors" />
                         </div>
                         <div className="truncate pr-2">
                           <div className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors truncate">{r.client}</div>
                           <div className="text-[10px] font-mono text-slate-500 mt-0.5">{r.id}</div>
                         </div>
                       </div>
                       
                       <div className="col-span-2 text-right font-mono font-bold text-emerald-600 text-lg">
                          \${r.amount.toLocaleString()}
                       </div>
                       
                       <div className="col-span-4 px-8">
                          <div className="flex items-center justify-between text-[10px] font-bold font-mono mb-1.5">
                             <span className="text-slate-500">{r.usedHours} / {r.hours} hrs used</span>
                             <span className={cn(percent > 80 ? "text-rose-500" : "text-emerald-500")}>{Math.round(percent)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                             <div 
                               className={cn("h-full rounded-full transition-all duration-500", 
                                 percent > 90 ? "bg-rose-500" : 
                                 percent > 75 ? "bg-amber-500" : "bg-emerald-500"
                               )} 
                               style={{ width: \`\${percent}%\` }} 
                             />
                          </div>
                       </div>
                       
                       <div className="col-span-2 flex flex-col items-center justify-center">
                          <span className="text-xs font-mono font-bold text-slate-600">{r.renewDate}</span>
                          {r.autoRenew && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1 mt-0.5">
                              <RotateCw size={10} /> Auto-Renew
                            </span>
                          )}
                       </div>
                       
                       <div className="col-span-1 flex justify-end">
                          <span className={cn(
                             "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                             r.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                             r.status === 'Low Balance' ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" :
                             "bg-rose-50 text-rose-700 border-rose-200"
                          )}>
                             {r.status}
                          </span>
                       </div>
                     </motion.div>
                   )
                })}
              </AnimatePresence>
              {filteredRetainers.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Clock size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} retainers found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/Retainers.tsx', code);
