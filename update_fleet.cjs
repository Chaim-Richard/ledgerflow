const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Truck, MapPin, Fuel, ShieldAlert, Plus, Search, Filter, Activity, Navigation } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_VEHICLES = [
  { id: 'V-001', plate: 'GBL-8291', type: 'Heavy Duty Truck', driver: 'Marcus Johnson', fuel: '85%', status: 'On Route', location: 'I-95 North', speed: '65 mph' },
  { id: 'V-002', plate: 'GBL-8292', type: 'Heavy Duty Truck', driver: 'Sarah Connor', fuel: '45%', status: 'On Route', location: 'Route 66', speed: '55 mph' },
  { id: 'V-003', plate: 'LCL-4411', type: 'Delivery Van', driver: 'David Miller', fuel: '92%', status: 'Idle', location: 'Main Depot', speed: '0 mph' },
  { id: 'V-004', plate: 'LCL-4412', type: 'Delivery Van', driver: 'Unassigned', fuel: '20%', status: 'Maintenance', location: 'Service Center', speed: '0 mph' },
  { id: 'V-005', plate: 'SPL-9901', type: 'Refrigerated Truck', driver: 'Elena Rodriguez', fuel: '60%', status: 'On Route', location: 'State Hwy 4', speed: '62 mph' },
  { id: 'V-006', plate: 'SPL-9902', type: 'Refrigerated Truck', driver: 'Tom Hanks', fuel: '10%', status: 'Low Fuel', location: 'I-90 East', speed: '40 mph' },
];

export default function FleetManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [vehicles] = useState(MOCK_VEHICLES);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => 
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vehicles, searchTerm]);

  const activeCount = vehicles.filter(v => v.status === 'On Route' || v.status === 'Low Fuel').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'Maintenance').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Truck className="w-6 h-6 text-orange-500" />
            Fleet & Vehicle Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track company vehicles, fuel consumption, driver assignments, and telemetry.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Fleet</span>
             <span className="text-lg font-mono font-bold text-emerald-400">{activeCount} / {vehicles.length}</span>
           </div>
           <button className="h-10 px-4 bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> Add Vehicle
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <Truck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Vehicles</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{vehicles.length}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-500 mb-2">
              <Navigation className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">On Route</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600">{activeCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">In Maintenance</span>
            </div>
            <div className="text-3xl font-bold font-mono text-rose-600">{maintenanceCount}</div>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <Fuel className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Low Fuel Alerts</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-600">{vehicles.filter(v => v.status === 'Low Fuel').length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="relative max-w-md w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search by plate, driver, or vehicle ID..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
              <div className="col-span-3">Vehicle / Plate</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2 text-center">Assigned Driver</div>
              <div className="col-span-3 text-center">Telemetry (Fuel & Loc)</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[900px]">
              <AnimatePresence>
                {filteredVehicles.map((v, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={v.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors"
                  >
                    <div className="col-span-3">
                      <div className="font-bold text-slate-900 font-mono flex items-center gap-2">
                        <div className="w-8 h-6 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-[10px]">
                           {v.plate.split('-')[0]}
                        </div>
                        {v.plate}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 ml-10">{v.id}</div>
                    </div>
                    
                    <div className="col-span-2 text-sm font-bold text-slate-700">
                      {v.type}
                    </div>
                    
                    <div className="col-span-2 text-center text-xs font-bold text-slate-600">
                      {v.driver}
                    </div>
                    
                    <div className="col-span-3 flex flex-col items-center justify-center gap-1.5">
                       <div className="flex items-center gap-3 w-full justify-center text-xs font-mono font-bold text-slate-700">
                         <div className="flex items-center gap-1">
                           <Fuel className={cn("w-3.5 h-3.5", parseInt(v.fuel) < 20 ? 'text-rose-500' : 'text-slate-400')} /> 
                           <span className={cn(parseInt(v.fuel) < 20 && 'text-rose-600')}>{v.fuel}</span>
                         </div>
                         <div className="w-px h-3 bg-slate-200"></div>
                         <div className="flex items-center gap-1 text-slate-500">
                           <Activity className="w-3.5 h-3.5" /> 
                           <span>{v.speed}</span>
                         </div>
                       </div>
                       <div className="text-[10px] text-slate-500 flex items-center gap-1 max-w-full truncate">
                          <MapPin className="w-3 h-3" /> {v.location}
                       </div>
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                       <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          v.status === 'On Route' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          v.status === 'Idle' ? "bg-slate-100 text-slate-700 border-slate-200" :
                          v.status === 'Low Fuel' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-rose-50 text-rose-700 border-rose-200"
                       )}>
                          {v.status}
                       </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredVehicles.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Truck size={32} className="mx-auto mb-3 text-slate-300" />
                  No vehicles found.
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

fs.writeFileSync('src/components/operations/FleetManagement.tsx', code);
