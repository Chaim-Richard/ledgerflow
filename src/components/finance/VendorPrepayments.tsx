import React, { useState } from 'react';
import { Banknote } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function VendorPrepayments() {
  const [activeTab, setActiveTab] = useState<'prepayments'>('prepayments');

  const prepayments: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Banknote className="w-6 h-6 text-teal-400" />
            Vendor Prepayments & Deposits
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage advance payments to suppliers and apply them to future purchase bills.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Vendor / Ref</div>
            <div className="col-span-2 text-center">Target PO</div>
            <div className="col-span-2 text-right">Prepaid Amount</div>
            <div className="col-span-2 text-right text-rose-600">Unapplied Balance</div>
            <div className="col-span-3 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {prepayments.map(p => (
              <div key={p.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{p.vendor}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{p.id}</div>
                </div>
                <div className="col-span-2 text-center text-xs font-bold font-mono text-slate-600">
                  {p.poRef}
                </div>
                <div className="col-span-2 text-right font-bold font-mono text-slate-900">
                  ${p.amount.toLocaleString()}
                </div>
                <div className="col-span-2 text-right font-bold font-mono text-rose-600">
                  ${p.unapplied.toLocaleString()}
                </div>
                <div className="col-span-3 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      p.status === 'Fully Applied' ? "bg-slate-50 text-slate-500 border-slate-200" :
                      "bg-emerald-50 text-emerald-700 border-emerald-200"
                   )}>
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
