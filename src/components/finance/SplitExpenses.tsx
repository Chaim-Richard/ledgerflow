import React from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { Users, ArrowRightLeft, CreditCard, CheckCircle2 } from 'lucide-react';

export default function SplitExpenses() {
  const { transactions } = useLedgerStore();

  // Deterministically finding household-like shared transactions
  
  // Calculate dynamically if tags or projects indicate shared
  const displayData = transactions
    .filter(t => t.tags && t.tags.includes('shared'))
    .map(t => ({
       id: t.id,
       date: t.date,
       description: t.description,
       amount: (t.totalAmountCents || 0) / 100,
       paidBy: 'You',
       status: 'pending',
       share: ((t.totalAmountCents || 0) / 100) / 2,
       person: 'Partner'
    }));

  const totalOwedToYou = displayData.reduce((sum, item) => sum + item.share, 0);
  const totalYouOwe = 0;


  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto h-full text-slate-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-indigo-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm border border-indigo-200">Household Operations</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-indigo-400 rounded-full border border-slate-800">
               <Users size={10} />
               <span className="text-[9px] font-black tracking-widest uppercase">Cost Sharing Active</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Shared Expenses & Settlements
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Deterministic fractional allocation of household costs and reimbursements.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-emerald-50 border border-emerald-100 rounded-[32px] p-6 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Total Owed To You</p>
               <p className="text-3xl font-black tracking-tighter mt-1 font-mono text-emerald-700">${totalOwedToYou.toFixed(2)}</p>
            </div>
            <ArrowRightLeft size={24} className="text-emerald-500" />
         </div>
         <div className="bg-rose-50 border border-rose-100 rounded-[32px] p-6 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-[10px] font-medium uppercase tracking-wider text-rose-600">Total You Owe</p>
               <p className="text-3xl font-black tracking-tighter mt-1 font-mono text-rose-700">${totalYouOwe.toFixed(2)}</p>
            </div>
            <ArrowRightLeft size={24} className="text-rose-500" />
         </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
         <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">Recent Shared Transactions</h3>
         </div>
         <div className="divide-y divide-slate-100">
            {displayData.map((item) => (
               <div key={item.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.paidBy === 'You' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                        {item.paidBy === 'You' ? <CreditCard size={16} /> : <Users size={16} />}
                     </div>
                     <div>
                        <h4 className="font-black text-slate-800 uppercase tracking-tight">{item.description}</h4>
                        <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Paid by {item.paidBy} • Total: ${item.amount.toFixed(2)}</p>
                     </div>
                  </div>

                  <div className="flex items-center gap-4 justify-between sm:justify-end w-full sm:w-auto">
                     <div className="text-right">
                        <p className={`font-mono font-black text-base ${item.paidBy === 'You' ? 'text-emerald-600' : 'text-rose-600'}`}>
                           {item.paidBy === 'You' ? '+' : '-'}${item.share.toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">
                           {item.paidBy === 'You' ? `${item.person} Owes` : `You Owe ${item.person}`}
                        </p>
                     </div>
                     
                     {item.status === 'pending' ? (
                       <button className="h-8 px-3 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-colors">
                          Settle
                       </button>
                     ) : (
                       <div className="h-8 px-3 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-medium uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={12} /> Settled
                       </div>
                     )}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}
