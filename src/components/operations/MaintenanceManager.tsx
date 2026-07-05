import React, { useState } from 'react';
import { Settings, Wrench, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function MaintenanceManager() {
  const [activeTab, setActiveTab] = useState<'workorders' | 'assets'>('workorders');

  const wos: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="w-6 h-6 text-slate-400" />
            Maintenance & EAM
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise Asset Management, preventative maintenance, and repair work orders.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'workorders', label: 'Work Orders', icon: Wrench },
            { id: 'assets', label: 'Asset Registry', icon: Settings }
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

        {activeTab === 'workorders' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Asset & Work Order</div>
              <div className="col-span-3">Issue Description</div>
              <div className="col-span-2">Assigned To</div>
              <div className="col-span-2 text-center">Priority</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {wos.map(wo => (
                <div key={wo.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{wo.asset}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{wo.id}</div>
                  </div>
                  <div className="col-span-3 text-xs text-slate-600 pr-4 truncate">
                    {wo.issue}
                  </div>
                  <div className="col-span-2 text-xs font-bold text-slate-700">
                     {wo.assigned}
                  </div>
                  <div className="col-span-2 flex justify-center">
                     <span className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                        wo.priority === 'Critical' ? "bg-rose-50 text-rose-700 border-rose-200" :
                        wo.priority === 'High' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-slate-100 text-slate-700 border-slate-200"
                     )}>
                        {wo.priority}
                     </span>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      wo.status === 'In Progress' ? "text-blue-600" :
                      wo.status === 'Scheduled' ? "text-slate-500" :
                      "text-amber-600"
                    )}>
                      {wo.status}
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
