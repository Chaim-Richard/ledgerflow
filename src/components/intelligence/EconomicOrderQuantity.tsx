import React, { useState } from 'react';
import { Package, TrendingDown, Target, Zap, BarChart3, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { calculateEOQ } from '../../lib/algorithms/math';

export default function EconomicOrderQuantity() {
  const [activeTab, setActiveTab] = useState<'eoq' | 'safety'>('eoq');

  // Simulated inventory data
  const inventory: any[] = [];

  const analysis = inventory.map(item => {
     const eoq = Math.round(calculateEOQ(item.annualDemand, item.orderingCost, item.holdingCost));
     const dailyDemand = item.annualDemand / 365;
     
     // Reorder Point = Lead Time Demand + Safety Stock
     const leadTimeDemand = dailyDemand * item.leadTimeDays;
     const maxDailyDemand = dailyDemand * 1.5; // Assume max daily demand is 50% higher
     const maxLeadTime = item.leadTimeDays * 1.2; // Assume max lead time 20% higher
     
     const safetyStock = Math.round((maxDailyDemand * maxLeadTime) - leadTimeDemand);
     const reorderPoint = Math.round(leadTimeDemand + safetyStock);
     
     const status = item.currentStock <= reorderPoint ? 'Reorder Now' : 'Optimal';
     
     return { ...item, eoq, safetyStock, reorderPoint, status };
  });

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Package className="w-6 h-6 text-teal-400" />
            Inventory Optimization Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Algorithmic inventory control using Economic Order Quantity (EOQ) and statistical safety stock.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'eoq', label: 'Economic Order Quantity', icon: Zap },
            { id: 'safety', label: 'Reorder Points & Safety Stock', icon: ShieldCheck }
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                   "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                   activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                )}
             >
                <tab.icon className="w-4 h-4" /> {tab.label}
             </button>
          ))}
        </div>

        {activeTab === 'eoq' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">SKU / Item</div>
              <div className="col-span-2 text-right">Annual Demand</div>
              <div className="col-span-2 text-right">Ordering Cost (S)</div>
              <div className="col-span-2 text-right">Holding Cost (H)</div>
              <div className="col-span-3 text-right text-teal-600">Calculated EOQ</div>
            </div>
            <div className="divide-y divide-slate-200">
              {analysis.map(a => (
                <div key={a.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{a.sku}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{a.id} • Unit: ${a.unitCost.toFixed(2)}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm text-slate-700">
                    {a.annualDemand.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm text-slate-600">
                     ${a.orderingCost.toFixed(2)}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm text-slate-600">
                     ${a.holdingCost.toFixed(2)}
                  </div>
                  <div className="col-span-3 text-right">
                     <span className="px-3 py-1.5 rounded-lg text-lg font-bold font-mono tracking-wider bg-teal-50 text-teal-700 border border-teal-200 shadow-sm inline-block">
                        {a.eoq.toLocaleString()}
                     </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">SKU / Item</div>
              <div className="col-span-2 text-right">Current Stock</div>
              <div className="col-span-2 text-right">Safety Stock</div>
              <div className="col-span-2 text-right text-indigo-600">Reorder Point</div>
              <div className="col-span-3 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {analysis.map(a => (
                <div key={a.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{a.sku}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">Lead Time: {a.leadTimeDays}d</div>
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-sm text-slate-900">
                    {a.currentStock.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm text-slate-600">
                     {a.safetyStock.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-sm text-indigo-600">
                     {a.reorderPoint.toLocaleString()}
                  </div>
                  <div className="col-span-3 flex justify-end">
                     <span className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                        a.status === 'Reorder Now' ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-emerald-50 text-emerald-700 border-emerald-200"
                     )}>
                        {a.status}
                     </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
