const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Blocks, Wrench, Package, ArrowRight, Search, Plus, ListTree, PlayCircle, Settings, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_BUILDS = [
  { id: 'BLD-1021', assembly: 'Server Rack Enclosure 42U', qty: 15, components: 12, cost: 450.50, status: 'In Progress', progress: 40, date: '2026-06-25' },
  { id: 'BLD-1022', assembly: 'Office Desk Workstation', qty: 50, components: 8, cost: 125.00, status: 'Completed', progress: 100, date: '2026-06-20' },
  { id: 'BLD-1023', assembly: 'Industrial Generator X4', qty: 5, components: 45, cost: 3200.00, status: 'Pending Materials', progress: 0, date: '2026-07-01' },
  { id: 'BLD-1024', assembly: 'Solar Battery Array', qty: 12, components: 24, cost: 1850.75, status: 'Completed', progress: 100, date: '2026-06-15' },
  { id: 'BLD-1025', assembly: 'Retail Kiosk V2', qty: 25, components: 18, cost: 890.00, status: 'In Progress', progress: 85, date: '2026-06-26' },
];

export default function InventoryAssemblies() {
  const [activeTab, setActiveTab] = useState<'builds' | 'recipes'>('builds');
  const [builds] = useState(MOCK_BUILDS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBuilds = useMemo(() => {
    return builds.filter(b => 
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.assembly.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [builds, searchTerm]);

  const completedCount = builds.filter(b => b.status === 'Completed').length;
  const inProgressCount = builds.filter(b => b.status === 'In Progress').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Blocks className="w-6 h-6 text-fuchsia-400" />
            Assemblies & Kitting
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Build finished goods from raw materials based on Bill of Materials (BOM) recipes.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Builds</span>
             <span className="text-lg font-mono font-bold text-emerald-400">{inProgressCount}</span>
           </div>
           <button className="h-10 px-4 bg-fuchsia-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-fuchsia-700 transition-colors shadow-sm">
             <PlayCircle className="w-4 h-4" /> Start Assembly
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['builds', 'recipes'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'builds' ? <Wrench size={14} /> : <ListTree size={14} />}
                   {tab === 'recipes' ? 'BOM Recipes' : 'Builds'}
                 </button>
               ))}
             </div>
             
             {activeTab === 'builds' && (
               <div className="relative max-w-sm w-full">
                 <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Search build ID or assembly name..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all"
                 />
               </div>
             )}
          </div>

          {activeTab === 'builds' ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                <div className="col-span-4">Assembly / Build Ref</div>
                <div className="col-span-2 text-center">Build Qty</div>
                <div className="col-span-2 text-center">Components Used</div>
                <div className="col-span-2 text-right">Unit Est. Cost</div>
                <div className="col-span-2 text-right">Status / Progress</div>
              </div>
              
              <div className="divide-y divide-slate-100 min-w-[800px]">
                <AnimatePresence>
                  {filteredBuilds.map((b, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={b.id} 
                      className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                           <Package size={18} className="text-slate-400" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-fuchsia-600 transition-colors">{b.assembly}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{b.id} • {b.date}</div>
                        </div>
                      </div>
                      
                      <div className="col-span-2 text-center font-bold font-mono text-slate-900 text-lg">
                        {b.qty}
                      </div>
                      
                      <div className="col-span-2 text-center text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5">
                        <ListTree size={14} className="text-slate-400" />
                        {b.components} SKUs
                      </div>
                      
                      <div className="col-span-2 text-right font-bold font-mono text-emerald-600">
                        \${b.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      
                      <div className="col-span-2 flex flex-col items-end justify-center pr-2">
                        <div className="flex items-center gap-2 mb-1.5">
                           <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                              b.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              b.status === 'In Progress' ? "bg-blue-50 text-blue-700 border-blue-200" :
                              "bg-amber-50 text-amber-700 border-amber-200"
                           )}>
                              {b.status}
                           </span>
                        </div>
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-500", 
                              b.progress === 100 ? 'bg-emerald-500' : 
                              b.progress > 0 ? 'bg-blue-500' : 'bg-slate-300'
                            )} 
                            style={{ width: \`\${b.progress}%\` }} 
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredBuilds.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <Blocks size={32} className="mx-auto mb-3 text-slate-300" />
                    No active builds found.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-50 min-h-[400px]">
               <ListTree size={48} className="text-slate-300 mb-4" />
               <h3 className="text-lg font-bold text-slate-700">Bill of Materials (BOM)</h3>
               <p className="text-sm mt-2 max-w-md text-center">Define recipes and component lists for manufactured products.</p>
               <button className="mt-6 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
                 <Plus size={16} /> Create BOM
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/operations/InventoryAssemblies.tsx', code);
