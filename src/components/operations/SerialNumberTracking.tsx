import React, { useState, useMemo } from 'react';
import { Barcode, Search, History, ShieldAlert, Package, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function SerialNumberTracking() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'field'>('inventory');
  const [serials, setSerials] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'serials'), (snap) => {
      if (!snap.empty) {
        setSerials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setSerials([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSerials = useMemo(() => {
    let filtered = serials.filter(s => 
      s.sn.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.customer.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'inventory') {
      filtered = filtered.filter(s => s.status === 'In Inventory');
    } else {
      filtered = filtered.filter(s => s.status !== 'In Inventory');
    }
    return filtered;
  }, [serials, searchTerm, activeTab]);

  const inFieldCount = serials.filter(s => s.status === 'Active Field').length;
  const inventoryCount = serials.filter(s => s.status === 'In Inventory').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Barcode className="w-6 h-6 text-indigo-400" />
            Serial Number Lifecycle
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track individual unit histories from assembly to customer deployment and warranty.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Units in Field</span>
             <span className="text-lg font-mono font-bold text-indigo-400">{inFieldCount}</span>
           </div>
           <button className="h-10 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
             <Search className="w-4 h-4" /> Trace Serial
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Barcode className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Tracked Units</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{serials.length}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <Package className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">In Inventory</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{inventoryCount}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-2">
              <Cpu className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Field</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-700">{inFieldCount}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">RMA / Return</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{serials.filter(s => s.status.includes('RMA')).length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['inventory', 'field'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'inventory' ? 'Stock Inventory' : 'Field Deployments'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search SN, items, or customers..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-4">Serial Number / Item</div>
              <div className="col-span-3 text-center">Location / Customer</div>
              <div className="col-span-2 text-center">Warranty End</div>
              <div className="col-span-3 text-right">Lifecycle Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredSerials.map((s, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={s.sn} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                         <Barcode size={18} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <div className="truncate pr-4">
                        <div className="font-bold font-mono text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{s.sn}</div>
                        <div className="text-xs font-bold text-slate-500 mt-0.5 truncate">{s.item}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3 text-center text-sm font-bold text-slate-700 bg-slate-100 py-1 rounded-md mx-4 truncate px-2">
                      {s.customer}
                    </div>
                    
                    <div className="col-span-2 text-center font-mono text-xs font-bold text-slate-600">
                      {s.warrantyEnd === 'N/A' ? (
                        <span className="text-slate-400 italic">Not Activated</span>
                      ) : (
                        s.warrantyEnd
                      )}
                    </div>
                    
                    <div className="col-span-3 flex justify-end">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5",
                          s.status === 'Active Field' ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm" :
                          s.status === 'In Inventory' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          "bg-rose-50 text-rose-700 border-rose-200"
                       )}>
                          {s.status === 'In Inventory' && <CheckCircle2 size={12} />}
                          {s.status === 'RMA Received' && <AlertTriangle size={12} />}
                          {s.status}
                       </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredSerials.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Barcode size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} serial numbers found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
