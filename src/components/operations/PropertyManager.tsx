import React, { useState } from 'react';
import { Building2, Home, Key, Hammer, Users, DollarSign, Calendar, AlertCircle, Plus, Search, Filter, ArrowRight, PieChart, CheckCircle2 } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function PropertyManager() {
  const [activeTab, setActiveTab] = useState<'buildings' | 'units' | 'leases' | 'maintenance'>('buildings');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  const mockBuildings: any[] = [];

  const totalValue = mockBuildings.reduce((acc, b) => acc + b.valCents, 0);
  const totalNOI = mockBuildings.reduce((acc, b) => acc + b.noiCents, 0);
  const totalUnits = mockBuildings.reduce((acc, b) => acc + b.units, 0);
  const averageOccupancy = Math.round(mockBuildings.reduce((acc, b) => acc + (b.occupancy * b.units), 0) / totalUnits);

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Building2 className="w-6 h-6 text-indigo-600" />
            Real Estate Portfolio Manager
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Enterprise property operations. Manage buildings, units, leases, and maintenance workflows seamlessly integrated with the general ledger.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="h-10 px-4 bg-white border border-[#E5E5E5] text-[#0A0A0A] rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#FAFAFA] transition-colors shadow-sm">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Portfolio Value</span>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">${(totalValue / 100).toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Estimated NOI (Annual)</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-600">${(totalNOI / 100).toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Doors (Units)</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Home className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{totalUnits}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Avg Occupancy</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{averageOccupancy}%</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'buildings', label: 'Properties & Assets', icon: Building2 },
            { id: 'units', label: 'Units Tracker', icon: Home },
            { id: 'leases', label: 'Lease Agreements', icon: Key },
            { id: 'maintenance', label: 'Work Orders', icon: Hammer }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                activeTab === tab.id ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#F5F5F5]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activeTab === 'buildings' && (
          <div className="grid grid-cols-3 gap-6">
            {mockBuildings.map(b => (
              <div key={b.id} className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm flex flex-col group cursor-pointer hover:border-[#0A0A0A] transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#0A0A0A]">{b.name}</h3>
                    <p className="text-sm text-[#525252] mt-1">{b.address}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center text-[#0A0A0A] group-hover:bg-[#0A0A0A] group-hover:text-white transition-colors">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-auto">
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E5E5E5]">
                    <div className="text-[10px] font-bold text-[#525252] uppercase tracking-wider mb-1">Units</div>
                    <div className="text-xl font-bold text-[#0A0A0A]">{b.units}</div>
                  </div>
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E5E5E5]">
                    <div className="text-[10px] font-bold text-[#525252] uppercase tracking-wider mb-1">Occupancy</div>
                    <div className="text-xl font-bold text-[#0A0A0A]">{b.occupancy}%</div>
                  </div>
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E5E5E5]">
                    <div className="text-[10px] font-bold text-[#525252] uppercase tracking-wider mb-1">Asset Value</div>
                    <div className="text-lg font-mono font-bold text-[#0A0A0A]">${(b.valCents / 100000000).toFixed(1)}M</div>
                  </div>
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E5E5E5]">
                    <div className="text-[10px] font-bold text-[#525252] uppercase tracking-wider mb-1">Est. NOI</div>
                    <div className="text-lg font-mono font-bold text-emerald-600">${(b.noiCents / 100000000).toFixed(1)}M</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'leases' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
             <div className="grid grid-cols-6 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
               <div className="col-span-1">Unit / Bldg</div>
               <div className="col-span-1">Tenant</div>
               <div className="col-span-1">Term Start</div>
               <div className="col-span-1">Term End</div>
               <div className="col-span-1 text-right">Rent/Mo</div>
               <div className="col-span-1 text-right">Status</div>
             </div>
             <div className="divide-y divide-[#E5E5E5]">
               {[1,2,3,4,5].map(i => (
                 <div key={i} className="grid grid-cols-6 p-4 items-center hover:bg-[#FAFAFA] transition-colors text-sm">
                   <div className="col-span-1 font-bold text-[#0A0A0A]">Sunrise T. / 40{i}</div>
                   <div className="col-span-1 text-[#525252]">John Doe {i}</div>
                   <div className="col-span-1 font-mono text-[#525252]">2023-01-01</div>
                   <div className="col-span-1 font-mono text-[#525252]">2024-12-31</div>
                   <div className="col-span-1 text-right font-mono font-bold text-[#0A0A0A]">$2,450.00</div>
                   <div className="col-span-1 text-right">
                     <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold uppercase tracking-wider">Active</span>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-sm">
            <Hammer className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#0A0A0A]">Maintenance Work Orders</h3>
            <p className="text-[#525252] mt-2">Connect vendors to property issues and automatically log AP bills when work completes.</p>
            <button className="mt-6 px-6 py-2 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold hover:bg-[#1A1A1A] transition-colors">
              Configure Vendor Network
            </button>
          </div>
        )}

        {activeTab === 'units' && (
           <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-sm">
           <Home className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
           <h3 className="text-xl font-bold text-[#0A0A0A]">Unit Tracker</h3>
           <p className="text-[#525252] mt-2">Detailed per-unit revenue and expense attribution.</p>
         </div>
        )}
      </div>
    </div>
  );
}
