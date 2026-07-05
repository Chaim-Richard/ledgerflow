import React, { useState } from 'react';
import { ShieldCheck, Zap, Server, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ApprovalsMatrix() {
  const [activeTab, setActiveTab] = useState<'matrix'>('matrix');

  const rules: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Approval Matrix Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Define multi-level hierarchical approval thresholds across all financial modules.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Module</div>
            <div className="col-span-3">Trigger Condition</div>
            <div className="col-span-2 text-center">Primary Approver</div>
            <div className="col-span-2 text-center">Backup Approver</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {rules.map(r => (
              <div key={r.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{r.module}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{r.id}</div>
                </div>
                <div className="col-span-3 text-xs font-mono text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded inline-block w-max">
                  {r.condition}
                </div>
                <div className="col-span-2 text-center text-sm font-bold text-slate-700">
                   {r.approver}
                </div>
                <div className="col-span-2 text-center text-xs text-slate-500">
                   {r.backup}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
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
