import React, { useState } from 'react';
import { Users, UserPlus, TrendingUp, Target } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function WorkforcePlanning() {
  const [activeTab, setActiveTab] = useState<'headcount'>('headcount');

  const plans: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-teal-400" />
            Workforce Planning & Headcount
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Forecast future hiring needs and align payroll budgets across departments.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Plan / Dept</div>
            <div className="col-span-1 text-center">Q1</div>
            <div className="col-span-1 text-center">Q2</div>
            <div className="col-span-1 text-center">Q3</div>
            <div className="col-span-1 text-center">Q4</div>
            <div className="col-span-3 text-right">Associated Payroll Budget</div>
          </div>
          <div className="divide-y divide-slate-200">
            {plans.map(p => (
              <div key={p.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{p.dept}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{p.id}</div>
                </div>
                <div className="col-span-1 text-center font-bold font-mono text-slate-700">+{p.q1}</div>
                <div className="col-span-1 text-center font-bold font-mono text-slate-700">+{p.q2}</div>
                <div className="col-span-1 text-center font-bold font-mono text-slate-700">+{p.q3}</div>
                <div className="col-span-1 text-center font-bold font-mono text-slate-700">+{p.q4}</div>
                <div className="col-span-3 text-right font-bold font-mono text-emerald-600">
                  ${p.budget.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
