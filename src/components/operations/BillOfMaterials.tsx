import React, { useState, useMemo } from 'react';
import { Network, Layers, Settings, FileText, CheckCircle2, Search, Plus, Boxes, Zap, ArrowRight, Cog } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';





export default function BillOfMaterials() {
  const [activeTab, setActiveTab] = useState<'bom' | 'routing'>('bom');
  const [boms, setBoms] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'boms'), (snap) => {
      if (!snap.empty) {
        setBoms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setBoms([]);
      }
    });
    return unsub;
  }, []);
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

  const filteredBOMs = useMemo(() => {
    return boms.filter(b => 
      b.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [boms, searchTerm]);

  const filteredRoutings = useMemo(() => {
    return routings.filter(r => 
      r.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [routings, searchTerm]);

  const activeBOMs = boms.filter(b => b.status === 'Active').length;
  const totalComponents = boms.reduce((sum, b) => sum + b.components, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Layers className="w-6 h-6 text-orange-400" />
            Bill of Materials (BOM)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage product structures, components, and manufacturing routing.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active BOMs</span>
             <span className="text-lg font-mono font-bold text-orange-400">{activeBOMs}</span>
           </div>
           <button className="h-10 px-4 bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> New BOM
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Layers className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total BOMs</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{boms.length}</div>
          </div>
          <div className="p-5 bg-orange-50 rounded-2xl border border-orange-200 shadow-sm">
            <div className="flex items-center gap-3 text-orange-600 mb-2">
              <Boxes className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Tracked Components</span>
            </div>
            <div className="text-3xl font-bold font-mono text-orange-700">{totalComponents}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Production Ready</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{activeBOMs}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <Network className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Routings</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{routings.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {[
                 { id: 'bom', label: 'BOM Registry', icon: Layers },
                 { id: 'routing', label: 'Work Center Routing', icon: Network }
               ].map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                     activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   <tab.icon className="w-3.5 h-3.5" />
                   {tab.label}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder={activeTab === 'bom' ? "Search assemblies or components..." : "Search routings..."}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'bom' ? (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
                  <div className="col-span-4">Finished Good / Assembly</div>
                  <div className="col-span-2 text-center">Revision</div>
                  <div className="col-span-2 text-center">Items</div>
                  <div className="col-span-2 text-right">Standard Cost</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[900px]">
                  <AnimatePresence>
                    {filteredBOMs.map((bom, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={bom.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 shrink-0">
                             <Layers className="w-4 h-4" />
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors truncate">{bom.product}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{bom.id} • {bom.type}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-2 flex justify-center items-center gap-1.5 text-xs font-mono font-medium text-slate-600">
                           <FileText size={12} className="text-slate-400" />
                           {bom.revision}
                        </div>
                        
                        <div className="col-span-2 flex justify-center text-xs font-mono text-slate-600">
                           <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{bom.components} parts</span>
                        </div>
                        
                        <div className="col-span-2 text-right text-sm font-mono font-bold text-slate-600">
                           {bom.cost > 0 ? `$${bom.cost.toFixed(2)}` : '-'}
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            bom.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {bom.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredBOMs.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Layers size={32} className="mx-auto mb-3 text-slate-300" />
                      No BOMs found.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
                  <div className="col-span-3">Product / ID</div>
                  <div className="col-span-3">Work Centers</div>
                  <div className="col-span-2 text-center">Operations</div>
                  <div className="col-span-2 text-center">Cycle Time</div>
                  <div className="col-span-2 text-right">Routing Cost</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[900px]">
                  <AnimatePresence>
                    {filteredRoutings.map((rtg, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={rtg.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-3">
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{rtg.product}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">{rtg.id}</div>
                        </div>
                        
                        <div className="col-span-3 flex items-center gap-1.5 text-xs font-mono text-slate-600">
                           {rtg.workCenters.split(',').map((wc: any, idx: any, arr: any) => (
                             <React.Fragment key={idx}>
                               <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded">{wc.trim()}</span>
                               {idx < arr.length - 1 && <ArrowRight size={10} className="text-slate-300" />}
                             </React.Fragment>
                           ))}
                        </div>
                        
                        <div className="col-span-2 flex justify-center items-center gap-1.5 text-xs font-mono font-medium text-slate-600">
                           <Cog size={12} className="text-slate-400" />
                           {rtg.steps} steps
                        </div>
                        
                        <div className="col-span-2 flex justify-center items-center gap-1.5 text-xs font-mono font-medium text-slate-600">
                           <Zap size={12} className="text-amber-400" />
                           {rtg.time}
                        </div>
                        
                        <div className="col-span-2 text-right text-sm font-mono font-bold text-slate-600">
                           $${rtg.cost.toFixed(2)}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredRoutings.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Network size={32} className="mx-auto mb-3 text-slate-300" />
                      No routings found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
