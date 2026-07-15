import React, { useState } from 'react';
import { Scale } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function LandedCostVariances() {
  const [activeTab, setActiveTab] = useState<'variances'>('variances');

  const variances: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Scale className="w-6 h-6 text-rose-400" />
            Landed Cost Variance Analysis
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track discrepancies between estimated shipping/duty costs and actual vendor bills.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Shipment Ref</div>
            <div className="col-span-2 text-right">Est. Landed Cost</div>
            <div className="col-span-2 text-right">Actual Billed</div>
            <div className="col-span-2 text-right">Variance</div>
            <div className="col-span-3 text-right">Resolution Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {variances.map(v => (
              <div key={v.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{v.shipment}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{v.id}</div>
                </div>
                <div className="col-span-2 text-right font-mono text-slate-600">
                  ${v.estCost.toLocaleString()}
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                  ${v.actualCost.toLocaleString()}
                </div>
                <div className="col-span-2 text-right font-mono font-bold">
                  <span className={v.variance < 0 ? "text-rose-600" : "text-emerald-600"}>
                    {v.variance < 0 ? `-$${Math.abs(v.variance)}` : `+$${v.variance}`}
                  </span>
                </div>
                <div className="col-span-3 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      v.status === 'Resolved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-rose-50 text-rose-700 border-rose-200"
                   )}>
                      {v.status}
                   </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
