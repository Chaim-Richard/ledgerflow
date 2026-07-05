import React, { useState } from 'react';
import { Factory, Cog, Package, Truck, Activity, Plus, Search, Filter, Wrench, CalendarClock, Settings2, BarChart2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

type WorkOrder = {
  id: string;
  product: string;
  sku: string;
  quantity: number;
  center: string;
  status: 'Queued' | 'In Progress' | 'Blocked' | 'Completed';
  startDate: string;
  estimatedCompletion: string;
  completion: number;
};

export default function ManufacturingHub() {
  const [activeTab, setActiveTab] = useState<'work-orders' | 'boms' | 'work-centers'>('work-orders');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([
    { id: 'WO-10245', product: 'Pro Widget v2', sku: 'FNG-505', quantity: 1500, center: 'Assembly Line 1', status: 'In Progress', startDate: '2024-07-01', estimatedCompletion: '2024-07-05', completion: 45 },
    { id: 'WO-10246', product: 'Bearing Assembly', sku: 'CMP-101', quantity: 5000, center: 'CNC Machining', status: 'Queued', startDate: '2024-07-03', estimatedCompletion: '2024-07-06', completion: 0 },
    { id: 'WO-10247', product: 'Aluminum Frame', sku: 'CMP-202', quantity: 300, center: 'Welding Station', status: 'Blocked', startDate: '2024-06-30', estimatedCompletion: '2024-07-02', completion: 80 }
  ]);

  const activeOrders = workOrders.filter(wo => wo.status === 'In Progress').length;
  const blockedOrders = workOrders.filter(wo => wo.status === 'Blocked').length;
  const totalVolume = workOrders.reduce((a, b) => a + (b.status !== 'Completed' ? b.quantity : 0), 0);

  const handleCreateWO = () => {
    const product = prompt("Enter product to manufacture:");
    if (product) {
      setWorkOrders(prev => [{
        id: `WO-${Math.floor(10000 + Math.random() * 90000)}`,
        product,
        sku: 'NEW-001',
        quantity: 100,
        center: 'Assembly Line',
        status: 'Queued',
        startDate: new Date().toISOString().split('T')[0],
        estimatedCompletion: 'TBD',
        completion: 0
      }, ...prev]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Factory className="w-6 h-6 text-orange-600" />
            Manufacturing & MRP Hub
          </h1>
          <p className="text-sm text-[#525252] mt-1">Enterprise resource planning. Manage Bills of Materials (BOM), Work Orders, and Production floor efficiency.</p>
        </div>
        <button 
          onClick={handleCreateWO}
          className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Work Order
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Active Work Orders</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Cog className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{activeOrders}</div>
          </div>
          
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Blocked / Shortages</span>
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                <Activity className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-rose-600">{blockedOrders}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Production Volume</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <Package className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{totalVolume.toLocaleString()}</div>
            <span className="text-xs text-[#525252] font-medium mt-1">Units in pipeline</span>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Floor OEE</span>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">84.2%</div>
            <span className="text-xs text-[#525252] font-medium mt-1">Overall Equipment Effectiveness</span>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm">
            {[
              { id: 'work-orders', label: 'Work Orders' },
              { id: 'boms', label: 'Bills of Materials' },
              { id: 'work-centers', label: 'Work Centers' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                  activeTab === tab.id ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#F5F5F5]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'work-orders' && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Search work orders..."
                  className="w-64 h-10 pl-9 pr-4 bg-white border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
              <button className="h-10 px-4 bg-white border border-[#E5E5E5] rounded-xl flex items-center gap-2 hover:bg-[#FAFAFA] text-sm font-medium">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        {activeTab === 'work-orders' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
              <div className="col-span-2">WO #</div>
              <div className="col-span-3">Product</div>
              <div className="col-span-2">Work Center</div>
              <div className="col-span-2">Timeline</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Progress</div>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {workOrders.map((wo) => (
                <div key={wo.id} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] transition-colors">
                  <div className="col-span-2 font-mono text-sm font-bold text-[#0A0A0A]">{wo.id}</div>
                  <div className="col-span-3">
                    <div className="font-bold text-[#0A0A0A]">{wo.product}</div>
                    <div className="text-xs text-[#525252] font-mono mt-0.5">{wo.sku} • {wo.quantity.toLocaleString()} units</div>
                  </div>
                  <div className="col-span-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#FAFAFA] border border-[#E5E5E5] rounded text-xs font-bold text-[#525252]">
                      <Wrench className="w-3 h-3" /> {wo.center}
                    </span>
                  </div>
                  <div className="col-span-2 text-xs text-[#525252] flex flex-col gap-0.5">
                    <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {wo.startDate}</span>
                    <span>To: {wo.estimatedCompletion}</span>
                  </div>
                  <div className="col-span-1">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      wo.status === 'In Progress' ? "bg-blue-100 text-blue-700" :
                      wo.status === 'Blocked' ? "bg-rose-100 text-rose-700" :
                      wo.status === 'Completed' ? "bg-emerald-100 text-emerald-700" :
                      "bg-[#E5E5E5] text-[#525252]"
                    )}>
                      {wo.status}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-3 justify-end">
                      <div className="w-24 h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-500", wo.status === 'Blocked' ? 'bg-rose-500' : 'bg-[#0A0A0A]')} 
                          style={{ width: `${wo.completion}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-[#0A0A0A] w-8 text-right">{wo.completion}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'boms' && (
          <div className="text-center p-12 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <Settings2 className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#0A0A0A]">Bills of Materials</h3>
            <p className="text-[#525252]">Define the components and routing steps required to manufacture products.</p>
          </div>
        )}

        {activeTab === 'work-centers' && (
          <div className="text-center p-12 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <Factory className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#0A0A0A]">Work Centers</h3>
            <p className="text-[#525252]">Manage machines, assembly lines, and routing resources.</p>
          </div>
        )}
      </div>
    </div>
  );
}
