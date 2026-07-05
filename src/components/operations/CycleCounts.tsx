import React, { useState, useMemo } from 'react';
import { ClipboardCheck, Calculator, AlertTriangle, CheckCircle2, PlayCircle, Search, MapPin, Archive } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function CycleCounts() {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [counts, setCounts] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'counts'), (snap) => {
      if (!snap.empty) {
        setCounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setCounts([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCounts = useMemo(() => {
    let filtered = counts.filter(c => 
      c.location.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'active') {
      filtered = filtered.filter(c => c.status !== 'Completed');
    } else {
      filtered = filtered.filter(c => c.status === 'Completed');
    }
    return filtered;
  }, [counts, searchTerm, activeTab]);

  const inProgressCount = counts.filter(c => c.status === 'In Progress').length;
  const reviewCount = counts.filter(c => c.status === 'Review Required').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-teal-400" />
            Inventory Cycle Counts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Conduct continuous partial stocktakes to maintain inventory accuracy without full shutdowns.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Reviews</span>
             <span className="text-lg font-mono font-bold text-rose-400">{reviewCount}</span>
           </div>
           <button className="h-10 px-4 bg-teal-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-teal-700 transition-colors shadow-sm">
             <PlayCircle className="w-4 h-4" /> Start New Count
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <ClipboardCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Active Counts</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{counts.filter(c => c.status !== 'Completed').length}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-2">
              <Calculator className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Items Being Counted</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-700">{counts.filter(c => c.status === 'In Progress').reduce((sum, c) => sum + c.itemsToCount, 0)}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Discrepancies Found</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{counts.reduce((sum, c) => sum + c.discrepancies, 0)}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Completed Today</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{counts.filter(c => c.status === 'Completed').length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['active', 'completed'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'active' ? 'Active Counts' : 'History'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search locations or reference IDs..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-3">Count Ref / Location</div>
              <div className="col-span-4 text-center">Progress</div>
              <div className="col-span-2 text-center">Discrepancies</div>
              <div className="col-span-3 text-right">Status & Action</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredCounts.map((c, i) => {
                   const percent = c.itemsToCount > 0 ? (c.completed / c.itemsToCount) * 100 : 0;
                   return (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: i * 0.05 }}
                       key={c.id} 
                       className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                     >
                       <div className="col-span-3 flex items-center gap-3">
                         <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <MapPin size={18} className="text-slate-400 group-hover:text-teal-500 transition-colors" />
                         </div>
                         <div className="truncate pr-4">
                           <div className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors truncate">{c.location}</div>
                           <div className="text-[10px] font-mono text-slate-500 mt-0.5">{c.id}</div>
                         </div>
                       </div>
                       
                       <div className="col-span-4 px-6">
                          <div className="flex items-center justify-between text-[10px] font-bold font-mono mb-1.5">
                             <span className={cn(percent === 100 ? "text-emerald-600" : "text-teal-600")}>{c.completed} counted</span>
                             <span className="text-slate-400">/ {c.itemsToCount} target</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                             <div 
                               className={cn("h-full rounded-full transition-all duration-500", percent === 100 ? "bg-emerald-500" : "bg-teal-500")}
                               style={{ width: `${Math.min(percent, 100)}%` }} 
                             />
                          </div>
                       </div>
                       
                       <div className="col-span-2 flex justify-center">
                          <span className={cn(
                             "font-bold font-mono text-base flex items-center gap-1.5 px-2.5 py-1 rounded-md",
                             c.discrepancies > 0 ? "text-rose-700 bg-rose-50 border border-rose-200" : "text-slate-400"
                          )}>
                             {c.discrepancies > 0 && <AlertTriangle size={14} className="text-rose-500" />}
                             {c.discrepancies}
                          </span>
                       </div>
                       
                       <div className="col-span-3 flex justify-end items-center gap-3">
                          <span className={cn(
                             "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                             c.status === 'Review Required' ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" :
                             c.status === 'In Progress' ? "bg-blue-50 text-blue-700 border-blue-200" :
                             "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                             {c.status}
                          </span>
                          {c.status === 'Review Required' && (
                            <button className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors shadow-sm whitespace-nowrap">
                               Review
                            </button>
                          )}
                       </div>
                     </motion.div>
                   )
                })}
              </AnimatePresence>
              {filteredCounts.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <ClipboardCheck size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} cycle counts found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
