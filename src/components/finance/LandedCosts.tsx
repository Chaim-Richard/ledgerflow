import React, { useState } from 'react';
import { Ship } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function LandedCosts() {
  const [activeTab, setActiveTab] = useState<'allocations'>('allocations');

  const bills: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Ship className="w-6 h-6 text-indigo-400" />
            Landed Cost Allocation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Capitalize shipping, duties, and insurance into inventory valuation.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Expense Bill</div>
            <div className="col-span-2 text-right">Amount to Allocate</div>
            <div className="col-span-3 text-center">Target Shipment (PO)</div>
            <div className="col-span-2 text-center">Allocation Basis</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {bills.map(b => (
              <div key={b.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{b.vendor}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{b.id}</div>
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-rose-600">
                  ${b.amount.toLocaleString()}
                </div>
                <div className="col-span-3 text-center text-xs font-bold font-mono text-slate-700">
                   {b.targetPO}
                </div>
                <div className="col-span-2 text-center text-xs text-slate-600">
                   {b.method}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      b.status === 'Allocated' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                   )}>
                      {b.status}
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
