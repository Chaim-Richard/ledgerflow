import React, { useState, useMemo } from 'react';
import { Layers, ListChecks, CheckCircle2, PlayCircle, Search, User, MapPin, Archive } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function WavePicking() {
  const [activeTab, setActiveTab] = useState<'waves'>('waves');
  const [waves, setWaves] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'waves'), (snap) => {
      if (!snap.empty) {
        setWaves(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setWaves([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWaves = useMemo(() => {
    return waves.filter(w => 
      w.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.assignedTo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [waves, searchTerm]);

  const pickingCount = waves.filter(w => w.status === 'Picking').length;
  const pendingCount = waves.filter(w => w.status === 'Pending').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Layers className="w-6 h-6 text-fuchsia-400" />
            Wave & Batch Picking
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Consolidate orders into optimized picking waves by warehouse zone to minimize walking distance.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Waves</span>
             <span className="text-lg font-mono font-bold text-fuchsia-400">{pickingCount}</span>
           </div>
           <button className="h-10 px-4 bg-fuchsia-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-fuchsia-700 transition-colors shadow-sm">
             <PlayCircle className="w-4 h-4" /> Generate Wave
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Layers className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Waves</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{waves.length}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <PlayCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">In Progress</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{pickingCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Archive className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Pending Assignment</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-700">{pendingCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-fuchsia-500 mb-2">
              <ListChecks className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Items to Pick</span>
            </div>
            <div className="text-3xl font-bold font-mono text-fuchsia-600">{waves.filter(w => w.status !== 'Completed').reduce((sum, w) => sum + w.itemsCount, 0)}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search zone, picker, or wave ID..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-3">Wave Ref / Zone</div>
              <div className="col-span-2 text-center">Orders Included</div>
              <div className="col-span-2 text-center">Total Items</div>
              <div className="col-span-3 text-center">Assigned Picker</div>
              <div className="col-span-2 text-right">Status / Progress</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredWaves.map((w, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={w.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                         <Layers size={18} className="text-slate-400 group-hover:text-fuchsia-500 transition-colors" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-slate-900 group-hover:text-fuchsia-600 transition-colors truncate">{w.zone}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">{w.id}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-2 text-center font-bold font-mono text-slate-700 text-lg">
                      {w.ordersCount}
                    </div>
                    
                    <div className="col-span-2 text-center font-bold font-mono text-fuchsia-600 text-lg flex items-center justify-center gap-1">
                      <Archive size={14} className="text-fuchsia-400" />
                      {w.itemsCount}
                    </div>
                    
                    <div className="col-span-3 flex justify-center">
                       {w.assignedTo === 'Unassigned' ? (
                         <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-md text-xs font-bold border border-slate-200 border-dashed">
                           Unassigned
                         </span>
                       ) : (
                         <span className="px-2.5 py-1 bg-white text-slate-700 rounded-md text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-sm">
                           <User size={12} className="text-slate-400" /> {w.assignedTo}
                         </span>
                       )}
                    </div>
                    
                    <div className="col-span-2 flex flex-col items-end justify-center pr-2">
                      <div className="flex items-center gap-2 mb-1.5">
                         <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                            w.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            w.status === 'Picking' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                         )}>
                            {w.status}
                         </span>
                      </div>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-500", 
                            w.progress === 100 ? 'bg-emerald-500' : 
                            w.progress > 0 ? 'bg-amber-500' : 'bg-slate-300'
                          )} 
                          style={{ width: `${w.progress}%` }} 
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredWaves.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Layers size={32} className="mx-auto mb-3 text-slate-300" />
                  No waves found matching your search.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
