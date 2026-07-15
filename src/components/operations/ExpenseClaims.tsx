import React, { useState } from 'react';
import { DollarSign, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ExpenseClaims() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  const claims: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Expense Claims
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review, approve, and reimburse employee expenses and corporate card charges.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'pending', label: 'Pending Approval', icon: Clock },
            { id: 'approved', label: 'Processed Claims', icon: CheckCircle2 }
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

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Employee</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-2 text-center">Date</div>
            <div className="col-span-3 text-right">Action</div>
          </div>
          <div className="divide-y divide-slate-200">
            {claims.filter(c => activeTab === 'pending' ? c.status === 'Pending Approval' : c.status === 'Approved').map(claim => (
              <div key={claim.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{claim.employee}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{claim.id}</div>
                </div>
                <div className="col-span-2 text-sm font-bold text-slate-700">
                  {claim.category}
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                  ${claim.amount.toFixed(2)}
                </div>
                <div className="col-span-2 text-center text-xs font-mono text-slate-600">
                   {claim.date}
                </div>
                <div className="col-span-3 flex justify-end gap-2">
                   {claim.status === 'Pending Approval' ? (
                      <>
                        <button className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors">Approve</button>
                        <button className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-rose-100 transition-colors">Reject</button>
                      </>
                   ) : (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {claim.status}
                      </span>
                   )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
