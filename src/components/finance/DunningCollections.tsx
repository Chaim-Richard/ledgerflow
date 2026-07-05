import React, { useState } from 'react';
import { MailWarning, CalendarClock, DollarSign, Send } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function DunningCollections() {
  const [activeTab, setActiveTab] = useState<'reminders'>('reminders');

  const routines: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <MailWarning className="w-6 h-6 text-rose-400" />
            Dunning & Collections
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automate overdue invoice reminders, escalate collections, and track bad debt.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Customer</div>
            <div className="col-span-2 text-right">Total Overdue</div>
            <div className="col-span-2 text-center">Days Late</div>
            <div className="col-span-3 text-center">Escalation Level</div>
            <div className="col-span-2 text-right">Next Auto-Action</div>
          </div>
          <div className="divide-y divide-slate-200">
            {routines.map(r => (
              <div key={r.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{r.customer}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{r.invoices} overdue invoices</div>
                </div>
                <div className="col-span-2 text-right font-bold font-mono text-rose-600">
                  ${r.totalOverdue.toLocaleString()}
                </div>
                <div className="col-span-2 text-center font-bold font-mono text-slate-900">
                  {r.daysLate} Days
                </div>
                <div className="col-span-3 flex justify-center">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      r.daysLate > 30 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"
                   )}>
                      {r.level}
                   </span>
                </div>
                <div className="col-span-2 text-right font-mono text-xs text-slate-500 flex items-center justify-end gap-2">
                   {r.nextAction}
                   <button className="p-1 hover:bg-slate-100 rounded text-sky-600"><Send className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
