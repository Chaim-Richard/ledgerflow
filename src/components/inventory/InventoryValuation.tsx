import React, { useState } from 'react';
import { Layers, Search, TrendingUp, TrendingDown, RefreshCw, BarChart2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function InventoryValuation() {
  const [method, setMethod] = useState<'FIFO' | 'LIFO' | 'WAC'>('FIFO');

  const items: any[] = [];

  const totalInventoryValue = items.reduce((acc, item) => acc + item.totalVal, 0);

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Layers className="w-6 h-6 text-purple-600" />
            Inventory Valuation & COGS
          </h1>
          <p className="text-sm text-[#525252] mt-1">Analyze stock values using standard accounting costing methods.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-1 shadow-sm">
            {['FIFO', 'LIFO', 'WAC'].map(m => (
              <button
                key={m}
                onClick={() => setMethod(m as any)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  method === m ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#E5E5E5]"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors">
            <RefreshCw className="w-4 h-4" /> Run Recalculation
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Inventory Value</span>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">
              ${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +2.4% vs last month ({method})
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">YTD COGS</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">$145,230.00</div>
            <div className="text-xs text-[#525252] mt-2 font-medium">Cost of Goods Sold recognized this year</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Inventory Turnover</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">4.2x</div>
            <div className="text-xs text-[#525252] mt-2 font-medium">Industry average is 3.8x</div>
          </div>
        </div>

        {/* Valuation Table */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#E5E5E5] flex justify-between items-center bg-[#FAFAFA]">
            <h3 className="font-bold text-[#0A0A0A]">Valuation Ledger</h3>
            <div className="relative">
              <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search items..."
                className="pl-9 pr-4 py-1.5 bg-white border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-5 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
            <div className="col-span-2">Item</div>
            <div className="text-right">Qty on Hand</div>
            <div className="text-right">Unit Cost ({method})</div>
            <div className="text-right">Total Value</div>
          </div>

          <div className="divide-y divide-[#E5E5E5]">
            {items.map((item) => (
              <div key={item.sku} className="grid grid-cols-5 p-4 items-center hover:bg-[#FAFAFA] transition-colors">
                <div className="col-span-2">
                  <div className="font-bold text-[#0A0A0A]">{item.name}</div>
                  <div className="text-xs font-mono text-[#525252] mt-0.5">{item.sku}</div>
                </div>
                <div className="text-right font-mono text-sm text-[#0A0A0A]">{item.qty.toLocaleString()}</div>
                <div className="text-right font-mono text-sm text-[#0A0A0A]">${item.unitCost.toFixed(2)}</div>
                <div className="text-right font-mono text-sm font-bold text-[#0A0A0A]">
                  ${item.totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
