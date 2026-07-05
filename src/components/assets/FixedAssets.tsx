import React, { useState } from 'react';
import { Briefcase, Calendar, TrendingDown, Info, Plus, Search, Filter, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function FixedAssetDepreciation() {
  const [activeTab, setActiveTab] = useState<'register' | 'schedule'>('register');
  
  const mockAssets: any[] = [];

  const totalCost = mockAssets.reduce((sum, a) => sum + a.costCents, 0);
  const totalAccDepr = mockAssets.reduce((sum, a) => sum + a.accDeprCents, 0);
  const netBookValue = totalCost - totalAccDepr;

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            Fixed Asset Register
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Manage long-term assets, depreciation schedules, and automated journal entries for accumulated depreciation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search assets..."
              className="w-64 h-10 pl-9 pr-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Register Asset
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Gross Asset Cost</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">${(totalCost / 100).toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Accumulated Depreciation</span>
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-rose-600">${(totalAccDepr / 100).toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm bg-indigo-900 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Net Book Value</span>
              <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center border border-indigo-700">
                <Info className="w-4 h-4 text-indigo-200" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">${(netBookValue / 100).toLocaleString()}</div>
            <div className="text-[10px] font-medium text-indigo-300 mt-2">Total carrying value on balance sheet</div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'register', label: 'Asset Register', icon: Briefcase },
            { id: 'schedule', label: 'Depreciation Schedule', icon: Calendar }
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
        {activeTab === 'register' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
              <div className="col-span-1">ID</div>
              <div className="col-span-3">Asset Description</div>
              <div className="col-span-2">Class / Method</div>
              <div className="col-span-2 text-right">Orig. Cost</div>
              <div className="col-span-2 text-right">Acc. Depr</div>
              <div className="col-span-2 text-right">Net Book Value</div>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {mockAssets.map((asset) => {
                const nbv = asset.costCents - asset.accDeprCents;
                return (
                  <div key={asset.id} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] transition-colors cursor-pointer group">
                    <div className="col-span-1 font-mono text-xs font-bold text-[#A3A3A3]">{asset.id}</div>
                    <div className="col-span-3 pr-4">
                      <div className="font-bold text-[#0A0A0A] truncate">{asset.name}</div>
                      <div className="text-xs text-[#525252] mt-0.5">Acquired: {asset.date}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm font-bold text-[#0A0A0A]">{asset.class}</div>
                      <div className="text-[10px] uppercase font-bold text-[#525252] mt-0.5">{asset.method} ({asset.lifeYears}y)</div>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm text-[#525252]">
                      ${(asset.costCents / 100).toLocaleString()}
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm text-rose-600">
                      -${(asset.accDeprCents / 100).toLocaleString()}
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-3">
                      <span className="font-mono text-sm font-bold text-[#0A0A0A]">${(nbv / 100).toLocaleString()}</span>
                      <button className="text-[#A3A3A3] hover:text-[#0A0A0A] opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
           <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-sm">
             <Calendar className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
             <h3 className="text-xl font-bold text-[#0A0A0A]">Automated Schedules</h3>
             <p className="text-[#525252] mt-2 max-w-md mx-auto">
               The system automatically calculates and posts journal entries for accumulated depreciation based on the schedule rules at period close.
             </p>
             <button className="mt-6 px-6 py-2 bg-white border border-[#E5E5E5] text-[#0A0A0A] rounded-xl text-sm font-bold hover:bg-[#FAFAFA] transition-colors">
               Run Trial Depreciation
             </button>
           </div>
        )}
      </div>
    </div>
  );
}
