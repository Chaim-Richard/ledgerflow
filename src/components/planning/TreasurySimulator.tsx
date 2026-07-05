import React, { useState } from 'react';
import { Target, Activity, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function TreasurySimulator() {
  const [activeTab, setActiveTab] = useState<'monte-carlo'>('monte-carlo');

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="w-6 h-6 text-emerald-400" />
            Monte Carlo Treasury Simulator
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Stochastic forecasting for liquidity risk and cash runway.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
         <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
            <Activity className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Simulation Engine Ready</h2>
            <p className="text-slate-500 mb-8">Run 10,000 probabilistic scenarios against current cash reserves to determine 95% confidence intervals for runway depletion.</p>
            
            <div className="grid grid-cols-3 gap-6 mb-8 text-left">
               <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Current Cash</div>
                  <div className="text-2xl font-mono font-bold text-slate-900">$2.4M</div>
               </div>
               <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mean Burn Rate</div>
                  <div className="text-2xl font-mono font-bold text-rose-600">-$150k/mo</div>
               </div>
               <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Volatility (σ)</div>
                  <div className="text-2xl font-mono font-bold text-slate-900">22%</div>
               </div>
            </div>

            <button className="px-8 py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-sm hover:bg-emerald-400 transition-colors">
               Execute Simulation Run
            </button>
         </div>
      </div>
    </div>
  );
}
