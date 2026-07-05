const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Star, Truck, Box, ShieldAlert, CheckCircle2, Search, Target, AlertTriangle, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_VENDORS = [
  { id: 'VEN-001', name: 'Global Logistics Corp', category: 'Transportation', onTime: 98.5, defectRate: 0.2, overall: 'A', status: 'Preferred' },
  { id: 'VEN-002', name: 'Acme Packing Supplies', category: 'Packaging', onTime: 92.0, defectRate: 1.5, overall: 'B', status: 'Approved' },
  { id: 'VEN-003', name: 'Stark Industries Tech', category: 'Components', onTime: 88.5, defectRate: 3.2, overall: 'C', status: 'Watchlist' },
  { id: 'VEN-004', name: 'Wayne Enterprises', category: 'Raw Materials', onTime: 99.2, defectRate: 0.1, overall: 'A', status: 'Preferred' },
  { id: 'VEN-005', name: 'Vandelay Imports', category: 'Logistics', onTime: 82.0, defectRate: 4.5, overall: 'D', status: 'Probation' },
];

export default function VendorScorecards() {
  const [activeTab, setActiveTab] = useState<'all' | 'watchlist'>('all');
  const [vendors] = useState(MOCK_VENDORS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            v.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'watchlist' ? v.status === 'Watchlist' || v.status === 'Probation' : true;
      return matchesSearch && matchesTab;
    });
  }, [vendors, searchTerm, activeTab]);

  const avgOnTime = vendors.reduce((acc, v) => acc + v.onTime, 0) / vendors.length;
  const watchlistCount = vendors.filter(v => v.status === 'Watchlist' || v.status === 'Probation').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Star className="w-6 h-6 text-amber-400" />
            Vendor Scorecards
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track supplier performance, delivery metrics, and quality ratings.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendors at Risk</span>
             <span className="text-lg font-mono font-bold text-rose-400">{watchlistCount}</span>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Star className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Active Vendors</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{vendors.length}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <Truck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Avg On-Time Delivery</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{avgOnTime.toFixed(1)}%</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-2">
              <Box className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">'A' Grade Suppliers</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-700">{vendors.filter(v => v.overall === 'A').length}</div>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Defect Rate &gt; 2%</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{vendors.filter(v => v.defectRate > 2).length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['all', 'watchlist'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'all' ? 'All Vendors' : 'Watchlist'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search vendors or categories..."
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
              <div className="col-span-4">Vendor</div>
              <div className="col-span-3 text-center">On-Time Delivery (30d)</div>
              <div className="col-span-2 text-center">Defect Rate</div>
              <div className="col-span-3 text-right">Overall Grade / Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[800px]">
              <AnimatePresence>
                {filteredVendors.map((v, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={v.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                         <Target size={18} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                      </div>
                      <div className="truncate pr-4">
                        <div className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">{v.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{v.category}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3 text-center flex flex-col items-center justify-center px-4">
                       <div className="text-sm font-bold font-mono text-slate-700">{v.onTime.toFixed(1)}%</div>
                       <div className="w-full max-w-[120px] mx-auto h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-500", 
                              v.onTime > 95 ? "bg-emerald-500" : 
                              v.onTime > 85 ? "bg-amber-500" : "bg-rose-500"
                            )} 
                            style={{ width: \`\${v.onTime}%\` }} 
                          />
                       </div>
                    </div>
                    
                    <div className="col-span-2 flex flex-col items-center justify-center">
                       <span className={cn(
                          "font-mono font-bold text-base",
                          v.defectRate < 1 ? "text-emerald-600" : 
                          v.defectRate < 3 ? "text-amber-600" : "text-rose-600"
                       )}>
                         {v.defectRate.toFixed(1)}%
                       </span>
                    </div>
                    
                    <div className="col-span-3 flex justify-end items-center gap-3">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                          v.status === 'Preferred' || v.status === 'Approved' ? "bg-slate-50 text-slate-600 border-slate-200" : 
                          "bg-rose-50 text-rose-700 border-rose-200 shadow-sm"
                       )}>
                          {v.status}
                       </span>
                       <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm border",
                          v.overall === 'A' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : 
                          v.overall === 'B' ? "bg-blue-50 text-blue-600 border-blue-200" : 
                          v.overall === 'C' ? "bg-amber-50 text-amber-600 border-amber-200" : 
                          "bg-rose-50 text-rose-600 border-rose-200 ring-1 ring-rose-200"
                       )}>
                          {v.overall}
                       </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredVendors.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Star size={32} className="mx-auto mb-3 text-slate-300" />
                  No vendors found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/VendorScorecards.tsx', code);
