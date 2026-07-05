const fs = require('fs');

const supplyCode = `import React, { useState } from 'react';
import { Network, Search, Filter, Truck, ArrowRight, Zap, Target, Factory, CalendarClock, PackageOpen, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_COMPONENTS = [
  { id: 'COMP-001', name: 'Titanium Casing', supplier: 'MetalWorks Inc', leadTime: 45, onHand: 1200, required: 1500, status: 'shortage', cost: 125.50 },
  { id: 'COMP-002', name: 'Lithium Battery Pack', supplier: 'VoltCore', leadTime: 30, onHand: 500, required: 450, status: 'ok', cost: 85.00 },
  { id: 'COMP-003', name: 'OLED Display Panel', supplier: 'ScreenTech', leadTime: 60, onHand: 800, required: 2000, status: 'critical', cost: 210.00 },
  { id: 'COMP-004', name: 'Logic Board v2', supplier: 'MicroFab', leadTime: 20, onHand: 3500, required: 3000, status: 'ok', cost: 45.75 },
  { id: 'COMP-005', name: 'Haptic Motor', supplier: 'MotionDyn', leadTime: 15, onHand: 150, required: 800, status: 'critical', cost: 12.20 },
  { id: 'COMP-006', name: 'Camera Module Array', supplier: 'OpticLens', leadTime: 40, onHand: 2100, required: 2000, status: 'warning', cost: 145.00 },
  { id: 'COMP-007', name: 'Antenna Band', supplier: 'MetalWorks Inc', leadTime: 25, onHand: 4000, required: 3800, status: 'ok', cost: 8.50 },
];

export default function SupplyChainControl() {
  const [activeTab, setActiveTab] = useState<'mrp' | 'suppliers' | 'routes'>('mrp');
  const [components] = useState(MOCK_COMPONENTS);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredComponents = components.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const criticalShortages = components.filter(c => c.status === 'critical').length;
  const totalValueAtRisk = components.filter(c => c.status !== 'ok').reduce((sum, c) => sum + ((c.required - c.onHand) * c.cost), 0);
  
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Factory className="w-6 h-6 text-emerald-400" />
            Supply Chain & MRP
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Material Requirements Planning, supplier lead times, and bill of materials (BOM) management.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value at Risk</span>
             <span className="text-lg font-mono font-bold text-rose-400">\${totalValueAtRisk.toLocaleString()}</span>
           </div>
          <button className="h-10 px-5 bg-emerald-500 text-slate-900 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-400 transition-colors shadow-sm">
            <Zap className="w-4 h-4" /> Run MRP Engine
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Suppliers</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <Truck className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">24</div>
          </div>
          
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Lead Time</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">33.5 <span className="text-sm font-medium text-slate-500">days</span></div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tracked Components</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <PackageOpen className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{components.length}</div>
          </div>

          <div className="p-6 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Critical Shortages</span>
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-rose-700">{criticalShortages}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['mrp', 'suppliers', 'routes'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab}
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
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
               />
             </div>
          </div>

          {activeTab === 'mrp' && (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                <div className="col-span-3">Component</div>
                <div className="col-span-2">Supplier</div>
                <div className="col-span-1 text-center">Lead Time</div>
                <div className="col-span-2 text-right">On Hand</div>
                <div className="col-span-2 text-right">Required</div>
                <div className="col-span-2 text-center">Status</div>
              </div>
              <div className="divide-y divide-slate-100 min-w-[800px]">
                <AnimatePresence>
                  {filteredComponents.map((c, i) => {
                    const diff = c.onHand - c.required;
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={c.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
                      >
                        <div className="col-span-3">
                          <div className="font-bold text-slate-900">{c.name}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{c.id}</div>
                        </div>
                        <div className="col-span-2 text-sm font-medium text-slate-600 flex items-center gap-2">
                           <Factory size={14} className="text-slate-400" />
                           {c.supplier}
                        </div>
                        <div className="col-span-1 text-center font-mono text-xs text-slate-600">
                          {c.leadTime}d
                        </div>
                        <div className="col-span-2 text-right font-mono font-bold text-slate-700">
                          {c.onHand.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-mono font-bold">
                          {c.required.toLocaleString()}
                          {diff < 0 && (
                            <span className="block text-[10px] text-rose-500">Short: {Math.abs(diff).toLocaleString()}</span>
                          )}
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            c.status === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            c.status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
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
            </div>
          )}
          
          {activeTab !== 'mrp' && (
             <div className="p-12 text-center text-slate-500">
                <Network size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="font-medium text-slate-600">Module under construction</p>
                <p className="text-sm mt-1">This module is currently being optimized for high-volume logistics.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/operations/SupplyChainControl.tsx', supplyCode);
