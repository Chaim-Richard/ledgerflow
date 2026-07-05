import React, { useState, useMemo } from 'react';
import { ArrowRightLeft, Package, MapPin, Truck, Search, Plus, PlayCircle, Navigation, Archive } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function StockTransfers() {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [transfers, setTransfers] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'transfers'), (snap) => {
      if (!snap.empty) {
        setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setTransfers([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransfers = useMemo(() => {
    let filtered = transfers.filter(t => 
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.dest.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'active') {
      filtered = filtered.filter(t => t.status !== 'Completed');
    } else {
      filtered = filtered.filter(t => t.status === 'Completed');
    }
    return filtered;
  }, [transfers, searchTerm, activeTab]);

  const inTransitCount = transfers.filter(t => t.status === 'In Transit').length;
  const pendingCount = transfers.filter(t => t.status === 'Pending Pickup').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-orange-400" />
            Inter-Warehouse Stock Transfers
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track and orchestrate inventory movement between your physical locations.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Transit</span>
             <span className="text-lg font-mono font-bold text-orange-400">{inTransitCount}</span>
           </div>
           <button className="h-10 px-4 bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> New Transfer
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Package className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Active</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{inTransitCount + pendingCount}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-2">
              <Truck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">In Transit</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-700">{inTransitCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <Archive className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Pending Pickup</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-600">{pendingCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <Navigation className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Completed Today</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">4</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['active', 'history'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'active' ? 'Active Transfers' : 'Transfer Log'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search by ID, item, or location..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-3">Transfer Ref / Item</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-4 text-center">Route</div>
              <div className="col-span-2 text-center">Scheduled Date</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredTransfers.map((t, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={t.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                         <Package size={18} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-slate-900 truncate group-hover:text-orange-600 transition-colors">{t.item}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{t.id}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-1 text-center font-bold font-mono text-slate-900 text-lg">
                      {t.qty}
                    </div>
                    
                    <div className="col-span-4 flex items-center justify-center gap-3">
                       <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs font-bold text-slate-600 flex items-center gap-1.5 min-w-[110px] justify-center">
                         <MapPin size={12} className="text-slate-400"/> {t.source}
                       </span>
                       <div className="flex flex-col items-center justify-center w-12 relative">
                          <div className="w-full h-px bg-slate-300 absolute top-1/2 -translate-y-1/2"></div>
                          <ArrowRightLeft className={cn("w-3.5 h-3.5 relative z-10 bg-white px-0.5", t.status === 'In Transit' ? "text-blue-500 animate-pulse" : "text-slate-400")} />
                       </div>
                       <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs font-bold text-slate-600 flex items-center gap-1.5 min-w-[110px] justify-center">
                         <MapPin size={12} className="text-slate-400"/> {t.dest}
                       </span>
                    </div>
                    
                    <div className="col-span-2 text-center text-xs font-mono font-bold text-slate-500">
                       {t.date}
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          t.status === 'In Transit' ? "bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5 shadow-sm" :
                          t.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                       )}>
                          {t.status === 'In Transit' && <Truck className="w-3 h-3" />}
                          {t.status}
                       </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredTransfers.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <ArrowRightLeft size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} transfers found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
