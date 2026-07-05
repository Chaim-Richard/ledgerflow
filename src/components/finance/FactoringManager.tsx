import React, { useState } from 'react';
import { Target, Banknote, ShieldCheck, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function FactoringManager() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'factors'>('invoices');

  const factoring: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Banknote className="w-6 h-6 text-emerald-400" />
            Invoice Factoring & Discounting
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage accounts receivable financing and cash advances.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Invoice / Customer</div>
            <div className="col-span-2">Factor / Lendor</div>
            <div className="col-span-2 text-right">Face Value</div>
            <div className="col-span-1 text-center">Fee %</div>
            <div className="col-span-2 text-right text-emerald-600">Advance Amt</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {factoring.map(f => (
              <div key={f.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{f.id}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{f.customer}</div>
                </div>
                <div className="col-span-2 text-xs font-bold text-slate-700">
                  {f.factor}
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                   ${f.amount.toLocaleString()}
                </div>
                <div className="col-span-1 text-center font-mono text-slate-600">
                   {f.feeRate}%
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-emerald-600">
                   ${f.advance.toLocaleString()}
                </div>
                <div className="col-span-2 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      f.status === 'Funded' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                   )}>
                      {f.status}
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
