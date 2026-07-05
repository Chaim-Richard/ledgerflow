import React, { useState } from 'react';
import { Target, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, CreditCard, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function SegmentedReporting() {
  const [activeSegment, setActiveSegment] = useState<'region' | 'department' | 'product'>('region');

  const mockData = {
    region: [
      { id: 'NA', name: 'North America', rev: 12500000, exp: 8200000, priorRev: 11000000, priorExp: 7900000 },
      { id: 'EMEA', name: 'Europe, Middle East, Africa', rev: 8400000, exp: 6100000, priorRev: 7500000, priorExp: 5800000 },
      { id: 'APAC', name: 'Asia Pacific', rev: 5200000, exp: 4100000, priorRev: 6000000, priorExp: 4200000 },
      { id: 'LATAM', name: 'Latin America', rev: 1500000, exp: 1200000, priorRev: 1100000, priorExp: 900000 },
    ],
    department: [
      { id: 'ENG', name: 'Engineering & R&D', rev: 0, exp: 5500000, priorRev: 0, priorExp: 4800000 },
      { id: 'SALES', name: 'Sales & Marketing', rev: 27600000, exp: 8500000, priorRev: 25600000, priorExp: 7500000 },
      { id: 'OPS', name: 'Operations & Supply Chain', rev: 0, exp: 4200000, priorRev: 0, priorExp: 4500000 },
      { id: 'GNA', name: 'General & Administrative', rev: 0, exp: 1400000, priorRev: 0, priorExp: 2000000 },
    ],
    product: [
      { id: 'SFT', name: 'Enterprise Software (SaaS)', rev: 18500000, exp: 4500000, priorRev: 14000000, priorExp: 4000000 },
      { id: 'HRW', name: 'Hardware & IoT', rev: 5200000, exp: 8500000, priorRev: 6500000, priorExp: 9000000 },
      { id: 'SVC', name: 'Professional Services', rev: 3900000, exp: 2800000, priorRev: 5100000, priorExp: 3500000 },
    ]
  };

  const currentData = mockData[activeSegment];
  const totalRev = currentData.reduce((sum, item) => sum + item.rev, 0);
  const totalExp = currentData.reduce((sum, item) => sum + item.exp, 0);
  const totalProfit = totalRev - totalExp;
  
  const priorRev = currentData.reduce((sum, item) => sum + item.priorRev, 0);
  const priorExp = currentData.reduce((sum, item) => sum + item.priorExp, 0);
  const priorProfit = priorRev - priorExp;

  const yoyGrowth = priorProfit === 0 ? 0 : ((totalProfit - priorProfit) / Math.abs(priorProfit)) * 100;

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-[#0A0A0A] text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Layers className="w-6 h-6 text-indigo-400" />
            Segmented Matrix Reporting
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Analyze revenue, expenses, and margin contribution sliced by distinct business dimensions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
             <select 
               className="h-10 pl-4 pr-10 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-bold appearance-none outline-none focus:border-indigo-400 transition-colors"
               value={activeSegment}
               onChange={(e) => setActiveSegment(e.target.value as any)}
             >
                <option value="region" className="text-black">By Geography / Region</option>
                <option value="department" className="text-black">By Cost Center / Department</option>
                <option value="product" className="text-black">By Product Line</option>
             </select>
             <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Segment Revenue</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">${(totalRev / 100).toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Segment Expenses</span>
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-rose-600">${(totalExp / 100).toLocaleString()}</div>
          </div>

          <div className="col-span-2 p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm bg-indigo-900 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Consolidated Segment Profit</span>
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-white/10 text-xs font-bold">
                  {yoyGrowth >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
                  <span className={yoyGrowth >= 0 ? "text-emerald-400" : "text-rose-400"}>{Math.abs(yoyGrowth).toFixed(1)}% YoY</span>
                </div>
              </div>
              <div className="text-4xl font-bold text-white">${(totalProfit / 100).toLocaleString()}</div>
            </div>
            <Target className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-800 opacity-50" />
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
            <div className="col-span-3">Segment Name</div>
            <div className="col-span-2 text-right">Gross Revenue</div>
            <div className="col-span-2 text-right">Direct Expenses</div>
            <div className="col-span-2 text-right">Net Margin</div>
            <div className="col-span-3 pl-8">YoY Performance</div>
          </div>
          <div className="divide-y divide-[#E5E5E5]">
            {currentData.map((item) => {
              const margin = item.rev - item.exp;
              const priorMargin = item.priorRev - item.priorExp;
              const segmentGrowth = priorMargin === 0 ? 0 : ((margin - priorMargin) / Math.abs(priorMargin)) * 100;
              const isLoss = margin < 0;

              return (
                <div key={item.id} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] transition-colors group">
                  <div className="col-span-3">
                    <div className="font-bold text-[#0A0A0A]">{item.name}</div>
                    <div className="text-[10px] font-mono text-[#A3A3A3] mt-0.5">{item.id}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm text-[#0A0A0A]">
                    {item.rev > 0 ? `$${(item.rev / 100).toLocaleString()}` : '-'}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm text-rose-600">
                    {item.exp > 0 ? `-$${(item.exp / 100).toLocaleString()}` : '-'}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm font-bold">
                    <span className={isLoss ? 'text-rose-600' : 'text-[#0A0A0A]'}>
                      ${(margin / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="col-span-3 pl-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "px-2 py-1 rounded flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                        segmentGrowth >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {segmentGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(segmentGrowth).toFixed(1)}%
                      </div>
                      {isLoss && (
                         <div className="flex items-center gap-1 text-rose-600" title="Operating Loss Warning">
                           <AlertTriangle className="w-4 h-4" />
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
