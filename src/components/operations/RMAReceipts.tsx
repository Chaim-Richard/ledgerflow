import React, { useState, useMemo } from 'react';
import { PackageOpen, RotateCcw, SearchCode, CheckSquare, Search, Box, AlertTriangle, PlayCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function RMAReceipts() {
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');
  const [receipts, setReceipts] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'receipts'), (snap) => {
      if (!snap.empty) {
        setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setReceipts([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReceipts = useMemo(() => {
    let filtered = receipts.filter(r => 
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.rma.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.item.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'pending') {
      filtered = filtered.filter(r => r.status === 'Pending Insp');
    } else {
      filtered = filtered.filter(r => r.status !== 'Pending Insp');
    }
    return filtered;
  }, [receipts, searchTerm, activeTab]);

  const pendingCount = receipts.filter(r => r.status === 'Pending Insp').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-fuchsia-400" />
            RMA Warehouse Receipts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Log the physical return of customer goods and route to repair or restocking.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Inspections</span>
             <span className="text-lg font-mono font-bold text-fuchsia-400">{pendingCount}</span>
           </div>
           <button className="h-10 px-4 bg-fuchsia-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-fuchsia-700 transition-colors shadow-sm">
             <PackageOpen className="w-4 h-4" /> Receive Return
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['pending', 'processed'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'pending' ? 'Needs Inspection' : 'Processed Logs'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search RMA or Receipt ID..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[700px]">
              <div className="col-span-3">Receipt / RMA Ref</div>
              <div className="col-span-4">Returned Item</div>
              <div className="col-span-3 text-center">Condition Code</div>
              <div className="col-span-2 text-right">Action Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[700px]">
              <AnimatePresence>
                {filteredReceipts.map((r, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={r.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                         <RotateCcw size={18} className="text-slate-400 group-hover:text-fuchsia-500 transition-colors" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-fuchsia-600 transition-colors">{r.id}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{r.rma} • {r.date}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-4 text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Box size={14} className="text-slate-400" />
                      {r.item} <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">x{r.qty}</span>
                    </div>
                    
                    <div className="col-span-3 flex justify-center">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          r.condition.includes('Damaged') || r.condition.includes('DOA') || r.condition.includes('Defective') ? "text-rose-700 bg-rose-50 border-rose-200" : "bg-slate-50 text-slate-700 border-slate-200"
                       )}>
                          {r.condition}
                       </span>
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          r.status === 'Restocked' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          r.status === 'Pending Insp' ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                       )}>
                          {r.status}
                       </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredReceipts.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <PackageOpen size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} receipts found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
