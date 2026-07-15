import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function SOXCompliance() {
  const [activeTab, setActiveTab] = useState<'controls' | 'testing'>('controls');

  const controls: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-rose-400" />
            SOX Compliance & Internal Controls
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage Sarbanes-Oxley control matrices, testing schedules, and deficiencies.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Control Objective</div>
            <div className="col-span-3">Process Area</div>
            <div className="col-span-2 text-center">Owner</div>
            <div className="col-span-1 text-center">Freq</div>
            <div className="col-span-2 text-right">Control Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {controls.map(c => (
              <div key={c.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4">
                  <div className="font-bold text-slate-900">{c.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{c.id}</div>
                </div>
                <div className="col-span-3 text-sm text-slate-600">
                  {c.process}
                </div>
                <div className="col-span-2 text-center text-xs font-bold text-slate-700">
                   {c.owner}
                </div>
                <div className="col-span-1 text-center text-[10px] font-bold uppercase text-slate-500">
                   {c.frequency}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      c.status === 'Effective' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-rose-50 text-rose-700 border-rose-200"
                   )}>
                      {c.status}
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
