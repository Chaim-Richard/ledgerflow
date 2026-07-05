import React, { useState } from 'react';
import { Calendar, Users, Clock, CalendarDays, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function LeaveManagement() {
  const [activeTab, setActiveTab] = useState<'requests' | 'balances'>('requests');

  const requests: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Calendar className="w-6 h-6 text-pink-400" />
            Leave & Time Off
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage employee PTO, sick leave, and timesheet approvals.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'requests', label: 'Time Off Requests', icon: CalendarDays },
            { id: 'balances', label: 'Accrual Balances', icon: Clock }
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

        {activeTab === 'requests' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Employee</div>
              <div className="col-span-2">Leave Type</div>
              <div className="col-span-3 text-center">Dates</div>
              <div className="col-span-1 text-right">Days</div>
              <div className="col-span-3 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {requests.map(req => (
                <div key={req.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{req.employee}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{req.id}</div>
                  </div>
                  <div className="col-span-2 text-sm font-bold text-slate-700">
                    {req.type}
                  </div>
                  <div className="col-span-3 text-center text-xs font-mono text-slate-600">
                     {req.dates}
                  </div>
                  <div className="col-span-1 text-right font-bold text-slate-900">
                     {req.days}
                  </div>
                  <div className="col-span-3 flex justify-end gap-2">
                     {req.status === 'Pending' ? (
                        <>
                          <button className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors">Approve</button>
                          <button className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-rose-100 transition-colors">Deny</button>
                        </>
                     ) : (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {req.status}
                        </span>
                     )}
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
