import React, { useState } from 'react';
import { Briefcase, DollarSign, LayoutDashboard, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ProjectAccounting() {
  const [activeTab, setActiveTab] = useState<'overview' | 'wip'>('overview');

  const projects: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-orange-400" />
            Project Accounting
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Job costing, progress billing, WIP tracking, and profitability analysis.
          </p>
        </div>
        <button className="h-10 px-4 bg-orange-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-400 transition-colors">
           <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'overview', label: 'Portfolio Overview', icon: LayoutDashboard },
            { id: 'wip', label: 'WIP & Job Costs', icon: DollarSign }
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

        {activeTab === 'overview' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Project Name</div>
              <div className="col-span-2">Client</div>
              <div className="col-span-2 text-right">Total Budget</div>
              <div className="col-span-2 text-right">Costs to Date</div>
              <div className="col-span-2 text-right">Billed to Date</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {projects.map(prj => (
                <div key={prj.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{prj.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{prj.id}</div>
                  </div>
                  <div className="col-span-2 font-bold text-slate-700">
                    {prj.client}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                     ${prj.budget.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono text-rose-600">
                     ${prj.costs.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-emerald-600">
                     ${prj.billed.toLocaleString()}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      prj.status === 'In Progress' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {prj.status}
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
