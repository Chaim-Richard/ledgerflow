import React, { useState } from 'react';
import { Building, MapPin, ArrowRightLeft, Plus, Search, Filter, Box } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function MultiWarehouse() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'transfers' | 'locations'>('inventory');

  const locations: any[] = [];

  const inventory: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Building className="w-6 h-6 text-amber-600" />
            Multi-Warehouse Operations
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Track inventory availability across global fulfillment centers, retail stores, and 3PLs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-10 px-4 bg-white border border-[#E5E5E5] text-[#0A0A0A] rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#FAFAFA] transition-colors shadow-sm">
            <ArrowRightLeft className="w-4 h-4" /> Transfer Stock
          </button>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Location
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          {locations.map((loc) => (
             <div key={loc.id} className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-[#0A0A0A]">{loc.name}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest mt-1">
                      <MapPin className="w-3 h-3" /> {loc.city}
                    </div>
                 </div>
                 <span className={cn(
                   "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border",
                   loc.type === 'Main' ? "bg-amber-50 text-amber-700 border-amber-200" :
                   loc.type === 'Regional' ? "bg-blue-50 text-blue-700 border-blue-200" :
                   "bg-emerald-50 text-emerald-700 border-emerald-200"
                 )}>
                   {loc.type}
                 </span>
               </div>
               <div className="flex justify-between items-end">
                 <div>
                   <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider block mb-1">Total SKUs</span>
                   <span className="text-2xl font-bold font-mono text-[#0A0A0A]">{loc.items.toLocaleString()}</span>
                 </div>
                 <div className="text-right">
                   <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider block mb-1">Capacity</span>
                   <div className="flex items-center gap-2">
                     <div className="w-20 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", loc.capacity > 90 ? "bg-rose-500" : "bg-[#0A0A0A]")} style={{ width: `${loc.capacity}%` }} />
                     </div>
                     <span className="text-xs font-bold font-mono">{loc.capacity}%</span>
                   </div>
                 </div>
               </div>
             </div>
          ))}
        </div>

        <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'inventory', label: 'Global Stock Levels', icon: Box },
            { id: 'transfers', label: 'Inter-Warehouse Transfers', icon: ArrowRightLeft },
            { id: 'locations', label: 'Location Map', icon: MapPin }
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

        {activeTab === 'inventory' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[#E5E5E5] bg-[#FAFAFA] flex justify-between items-center">
               <div className="relative">
                 <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
                 <input type="text" placeholder="Search SKU or Product..." className="w-80 h-9 pl-9 pr-4 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#0A0A0A]" />
               </div>
               <button className="text-xs font-bold text-[#525252] hover:text-[#0A0A0A] flex items-center gap-1">
                 <Filter className="w-3 h-3" /> Filter Variants
               </button>
            </div>
            <div className="grid grid-cols-12 p-4 bg-white border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
              <div className="col-span-4">Product / SKU</div>
              <div className="col-span-2 text-right">WH-01 (Main)</div>
              <div className="col-span-2 text-right">WH-02 (Reno)</div>
              <div className="col-span-2 text-right">WH-03 (NYC)</div>
              <div className="col-span-2 text-right">Global Total</div>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {inventory.map((item) => {
                 const total = item.wh01 + item.wh02 + item.wh03;
                 return (
                  <div key={item.sku} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] transition-colors">
                    <div className="col-span-4">
                      <div className="font-bold text-[#0A0A0A]">{item.name}</div>
                      <div className="text-[10px] font-mono text-[#A3A3A3] mt-0.5">{item.sku}</div>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm">
                       <span className={item.wh01 === 0 ? "text-rose-500 font-bold" : item.wh01 < item.reorder ? "text-amber-500 font-bold" : "text-[#525252]"}>
                         {item.wh01.toLocaleString()}
                       </span>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm">
                       <span className={item.wh02 === 0 ? "text-rose-500 font-bold" : item.wh02 < item.reorder ? "text-amber-500 font-bold" : "text-[#525252]"}>
                         {item.wh02.toLocaleString()}
                       </span>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm">
                       <span className={item.wh03 === 0 ? "text-rose-500 font-bold" : item.wh03 < item.reorder ? "text-amber-500 font-bold" : "text-[#525252]"}>
                         {item.wh03.toLocaleString()}
                       </span>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm font-bold text-[#0A0A0A]">
                      {total.toLocaleString()}
                    </div>
                  </div>
                 )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
