import React, { useState, useMemo } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle2, Search, Package, Plus, ClipboardCheck, ArrowRightLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function ReturnsRMA() {
  const [activeTab, setActiveTab] = useState<'rma' | 'warranty'>('rma');
  const [rmas, setRmas] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rmas'), (snap) => {
      if (!snap.empty) {
        setRmas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setRmas([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRmas = useMemo(() => {
    let filtered = rmas.filter(r => 
      r.customer.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.item.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'rma') {
      filtered = filtered.filter(r => r.type === 'RMA');
    } else {
      filtered = filtered.filter(r => r.type === 'Warranty');
    }
    return filtered;
  }, [rmas, searchTerm, activeTab]);

  const pendingCount = rmas.filter(r => r.status === 'Pending Insp.').length;
  const processingCount = rmas.filter(r => r.status === 'Processing').length;
  const totalValue = rmas.filter(r => r.status !== 'Rejected').reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-rose-400" />
            Returns & RMA
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage Return Merchandise Authorizations, warranties, and reverse logistics.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Inspections</span>
             <span className="text-lg font-mono font-bold text-rose-400">{pendingCount}</span>
           </div>
           <button className="h-10 px-4 bg-rose-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-rose-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> New RMA
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <RotateCcw className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Active RMAs</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{rmas.filter(r => r.status !== 'Rejected' && r.status !== 'Approved').length}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <ClipboardCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Pending Inspection</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-700">{pendingCount}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <ArrowRightLeft className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Processing</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{processingCount}</div>
          </div>
          <div className="p-5 bg-slate-100 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Package className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Value at Risk</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-700">${totalValue.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['rma', 'warranty'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'rma' ? <RotateCcw className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                   {tab === 'rma' ? 'RMA Requests' : 'Warranty Claims'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search customers, items, or RMA IDs..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
              <div className="col-span-3">Customer / Ref</div>
              <div className="col-span-3">Item Returned</div>
              <div className="col-span-3">Reason</div>
              <div className="col-span-1 text-center">Date</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[900px]">
              <AnimatePresence>
                {filteredRmas.map((rma, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={rma.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                         <Package size={18} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
                      </div>
                      <div className="truncate pr-4">
                        <div className="font-bold text-slate-900 group-hover:text-rose-600 transition-colors truncate">{rma.customer}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{rma.id}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3 text-sm font-bold text-slate-700 truncate pr-4">
                      {rma.item}
                    </div>
                    
                    <div className="col-span-3 text-xs text-slate-600 pr-4 truncate">
                      {rma.reason}
                    </div>
                    
                    <div className="col-span-1 text-center text-xs font-mono font-bold text-slate-500">
                       {rma.date}
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                        rma.status === 'Approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        rma.status === 'Rejected' ? "bg-slate-100 text-slate-500 border-slate-200" :
                        rma.status === 'Pending Insp.' ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {rma.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredRmas.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <RotateCcw size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} records found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
