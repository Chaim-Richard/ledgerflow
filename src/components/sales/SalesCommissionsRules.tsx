import React, { useState } from 'react';
import { Target, Coins, TrendingUp, Percent } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function SalesCommissionsRules() {
  const [activeTab, setActiveTab] = useState<'rules'>('rules');

  const rules: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Coins className="w-6 h-6 text-amber-500" />
            Sales Commission Structures
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Build tiered commission rules based on revenue targets, margin gates, and product lines.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Rule Name</div>
            <div className="col-span-2 text-center">Revenue Tier</div>
            <div className="col-span-2 text-center">Commission Rate</div>
            <div className="col-span-3 text-center">Gating Criteria</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {rules.map(r => (
              <div key={r.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{r.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{r.id}</div>
                </div>
                <div className="col-span-2 text-center font-bold font-mono text-slate-700">
                  {r.tier}
                </div>
                <div className="col-span-2 text-center font-bold font-mono text-emerald-600 text-lg">
                  {r.rate}
                </div>
                <div className="col-span-3 text-center text-xs font-mono text-slate-600 bg-slate-50 py-1 rounded">
                  {r.criteria}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      r.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-slate-50 text-slate-500 border-slate-200"
                   )}>
                      {r.status}
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
