import React, { useState } from 'react';
import { Target, BarChart, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Budgeting() {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'variance'>('scenarios');

  const budgets: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Target className="w-6 h-6 text-sky-400" />
            Budgeting & Planning
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create budgets, forecast scenarios, and track actual vs budget variance.
          </p>
        </div>
        <button className="h-10 px-4 bg-sky-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-sky-400 transition-colors">
           <Plus className="w-4 h-4" /> New Scenario
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'scenarios', label: 'Budget Scenarios', icon: Target },
            { id: 'variance', label: 'Variance Analysis', icon: BarChart }
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

        {activeTab === 'scenarios' && (
          <div className="grid grid-cols-2 gap-6">
            {budgets.map(b => (
               <div key={b.id} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-sky-500" />
                  <div className="flex justify-between items-start mb-6">
                     <div>
                        <h3 className="text-lg font-bold text-slate-900">{b.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 font-mono">{b.id} • Created by {b.creator}</p>
                     </div>
                     <span className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                        b.status === 'Approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        "bg-slate-100 text-slate-700 border-slate-200"
                     )}>
                        {b.status}
                     </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                           <ArrowUpRight className="w-3 h-3 text-emerald-500" /> Target Revenue
                        </div>
                        <div className="text-xl font-bold font-mono text-slate-900">${b.totalRev.toLocaleString()}</div>
                     </div>
                     <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                           <ArrowDownRight className="w-3 h-3 text-rose-500" /> Planned OPEX
                        </div>
                        <div className="text-xl font-bold font-mono text-slate-900">${b.totalExp.toLocaleString()}</div>
                     </div>
                  </div>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
