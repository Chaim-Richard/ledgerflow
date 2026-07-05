import React, { useState } from 'react';
import { Briefcase, Calendar, TrendingUp, Search, Plus, Filter, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function EquityGrants() {
  const [activeTab, setActiveTab] = useState<'grants' | 'vesting'>('grants');

  const grants: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-indigo-400" />
            Equity Grants & Vesting
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage employee stock options, RSUs, and automated vesting schedules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-10 px-4 bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-400 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Issue Grant
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* Tab Bar */}
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'grants', label: 'Grant Ledger', icon: Briefcase },
            { id: 'vesting', label: 'Vesting Schedules', icon: Calendar }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activeTab === 'grants' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Employee Name</div>
              <div className="col-span-2">Grant Type</div>
              <div className="col-span-2 text-right">Total Shares</div>
              <div className="col-span-3 text-center">Vesting Rule</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {grants.map((grant) => (
                <div key={grant.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{grant.employee}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{grant.id} • Granted: {grant.grantDate}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-700 border-slate-200">
                      {grant.type}
                    </span>
                    {grant.strikeCents > 0 && <div className="text-[10px] font-mono font-bold text-slate-500 mt-1">Strike: ${(grant.strikeCents / 100).toFixed(2)}</div>}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm font-bold text-slate-700">
                    {grant.shares.toLocaleString()}
                  </div>
                  <div className="col-span-3 text-center text-xs font-bold text-slate-600">
                    {grant.vestSchedule}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {grant.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'vesting' && (
           <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
             <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-slate-900">Vesting Intelligence</h3>
             <p className="text-slate-500 mt-2 max-w-md mx-auto">
               The system automatically calculates monthly vested tranches and generates expensing journal entries compliant with ASC 718.
             </p>
           </div>
        )}
      </div>
    </div>
  );
}
