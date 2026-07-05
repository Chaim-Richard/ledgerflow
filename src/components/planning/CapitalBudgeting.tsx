import React, { useState } from 'react';
import { Target, Search, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { calculateIRR, calculateNPV } from '../../lib/algorithms/math';

export default function CapitalBudgeting() {
  const [activeTab, setActiveTab] = useState<'irr'>('irr');

  const projects: any[] = [];

  const analysis = projects.map(p => {
     const irr = calculateIRR(p.initial, p.flows) * 100;
     const npv = calculateNPV(p.rate, p.initial, p.flows);
     const status = irr > (p.rate * 100) ? 'Favorable' : 'Unfavorable';
     return { ...p, irr, npv, status };
  });

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Capital Budgeting & IRR
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Algorithmic project valuation, Net Present Value (NPV), and Internal Rate of Return (IRR).
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Project / Investment</div>
            <div className="col-span-2 text-right">Initial Outlay</div>
            <div className="col-span-2 text-center">Hurdle Rate</div>
            <div className="col-span-2 text-right text-emerald-600">Calculated IRR</div>
            <div className="col-span-2 text-right text-indigo-600">Calculated NPV</div>
            <div className="col-span-1 text-right">Action</div>
          </div>
          <div className="divide-y divide-slate-200">
            {analysis.map(a => (
              <div key={a.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <div className="font-bold text-slate-900">{a.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{a.id} • {a.flows.length} Yrs</div>
                </div>
                <div className="col-span-2 text-right font-mono text-sm text-rose-600">
                  -${a.initial.toLocaleString()}
                </div>
                <div className="col-span-2 text-center font-mono text-sm text-slate-600">
                   {(a.rate * 100).toFixed(1)}%
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-emerald-600">
                   {a.irr.toFixed(2)}%
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-indigo-600">
                   ${a.npv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="col-span-1 flex justify-end">
                   <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      a.status === 'Favorable' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-rose-50 text-rose-700 border-rose-200"
                   )}>
                      {a.status === 'Favorable' ? 'GO' : 'NO GO'}
                   </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
