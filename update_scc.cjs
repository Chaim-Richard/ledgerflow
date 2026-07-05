const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Truck, CalendarClock, PackageOpen, AlertTriangle, Search, Factory, Network, Download, Play, StopCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_COMPONENTS = [
  { id: 'COMP-101', name: 'Titanium Casing v2', supplier: 'Acme Materials', leadTime: 45, onHand: 1200, required: 5000, status: 'critical' },
  { id: 'COMP-102', name: 'Lithium Cell 5000mAh', supplier: 'Massive Dynamic', leadTime: 30, onHand: 8500, required: 8000, status: 'ok' },
  { id: 'COMP-103', name: 'OLED Display Panel', supplier: 'Globex Corp', leadTime: 60, onHand: 450, required: 1000, status: 'critical' },
  { id: 'COMP-104', name: 'Micro-Controller A1', supplier: 'Stark Industries', leadTime: 15, onHand: 12000, required: 15000, status: 'warning' },
  { id: 'COMP-105', name: 'Thermal Paste Tube', supplier: 'Wayne Enterprises', leadTime: 5, onHand: 500, required: 200, status: 'ok' },
];

export default function SupplyChainControl() {
  const [activeTab, setActiveTab] = useState<'mrp' | 'suppliers' | 'routes'>('mrp');
  const [components] = useState(MOCK_COMPONENTS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredComponents = useMemo(() => {
    return components.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [components, searchTerm]);

  const criticalShortages = components.filter(c => c.status === 'critical').length;
  const avgLeadTime = components.reduce((acc, c) => acc + c.leadTime, 0) / components.length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Network className="w-6 h-6 text-indigo-400" />
            Supply Chain & MRP Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Material Requirements Planning, supplier logistics, and shortage forecasting.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <button className="h-10 px-4 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
             <Download className="w-4 h-4" /> Export MRP
           </button>
           <button className="h-10 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
             <Play className="w-4 h-4" /> Run MRP Engine
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Truck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Suppliers</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">24</div>
          </div>
          <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-200 shadow-sm">
            <div className="flex items-center gap-3 text-indigo-600 mb-2">
              <CalendarClock className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Avg Lead Time</span>
            </div>
            <div className="text-3xl font-bold font-mono text-indigo-700">{avgLeadTime.toFixed(1)} <span className="text-sm font-medium text-indigo-500">days</span></div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <PackageOpen className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Tracked Components</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{components.length}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Critical Shortages</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{criticalShortages}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[calc(100%-140px)]">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
             <div className="flex space-x-1 p-1 bg-white rounded-lg w-max border border-slate-200">
               {['mrp', 'suppliers', 'routes'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm" : "bg-white text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'mrp' ? 'MRP Board' : tab === 'suppliers' ? 'Supplier Map' : 'Transit Routes'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search components or suppliers..."
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
               />
             </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {activeTab === 'mrp' && (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
                  <div className="col-span-3">Component</div>
                  <div className="col-span-3">Supplier</div>
                  <div className="col-span-1 text-center">Lead Time</div>
                  <div className="col-span-2 text-right">On Hand</div>
                  <div className="col-span-2 text-right">Required Target</div>
                  <div className="col-span-1 text-center">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[900px]">
                  <AnimatePresence>
                    {filteredComponents.map((c, i) => {
                      const diff = c.onHand - c.required;
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={c.id} 
                          className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                        >
                          <div className="col-span-3 flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                               <PackageOpen className="w-4 h-4" />
                            </div>
                            <div className="truncate pr-4">
                              <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{c.name}</div>
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">{c.id}</div>
                            </div>
                          </div>
                          
                          <div className="col-span-3 text-sm font-bold text-slate-700 flex items-center gap-2 truncate pr-4">
                             <Factory size={14} className="text-slate-400 shrink-0" />
                             <span className="truncate">{c.supplier}</span>
                          </div>
                          
                          <div className="col-span-1 flex justify-center items-center gap-1.5 text-xs font-mono font-medium text-slate-600">
                             <CalendarClock size={12} className="text-slate-400" />
                             {c.leadTime}d
                          </div>
                          
                          <div className="col-span-2 text-right text-sm font-mono font-bold text-slate-700">
                            {c.onHand.toLocaleString()}
                          </div>
                          
                          <div className="col-span-2 flex flex-col items-end px-4">
                            <span className="text-sm font-mono font-bold">{c.required.toLocaleString()}</span>
                            {diff < 0 && (
                              <span className="text-[10px] font-bold font-mono text-rose-500 mt-0.5">Short: {Math.abs(diff).toLocaleString()}</span>
                            )}
                          </div>
                          
                          <div className="col-span-1 flex justify-center">
                            <span className={cn(
                              "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                              c.status === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                              c.status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                              'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                            )}>
                              {c.status}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {filteredComponents.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <PackageOpen size={32} className="mx-auto mb-3 text-slate-300" />
                      No components found matching your search.
                    </div>
                  )}
                </div>
              </>
            )}
            
            {activeTab !== 'mrp' && (
               <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                  <Network size={48} className="mb-4 text-slate-300" />
                  <p className="text-lg font-bold text-slate-900 mb-1">Module Under Construction</p>
                  <p className="text-sm font-medium">This module is currently being optimized for high-volume logistics.</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/SupplyChainControl.tsx', code);
