import React, { useState } from 'react';
import { ShieldAlert, CreditCard, Ban, CheckSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ExpensePolicies() {
  const [activeTab, setActiveTab] = useState<'policies'>('policies');

  const policies: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            Expense Policies & Fraud Prevention
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure automated rules to catch out-of-policy employee spend.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Policy Name</div>
            <div className="col-span-4">Trigger Condition</div>
            <div className="col-span-3 text-center">System Action</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {policies.map(p => (
              <div key={p.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{p.id}</div>
                </div>
                <div className="col-span-4 text-xs font-mono text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded inline-block w-max">
                  {p.condition}
                </div>
                <div className="col-span-3 text-center text-xs font-bold text-slate-700 flex items-center justify-center gap-1">
                   {p.action === 'Auto-Reject' ? <Ban className="w-3 h-3 text-rose-500" /> : <ShieldAlert className="w-3 h-3 text-amber-500" />}
                   {p.action}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {p.status}
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
