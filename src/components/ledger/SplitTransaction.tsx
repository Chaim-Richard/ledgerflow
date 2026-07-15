import React, { useState } from 'react';
import { SplitSquareHorizontal, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency, cn } from '../../lib/utils';

export default function SplitTransaction() {
  const [activeTab, setActiveTab] = useState<'flat' | 'percentage'>('flat');
  const [totalAmount, setTotalAmount] = useState<number>(1000); // Ex: $1000 base
  const [splits, setLines] = useState([
    { account: '', amount: 500, percent: 50, class: 'Overhead', location: 'Seattle' },
    { account: '', amount: 500, percent: 50, class: 'Marketing', location: 'Remote' }
  ]);

  const handleAddLine = () => {
    setLines([...splits, { account: '', amount: 0, percent: 0, class: '', location: '' }]);
  };

  const handleRemove = (i: number) => {
    setLines(splits.filter((_, idx) => idx !== i));
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-[32px] bg-slate-900 text-white flex items-center justify-center shrink-0">
          <SplitSquareHorizontal size={24} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">Advanced Splitting</h1>
          <p className="text-sm font-medium text-slate-500">Distribute single transactions natively across multiple classes, locations, jobs, or generalized GL expense ledgers.</p>
        </div>
      </div>

      <div className="p-6 md:p-8 bg-white border border-slate-200 rounded-[32px] space-y-8 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Base Transaction Amount</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-slate-900">{formatCurrency(totalAmount * 100)}</span>
              <span className="px-2 py-1 rounded bg-slate-50 text-[10px] font-bold text-slate-500">TOTAL DEBIT</span>
            </div>
          </div>
          
          <div className="flex items-center p-1 bg-slate-50 rounded-xl w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('flat')}
              className={cn("flex-1 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'flat' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
            >
              Flat Splitting
            </button>
            <button 
              onClick={() => setActiveTab('percentage')}
              className={cn("flex-1 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'percentage' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
            >
              Percent Distribution
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {splits.map((split, i) => (
            <div key={i} className="flex flex-wrap md:flex-nowrap items-center gap-4 p-4 rounded-xl bg-slate-50 border border-transparent hover:border-slate-200 transition-all group">
              <select 
                value={split.account}
                onChange={(e) => {
                  const newSplits = [...splits];
                  newSplits[i].account = e.target.value;
                  setLines(newSplits);
                }}
                className="flex-1 min-w-[200px] bg-white px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-none appearance-none cursor-pointer"
              >
                <option value="">Select Account...</option>
                {useLedgerStore.getState().accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <select value={split.class} onChange={(e) => {
                const newSplits = [...splits];
                newSplits[i].class = e.target.value;
                setLines(newSplits);
              }} className="w-full md:w-32 bg-white px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 appearance-none focus:ring-2 focus:ring-indigo-600 outline-none">
                <option value="">Class...</option>
                {useLedgerStore.getState().classes?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              
              <select value={split.location} onChange={(e) => {
                const newSplits = [...splits];
                newSplits[i].location = e.target.value;
                setLines(newSplits);
              }} className="w-full md:w-32 bg-white px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 appearance-none focus:ring-2 focus:ring-indigo-600 outline-none">
                <option value="">Location...</option>
                {useLedgerStore.getState().locations?.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              
              {activeTab === 'flat' ? (
                <div className="relative w-full md:w-40 flex items-center bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <span className="pl-4 font-bold text-slate-500">$</span>
                  <input type="number" value={split.amount} onChange={(e) => {
                    const newSplits = [...splits];
                    newSplits[i].amount = Number(e.target.value);
                    setLines(newSplits);
                  }} className="w-full px-2 py-2.5 border-none focus:ring-0 outline-none font-mono font-bold text-right" />
                </div>
              ) : (
                <div className="relative w-full md:w-40 flex items-center bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <input type="number" value={split.percent} onChange={(e) => {
                    const newSplits = [...splits];
                    newSplits[i].percent = Number(e.target.value);
                    setLines(newSplits);
                  }} className="w-full px-4 py-2.5 border-none focus:ring-0 outline-none font-mono font-bold text-right" />
                  <span className="pr-4 font-bold text-slate-500">%</span>
                </div>
              )}
              
              <button onClick={() => handleRemove(i)} className="w-10 h-10 rounded-lg text-slate-500 hover:bg-white hover:text-rose-600 transition-all flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
          ))}
          
          <button onClick={handleAddLine} className="px-5 py-3 rounded-xl border border-dashed border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:border-slate-800 transition-all w-full text-center">
            + Add Splitting Vector Node
          </button>
        </div>

        <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle2 size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Invariance Balanced</span>
          </div>
          <button className="w-full md:w-auto px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-ledger-ink/20">
            Commit Split Ledger Override <ChevronRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}
