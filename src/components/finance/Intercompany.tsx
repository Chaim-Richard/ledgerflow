import React, { useState } from 'react';
import { Building, ArrowRightLeft, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Intercompany() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'balances'>('transactions');

  const transactions: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-blue-400" />
            Intercompany Accounting
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage cross-entity transfers, loans, and automated eliminations.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'transactions', label: 'IC Transactions', icon: ArrowRightLeft },
            { id: 'balances', label: 'Elimination Matrix', icon: Layers }
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

        {activeTab === 'transactions' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">From Entity</div>
              <div className="col-span-3">To Entity</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {transactions.map(txn => (
                <div key={txn.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{txn.from}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{txn.id}</div>
                  </div>
                  <div className="col-span-3 font-bold text-slate-900">
                    {txn.to}
                  </div>
                  <div className="col-span-2 text-xs font-bold text-slate-700">
                     {txn.type}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                     ${txn.amount.toLocaleString()}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      txn.status === 'Reconciled' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {txn.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
