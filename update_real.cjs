const fs = require('fs');
const code = `import React, { useState, useMemo } from 'react';
import { Home, Building, Key, FileText, CheckCircle2, AlertTriangle, Search, Plus, TrendingUp, DollarSign } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MOCK_LEASES = [
  { id: 'LSE-001', tenant: 'Acme Corp', property: 'Tech Park A', unit: 'Suite 100', rent: 15000, expires: '2027-12-31', status: 'Active' },
  { id: 'LSE-002', tenant: 'Global Tech', property: 'Tech Park B', unit: 'Suite 200', rent: 22000, expires: '2026-08-30', status: 'Expiring Soon' },
  { id: 'LSE-003', tenant: 'Wayne Industries', property: 'Downtown Tower', unit: 'Floor 40', rent: 150000, expires: '2030-01-01', status: 'Active' },
  { id: 'LSE-004', tenant: 'Stark Enterprises', property: 'Industrial Zone', unit: 'Warehouse C', rent: 45000, expires: '2026-07-15', status: 'Expiring Soon' },
  { id: 'LSE-005', tenant: 'LexCorp', property: 'Downtown Tower', unit: 'Floor 45', rent: 175000, expires: '2025-12-31', status: 'Month-to-Month' },
];

const MOCK_VACANCIES = [
  { id: 'VAC-001', property: 'Tech Park A', unit: 'Suite 105', sqft: 2500, askingRent: 7500, daysVacant: 45, status: 'Listed' },
  { id: 'VAC-002', property: 'Industrial Zone', unit: 'Warehouse D', sqft: 15000, askingRent: 35000, daysVacant: 12, status: 'Preparing' },
  { id: 'VAC-003', property: 'Downtown Tower', unit: 'Suite 300', sqft: 5000, askingRent: 25000, daysVacant: 90, status: 'Listed' },
];

export default function RealEstateLeasing() {
  const [activeTab, setActiveTab] = useState<'leases' | 'vacancies'>('leases');
  const [leases] = useState(MOCK_LEASES);
  const [vacancies] = useState(MOCK_VACANCIES);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLeases = useMemo(() => {
    return leases.filter(l => 
      l.tenant.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.unit.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [leases, searchTerm]);

  const filteredVacancies = useMemo(() => {
    return vacancies.filter(v => 
      v.property.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.unit.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vacancies, searchTerm]);

  const totalMonthlyRent = leases.filter(l => l.status !== 'Terminated').reduce((sum, l) => sum + l.rent, 0);
  const expiringCount = leases.filter(l => l.status === 'Expiring Soon').length;
  const occupancyRate = ((leases.length) / (leases.length + vacancies.length)) * 100;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Home className="w-6 h-6 text-teal-400" />
            Real Estate & Leasing
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage tenant leases, rent rolls, vacancies, and lease expirations.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Monthly Rent Roll</span>
             <span className="text-lg font-mono font-bold text-emerald-400">\${totalMonthlyRent.toLocaleString()}</span>
           </div>
           <button className="h-10 px-4 bg-teal-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-teal-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> New Lease
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Leases</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900">{leases.length}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Occupancy Rate</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{occupancyRate.toFixed(1)}%</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Expiring Soon (90d)</span>
            </div>
            <div className="text-3xl font-bold font-mono text-amber-700">{expiringCount}</div>
          </div>
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <Key className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Vacant Units</span>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-600">{vacancies.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {[
                 { id: 'leases', label: 'Lease Agreements', icon: FileText },
                 { id: 'vacancies', label: 'Vacancy & Listings', icon: Key }
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
                 placeholder={activeTab === 'leases' ? "Search tenants or properties..." : "Search properties or units..."}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'leases' ? (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                  <div className="col-span-3">Tenant / Ref</div>
                  <div className="col-span-3">Property & Unit</div>
                  <div className="col-span-2 text-right">Monthly Rent</div>
                  <div className="col-span-2 text-center">Expiration Date</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[800px]">
                  <AnimatePresence>
                    {filteredLeases.map((lease, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={lease.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                             <FileText size={18} className="text-slate-400 group-hover:text-teal-500 transition-colors" />
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors truncate">{lease.tenant}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{lease.id}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-3">
                           <div className="font-bold text-slate-700">{lease.unit}</div>
                           <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                             <Building size={12} /> {lease.property}
                           </div>
                        </div>
                        
                        <div className="col-span-2 text-right font-mono font-bold text-emerald-600 text-base">
                          \${lease.rent.toLocaleString()}
                        </div>
                        
                        <div className="col-span-2 text-center text-xs font-mono font-bold text-slate-600">
                           {lease.expires}
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            lease.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            lease.status === 'Expiring Soon' ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" :
                            "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {lease.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredLeases.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Home size={32} className="mx-auto mb-3 text-slate-300" />
                      No leases found.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                  <div className="col-span-4">Property & Unit</div>
                  <div className="col-span-2 text-right">Square Feet</div>
                  <div className="col-span-2 text-right">Asking Rent</div>
                  <div className="col-span-2 text-center">Days Vacant</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                
                <div className="divide-y divide-slate-100 min-w-[800px]">
                  <AnimatePresence>
                    {filteredVacancies.map((v, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={v.id} 
                        className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                             <Key size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                          </div>
                          <div className="truncate pr-4">
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{v.unit}</div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{v.property}</div>
                          </div>
                        </div>
                        
                        <div className="col-span-2 text-right text-sm font-bold text-slate-700">
                          {v.sqft.toLocaleString()} sqft
                        </div>
                        
                        <div className="col-span-2 text-right font-mono font-bold text-emerald-600 text-base">
                          \${v.askingRent.toLocaleString()}
                        </div>
                        
                        <div className="col-span-2 text-center">
                           <span className={cn(
                             "font-mono font-bold px-2 py-1 rounded",
                             v.daysVacant > 60 ? "text-rose-600 bg-rose-50" : "text-slate-600"
                           )}>
                             {v.daysVacant} days
                           </span>
                        </div>
                        
                        <div className="col-span-2 flex justify-end">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            v.status === 'Listed' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {v.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {filteredVacancies.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Key size={32} className="mx-auto mb-3 text-slate-300" />
                      No vacancies found.
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
`;
fs.writeFileSync('src/components/operations/RealEstateLeasing.tsx', code);
