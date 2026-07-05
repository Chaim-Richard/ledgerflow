import React, { useState } from 'react';
import { Database, Plus, Search, Filter, Box, ArrowRight, CheckCircle2, Factory } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function ProcurementHub() {
  const [activeTab, setActiveTab] = useState<'all' | 'drafts' | 'pending' | 'received'>('pending');

  const mockPOs = [
    { id: 'PO-2024-001', vendor: 'Global Supply Co', amount: 1250000, date: '2024-07-01', status: 'pending', items: 12 },
    { id: 'PO-2024-002', vendor: 'Techtronics Inc', amount: 450000, date: '2024-06-28', status: 'pending', items: 3 },
    { id: 'PO-2024-003', vendor: 'Office Needs Ltd', amount: 85000, date: '2024-06-15', status: 'received', items: 45 },
  ].filter(po => po.status === activeTab || activeTab === 'all');

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Database className="w-6 h-6 text-[#0A0A0A]" />
            Procurement & Purchase Orders
          </h1>
          <p className="text-sm text-[#525252] mt-1">Manage the end-to-end purchasing lifecycle from requisition to receipt.</p>
        </div>
        <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Create PO
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Pending Approval', value: '4', icon: CheckCircle2, color: 'text-amber-600', bg: 'bg-amber-100' },
            { label: 'Awaiting Receipt', value: '12', icon: Box, color: 'text-blue-600', bg: 'bg-blue-100' },
            { label: 'Total Committed', value: '$84,500', icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { label: 'Active Vendors', value: '24', icon: Factory, color: 'text-purple-600', bg: 'bg-purple-100' },
          ].map((kpi, i) => (
            <div key={i} className="p-6 bg-white rounded-2xl border border-[#E5E5E5] flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">{kpi.label}</span>
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", kpi.bg)}>
                  <kpi.icon className={cn("w-4 h-4", kpi.color)} />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#0A0A0A]">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm">
            {['all', 'drafts', 'pending', 'received'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all",
                  activeTab === tab ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#F5F5F5]"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search POs..."
                className="w-64 h-10 pl-9 pr-4 bg-white border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>
            <button className="h-10 px-4 bg-white border border-[#E5E5E5] rounded-xl flex items-center gap-2 hover:bg-[#FAFAFA] text-sm font-medium">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-6 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
            <div className="col-span-1">PO Number</div>
            <div className="col-span-2">Vendor</div>
            <div className="col-span-1">Date</div>
            <div className="col-span-1 text-right">Amount</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          <div className="divide-y divide-[#E5E5E5]">
            {mockPOs.map((po) => (
              <div key={po.id} className="grid grid-cols-6 p-4 items-center hover:bg-[#FAFAFA] transition-colors">
                <div className="col-span-1 font-mono text-sm font-bold text-[#0A0A0A]">{po.id}</div>
                <div className="col-span-2">
                  <div className="font-bold text-[#0A0A0A]">{po.vendor}</div>
                  <div className="text-xs text-[#525252]">{po.items} items</div>
                </div>
                <div className="col-span-1 text-sm text-[#525252]">{po.date}</div>
                <div className="col-span-1 text-right font-mono text-sm font-bold text-[#0A0A0A]">
                  ${(po.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="col-span-1 text-right">
                  {po.status === 'pending' ? (
                    <button className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                      Receive Items
                    </button>
                  ) : (
                    <button className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-colors">
                      View Bill
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
