import React, { useState } from 'react';
import { Network, Zap, GitCommit, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ProcessAutomation() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'executions'>('workflows');

  const workflows = [
    { id: 'WF-01', name: 'Invoice Approval Routing', trigger: 'Invoice Created > $5000', status: 'Active', runs: 142 },
    { id: 'WF-02', name: 'Low Stock Alert', trigger: 'Stock < Reorder Point', status: 'Active', runs: 890 },
    { id: 'WF-03', name: 'Onboarding Sequence', trigger: 'Employee Hired', status: 'Paused', runs: 12 },
  ];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Network className="w-6 h-6 text-fuchsia-400" />
            Process Automation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Build and manage trigger-based business workflows and approvals.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'workflows', label: 'Workflows', icon: GitCommit },
            { id: 'executions', label: 'Run History', icon: Activity }
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

        {activeTab === 'workflows' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Workflow Name</div>
              <div className="col-span-4">Trigger</div>
              <div className="col-span-2 text-center">Total Runs</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {workflows.map(wf => (
                <div key={wf.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-4 flex items-center gap-3">
                     <div className="p-2 bg-fuchsia-50 text-fuchsia-600 rounded-lg">
                        <Zap className="w-4 h-4" />
                     </div>
                     <div>
                       <div className="font-bold text-slate-900">{wf.name}</div>
                       <div className="text-[10px] font-mono text-slate-400 mt-0.5">{wf.id}</div>
                     </div>
                  </div>
                  <div className="col-span-4 text-xs font-mono text-slate-600">
                    {wf.trigger}
                  </div>
                  <div className="col-span-2 text-center font-bold text-slate-700">
                     {wf.runs.toLocaleString()}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      wf.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-slate-100 text-slate-700 border-slate-200"
                    )}>
                      {wf.status}
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
