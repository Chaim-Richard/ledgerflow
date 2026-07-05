import React, { useState, useMemo } from 'react';
import { Route, Cog, Clock, CheckCircle2, Search, ArrowRight, PlayCircle, Settings2, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function ManufacturingRoutings() {
  const [activeTab, setActiveTab] = useState<'active' | 'drafts'>('active');
  const [routings, setRoutings] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'routings'), (snap) => {
      if (!snap.empty) {
        setRoutings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setRoutings([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRoutings = useMemo(() => {
    let filtered = routings.filter(r => 
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.product.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'active') {
      filtered = filtered.filter(r => r.status === 'Active');
    } else {
      filtered = filtered.filter(r => r.status !== 'Active');
    }
    return filtered;
  }, [routings, searchTerm, activeTab]);

  const activeRoutingsCount = routings.filter(r => r.status === 'Active').length;
  const totalJobsRunning = routings.reduce((sum, r) => sum + r.activeJobs, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Route className="w-6 h-6 text-fuchsia-400" />
            Manufacturing Routings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Define work center paths and expected cycle times for production runs.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Jobs on Routings</span>
             <span className="text-lg font-mono font-bold text-fuchsia-400">{totalJobsRunning}</span>
           </div>
           <button className="h-10 px-4 bg-fuchsia-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-fuchsia-700 transition-colors shadow-sm">
             <PlayCircle className="w-4 h-4" /> New Routing
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Route className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Defined Routings</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{routings.length}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Standard Routings</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{activeRoutingsCount}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <Settings2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Draft / In Review</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{routings.length - activeRoutingsCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Avg Standard Time</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">5.7h</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['active', 'drafts'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'active' ? 'Active Routings' : 'Drafts & Revisions'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search products or routing IDs..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
              <div className="col-span-3">Product / Routing Ref</div>
              <div className="col-span-5">Work Center Sequence</div>
              <div className="col-span-2 text-center">Est. Cycle Time</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[900px]">
              <AnimatePresence>
                {filteredRoutings.map((r, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={r.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                         <Cog size={18} className="text-slate-400 group-hover:text-fuchsia-500 transition-colors" />
                      </div>
                      <div className="truncate pr-4">
                        <div className="font-bold text-slate-900 group-hover:text-fuchsia-600 transition-colors truncate">{r.product}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{r.id}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-5 flex items-center gap-1.5 text-[10px] font-bold text-slate-600 flex-wrap">
                       {r.centers.map((c: any, index: number) => (
                          <React.Fragment key={c}>
                             <span className="px-2 py-1 bg-white border border-slate-200 rounded whitespace-nowrap shadow-sm group-hover:border-fuchsia-200 transition-colors">{c}</span>
                             {index < r.centers.length - 1 && <ArrowRight size={10} className="text-slate-300" />}
                          </React.Fragment>
                       ))}
                    </div>
                    
                    <div className="col-span-2 text-center font-bold font-mono text-slate-700 text-sm">
                       {r.time}
                    </div>
                    
                    <div className="col-span-2 flex flex-col items-end justify-center pr-2 gap-1">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          r.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          r.status === 'Draft' ? "bg-slate-100 text-slate-600 border-slate-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                       )}>
                          {r.status}
                       </span>
                       {r.status === 'Active' && r.activeJobs > 0 && (
                         <span className="text-[9px] font-bold text-fuchsia-600 uppercase tracking-wider">
                           {r.activeJobs} Active Jobs
                         </span>
                       )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredRoutings.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Route size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} routings found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
