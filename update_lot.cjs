const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { PackageSearch, QrCode, ArrowRightLeft, ShieldCheck, Search, SearchCode, AlertCircle, History } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_LOTS = [
  { lotNumber: 'LOT-99201A', item: 'Titanium Casings (Batch 4)', origin: 'PO-9912', expiry: '2028-12-01', qty: 450, status: 'In Stock' },
  { lotNumber: 'LOT-99202B', item: 'Organic Vanilla Extract', origin: 'RCV-441', expiry: '2026-08-15', qty: 120, status: 'Expiring Soon' },
  { lotNumber: 'LOT-99203C', item: 'Logic Board v2', origin: 'MFG-882', expiry: 'N/A', qty: 0, status: 'Depleted' },
  { lotNumber: 'LOT-99204D', item: 'Medical Grade Silicon', origin: 'PO-9915', expiry: '2027-05-30', qty: 850, status: 'In Stock' },
  { lotNumber: 'LOT-99205E', item: 'Haptic Motors', origin: 'RCV-442', expiry: 'N/A', qty: 200, status: 'Quarantine' },
];

export default function LotTracking() {
  const [activeTab, setActiveTab] = useState<'lots' | 'trace'>('lots');
  const [lots] = useState(MOCK_LOTS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLots = useMemo(() => {
    return lots.filter(l => 
      l.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.origin.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [lots, searchTerm]);

  const inStockCount = lots.filter(l => l.status === 'In Stock').length;
  const quarantinedCount = lots.filter(l => l.status === 'Quarantine').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <QrCode className="w-6 h-6 text-indigo-400" />
            Serial & Lot Traceability
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            End-to-end lineage tracking from vendor receipt through manufacturing to end customer.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Lots</span>
             <span className="text-lg font-mono font-bold text-indigo-400">{inStockCount}</span>
           </div>
           <button className="h-10 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
             <SearchCode className="w-4 h-4" /> Trace Lot
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <PackageSearch className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Tracked</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{lots.length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">In Stock</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">{inStockCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Expiring &lt; 90D</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-600">{lots.filter(l => l.status === 'Expiring Soon').length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <ArrowRightLeft className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">In Quarantine</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{quarantinedCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['lots', 'trace'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'lots' ? <QrCode size={14} /> : <History size={14} />}
                   {tab === 'lots' ? 'Lot Registry' : 'Traceability Logs'}
                 </button>
               ))}
             </div>
             
             {activeTab === 'lots' && (
               <div className="relative max-w-sm w-full">
                 <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Scan or search lot number..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                 />
               </div>
             )}
          </div>

          {activeTab === 'lots' ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                <div className="col-span-3">Lot Number / Item</div>
                <div className="col-span-2 text-center">Origin Ref</div>
                <div className="col-span-2 text-center">Expiry Date</div>
                <div className="col-span-2 text-right">Available Qty</div>
                <div className="col-span-3 text-right">Status</div>
              </div>
              
              <div className="divide-y divide-slate-100 min-w-[800px]">
                <AnimatePresence>
                  {filteredLots.map((l, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={l.lotNumber} 
                      className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                           <QrCode size={18} className="text-slate-400" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 font-mono group-hover:text-indigo-600 transition-colors">{l.lotNumber}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{l.item}</div>
                        </div>
                      </div>
                      
                      <div className="col-span-2 flex justify-center">
                         <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold font-mono border border-slate-200">
                           {l.origin}
                         </span>
                      </div>
                      
                      <div className="col-span-2 text-center">
                         {l.expiry === 'N/A' ? (
                           <span className="text-slate-400 text-xs font-mono font-bold">-</span>
                         ) : (
                           <span className={cn(
                             "text-xs font-mono font-bold", 
                             l.status === 'Expiring Soon' ? "text-amber-600 bg-amber-50 px-2 py-1 rounded" : "text-slate-600"
                           )}>
                             {l.expiry}
                           </span>
                         )}
                      </div>
                      
                      <div className="col-span-2 text-right font-bold font-mono text-slate-900 text-lg">
                        {l.qty.toLocaleString()}
                      </div>
                      
                      <div className="col-span-3 flex justify-end">
                         <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            l.status === 'In Stock' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            l.status === 'Expiring Soon' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            l.status === 'Quarantine' ? "bg-rose-50 text-rose-700 border-rose-200" :
                            "bg-slate-100 text-slate-500 border-slate-200"
                         )}>
                            {l.status}
                         </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredLots.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <QrCode size={32} className="mx-auto mb-3 text-slate-300" />
                    No lots found.
                  </div>
                )}
              </div>
            </div>
          ) : (
             <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-50 min-h-[400px]">
               <SearchCode size={48} className="text-slate-300 mb-4" />
               <h3 className="text-lg font-bold text-slate-700">Enter a Lot or Serial Number</h3>
               <p className="text-sm mt-2 max-w-md text-center">Scan or type a code to view its complete origin, manufacturing, and distribution lineage.</p>
               <div className="mt-6 relative max-w-md w-full">
                 <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Scan barcode..." 
                   className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                 />
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/LotTracking.tsx', code);
