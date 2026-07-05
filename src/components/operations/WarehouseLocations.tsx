import React, { useState, useMemo } from 'react';
import { PackageOpen, MapPin, Boxes, ArrowRightLeft, Search, Plus, Filter, LayoutGrid } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function WarehouseLocations() {
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [bins, setBins] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bins'), (snap) => {
      if (!snap.empty) {
        setBins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setBins([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBins = useMemo(() => {
    return bins.filter(b => 
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.warehouse.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [bins, searchTerm]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <PackageOpen className="w-6 h-6 text-sky-400" />
            Warehouse & Locations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Map out your warehouse at the aisle, rack, shelf, and bin level.
          </p>
        </div>
        <div className="flex gap-3">
           <button className="h-10 px-4 bg-slate-800 text-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-sm border border-slate-700">
             <ArrowRightLeft className="w-4 h-4" /> Transfer Stock
           </button>
           <button className="h-10 px-4 bg-sky-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-sky-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> Add Bin
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['list', 'map'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'list' ? <Boxes size={14} /> : <LayoutGrid size={14} />}
                   {tab}
                 </button>
               ))}
             </div>
             
             {activeTab === 'list' && (
               <div className="relative max-w-sm w-full">
                 <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Search bin ID, zone, or warehouse..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                 />
               </div>
             )}
          </div>

          {activeTab === 'list' ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[700px]">
                <div className="col-span-3">Bin Location ID</div>
                <div className="col-span-3">Zone / Aisle</div>
                <div className="col-span-2 text-center">Bin Type</div>
                <div className="col-span-2 text-center">Capacity</div>
                <div className="col-span-2 text-right">Status</div>
              </div>
              <div className="divide-y divide-slate-100 min-w-[700px]">
                <AnimatePresence>
                  {filteredBins.map((b, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={b.id} 
                      className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
                    >
                      <div className="col-span-3">
                        <div className="font-bold text-slate-900 font-mono tracking-tight flex items-center gap-1.5">
                          <MapPin size={14} className="text-sky-500" />
                          {b.id}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 ml-5">{b.warehouse}</div>
                      </div>
                      <div className="col-span-3 text-sm text-slate-700 font-bold">
                        {b.zone}
                      </div>
                      <div className="col-span-2 flex justify-center">
                         <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600 font-bold uppercase tracking-wider border border-slate-200">
                           {b.type}
                         </span>
                      </div>
                      <div className="col-span-2 flex flex-col items-center justify-center">
                         <div className="font-bold font-mono text-slate-900 mb-1.5">{b.capacity}</div>
                         <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                             className={cn("h-full rounded-full transition-all duration-500", 
                               parseInt(b.capacity) > 85 ? 'bg-rose-500' : 
                               parseInt(b.capacity) > 50 ? 'bg-sky-500' : 'bg-emerald-500'
                             )} 
                             style={{ width: b.capacity }} 
                           />
                         </div>
                      </div>
                      <div className="col-span-2 flex justify-end">
                         <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            b.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            b.status === 'Full' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                         )}>
                            {b.status}
                         </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredBins.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <PackageOpen size={32} className="mx-auto mb-3 text-slate-300" />
                    No bins found matching your search.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-50 min-h-[400px]">
               <LayoutGrid size={48} className="text-slate-300 mb-4" />
               <h3 className="text-lg font-bold text-slate-700">Visual Warehouse Map</h3>
               <p className="text-sm mt-2 max-w-md text-center">Interactive 2D floor plan visualization of your warehouse locations will appear here in a future update.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
