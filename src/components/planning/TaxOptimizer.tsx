import React, { useState } from 'react';
import { Target } from 'lucide-react';

export default function TaxOptimizer() {
  const [activeTab, setActiveTab] = useState<'scenarios'>('scenarios');

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Target className="w-6 h-6 text-fuchsia-400" />
            Tax Scenario Optimizer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Simulate tax liabilities across different structural entities and jurisdictions.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
           <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Current Tax Projection</h2>
              <div className="text-3xl font-mono font-bold text-rose-600 mt-2">$425,000</div>
              <div className="text-sm text-slate-500 mt-1">Estimated FY2026 Liability</div>
           </div>

           <div className="grid grid-cols-2 gap-8">
              <div>
                 <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Simulated Adjustments</h3>
                 <div className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-slate-900">Accelerate Depreciation (Section 179)</span>
                          <span className="text-xs font-mono text-emerald-600">-$45,000</span>
                       </div>
                       <input type="range" className="w-full" defaultValue={50} />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-slate-900">R&D Tax Credit Capitalization</span>
                          <span className="text-xs font-mono text-emerald-600">-$120,000</span>
                       </div>
                       <input type="range" className="w-full" defaultValue={80} />
                    </div>
                 </div>
              </div>
              
              <div className="bg-slate-900 rounded-xl p-6 text-white">
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Optimized Result</h3>
                 <div className="text-4xl font-mono font-bold text-emerald-400 mb-2">$260,000</div>
                 <div className="text-sm text-slate-300">Potential Savings: $165,000</div>
                 
                 <button className="w-full mt-8 py-3 bg-fuchsia-500 hover:bg-fuchsia-400 text-white rounded-lg font-bold transition-colors">
                    Export Scenario Report
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
