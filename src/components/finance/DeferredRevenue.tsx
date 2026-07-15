import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function DeferredRevenue() {
  const [activeTab, setActiveTab] = useState<'schedules'>('schedules');

  const schedules: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-sky-400" />
            Deferred Revenue (ASC 606)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automate revenue recognition schedules for subscriptions and long-term contracts.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Customer / Schedule</div>
            <div className="col-span-2">Source Invoice</div>
            <div className="col-span-2 text-right">Total Contract Value</div>
            <div className="col-span-3 text-center">Recognition Progress</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-200">
            {schedules.map(s => {
               const percent = (s.recognized / s.totalAmount) * 100;
               return (
                 <div key={s.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                   <div className="col-span-3">
                     <div className="font-bold text-slate-900">{s.customer}</div>
                     <div className="text-[10px] font-mono text-slate-400 mt-0.5">{s.id}</div>
                   </div>
                   <div className="col-span-2 font-mono text-xs font-bold text-slate-600">
                     {s.invoice}
                   </div>
                   <div className="col-span-2 text-right font-bold font-mono text-slate-900">
                      ${s.totalAmount.toLocaleString()}
                   </div>
                   <div className="col-span-3 px-6">
                      <div className="flex items-center justify-between text-[10px] font-bold font-mono mb-1">
                         <span className="text-emerald-600">${s.recognized.toLocaleString()}</span>
                         <span className="text-slate-400">{s.monthsDone}/{s.monthsTotal} mo</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                         <div 
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(percent, 100)}%` }}
                         />
                      </div>
                   </div>
                   <div className="col-span-2 flex justify-end">
                      <span className={cn(
                         "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                         s.status === 'Fully Recognized' ? "bg-slate-50 text-slate-500 border-slate-200" :
                         "bg-sky-50 text-sky-700 border-sky-200"
                      )}>
                         {s.status}
                      </span>
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
