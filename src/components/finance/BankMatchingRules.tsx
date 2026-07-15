import React, { useState } from 'react';
import { GitMerge, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BankMatchingRules() {
  const [activeTab, setActiveTab] = useState<'rules'>('rules');

  const rules: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <GitMerge className="w-6 h-6 text-indigo-400" />
            Bank Reconciliation & Matching Rules
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Define automated conditions to auto-categorize and reconcile bank feed transactions.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Rule Name</div>
            <div className="col-span-3">Condition (IF)</div>
            <div className="col-span-3">Action (THEN)</div>
            <div className="col-span-1 text-center">Match %</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {rules.map(r => (
              <div key={r.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{r.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{r.id}</div>
                </div>
                <div className="col-span-3 text-xs font-mono font-bold text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 inline-block w-max">
                  {r.condition}
                </div>
                <div className="col-span-3 flex items-center gap-2 text-xs font-bold text-indigo-700">
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  {r.action}
                </div>
                <div className="col-span-1 text-center text-xs font-bold font-mono text-emerald-600">
                  {r.matchConfidence}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      r.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
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
