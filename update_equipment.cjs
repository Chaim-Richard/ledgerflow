const fs = require('fs');

const equipCode = `import React, { useState } from 'react';
import { Wrench, Search, Plus, Filter, AlertTriangle, Settings, Clock, CheckCircle2, Factory } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_EQUIPMENT = [
  { id: 'EQ-001', name: 'CNC Milling Machine Alpha', type: 'Manufacturing', status: 'operational', lastService: '2026-05-10', nextService: '2026-08-10', condition: 92 },
  { id: 'EQ-002', name: 'Industrial Conveyor Belt B', type: 'Logistics', status: 'maintenance', lastService: '2026-06-15', nextService: '2026-07-01', condition: 65 },
  { id: 'EQ-003', name: 'Forklift - Hyster 30', type: 'Warehouse', status: 'down', lastService: '2026-02-20', nextService: '2026-06-25', condition: 40 },
  { id: 'EQ-004', name: 'Laser Cutter Pro', type: 'Manufacturing', status: 'operational', lastService: '2026-06-01', nextService: '2026-09-01', condition: 98 },
  { id: 'EQ-005', name: 'Automated Packaging Arm', type: 'Logistics', status: 'warning', lastService: '2026-04-12', nextService: '2026-07-12', condition: 78 },
  { id: 'EQ-006', name: 'HVAC System - Server Room', type: 'Facilities', status: 'operational', lastService: '2026-01-10', nextService: '2026-07-10', condition: 85 },
  { id: 'EQ-007', name: '3D Printer Array', type: 'Prototyping', status: 'operational', lastService: '2026-05-22', nextService: '2026-08-22', condition: 95 },
];

export default function EquipmentMaintenance() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'work-orders'>('inventory');
  const [equipment] = useState(MOCK_EQUIPMENT);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredEquipment = equipment.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downtimeCount = equipment.filter(e => e.status === 'down').length;
  const maintenanceCount = equipment.filter(e => e.status === 'maintenance' || e.status === 'warning').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Wrench className="w-6 h-6 text-amber-500" />
            Equipment & Maintenance
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track asset health, preventative maintenance schedules, and work orders.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 mr-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            <div className="flex flex-col items-center px-4 border-r border-slate-700">
              <span className="text-2xl font-bold font-mono text-emerald-400">{equipment.length - downtimeCount - maintenanceCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operational</span>
            </div>
            <div className="flex flex-col items-center px-4 border-r border-slate-700">
              <span className="text-2xl font-bold font-mono text-amber-400">{maintenanceCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Needs Maint</span>
            </div>
            <div className="flex flex-col items-center px-4">
              <span className="text-2xl font-bold font-mono text-rose-500">{downtimeCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Offline</span>
            </div>
          </div>
          <button className="h-10 px-4 bg-amber-500 text-slate-900 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-400 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['inventory', 'work-orders'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab.replace('-', ' ')}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full flex items-center gap-2">
               <div className="relative flex-1">
                 <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Search assets or types..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                 />
               </div>
               <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
                 <Filter size={18} />
               </button>
             </div>
          </div>

          {activeTab === 'inventory' && (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
                <div className="col-span-3">Asset Name & ID</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-3 text-center">Maintenance Schedule</div>
                <div className="col-span-2 text-right">Condition Health</div>
              </div>
              <div className="divide-y divide-slate-100 min-w-[900px]">
                <AnimatePresence>
                  {filteredEquipment.map((e, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={e.id} 
                      className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
                    >
                      <div className="col-span-3">
                        <div className="font-bold text-slate-900">{e.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{e.id}</div>
                      </div>
                      
                      <div className="col-span-2">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                          {e.type}
                        </span>
                      </div>
                      
                      <div className="col-span-2 flex justify-center">
                        <span className={cn(
                          "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          e.status === 'operational' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          e.status === 'maintenance' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          e.status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        )}>
                          {e.status === 'operational' && <CheckCircle2 size={12} />}
                          {e.status === 'maintenance' && <Settings size={12} className="animate-spin-slow" />}
                          {e.status === 'warning' && <AlertTriangle size={12} />}
                          {e.status === 'down' && <AlertTriangle size={12} />}
                          {e.status}
                        </span>
                      </div>

                      <div className="col-span-3 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-4 text-xs font-mono font-medium text-slate-600">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] uppercase tracking-wider text-slate-400">Last</span>
                            <span>{e.lastService}</span>
                          </div>
                          <ArrowRight size={14} className="text-slate-300" />
                          <div className="flex flex-col items-center text-indigo-600 font-bold">
                            <span className="text-[9px] uppercase tracking-wider text-indigo-400">Next</span>
                            <span>{e.nextService}</span>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 flex flex-col items-end justify-center pr-2">
                        <div className="flex items-center gap-2 w-full justify-end">
                           <span className={cn("text-xs font-bold font-mono", e.condition > 80 ? "text-emerald-600" : e.condition > 50 ? "text-amber-600" : "text-rose-600")}>
                             {e.condition}%
                           </span>
                           <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                             <div className={cn("h-full rounded-full", e.condition > 80 ? "bg-emerald-500" : e.condition > 50 ? "bg-amber-500" : "bg-rose-500")} style={{ width: \`\${e.condition}%\` }} />
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredEquipment.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <Factory size={32} className="mx-auto mb-3 text-slate-300" />
                    No assets found matching your criteria.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'work-orders' && (
             <div className="p-12 text-center text-slate-500">
                <Settings size={32} className="mx-auto mb-3 text-slate-300 animate-spin-slow" />
                <p className="font-medium text-slate-600">Work Orders Module</p>
                <p className="text-sm mt-1">Maintenance schedules and technician assignments will appear here.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/operations/EquipmentMaintenance.tsx', equipCode);
