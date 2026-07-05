import React, { useState } from 'react';
import { Target, Clock, AlertTriangle, TrendingDown, Layers, Search, ShieldAlert, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { calculateNPV, calculateZScore, mean, standardDeviation } from '../../lib/algorithms/math';

export default function DeepPredictiveMaintenance() {
  const [activeTab, setActiveTab] = useState<'weibull' | 'depreciation'>('weibull');

  const assets: any[] = [];

  // Simulating Weibull shape (beta) and scale (eta) parameters for each asset
  // beta > 1 means increasing failure rate (wear out)
  // beta < 1 means decreasing failure rate (infant mortality)
  // beta = 1 means constant failure rate (random)

  const calcWeibull = (t: number, eta: number, beta: number) => {
     // Hazard rate h(t) = (beta/eta) * (t/eta)^(beta-1)
     return (beta / eta) * Math.pow(t / eta, beta - 1);
  };

  const assetAnalysis = assets.map(a => {
     const fails = a.failureHistory;
     const avgFail = mean(fails);
     const stdFail = standardDeviation(fails);
     
     // Approximation of Weibull Beta based on variation
     const cv = stdFail / avgFail; // Coefficient of variation
     const betaApprox = cv === 0 ? 3 : Math.pow(cv, -1.086); // Approximation formula
     
     const etaApprox = avgFail / Math.exp(1 / betaApprox); // Approximation
     
     const currentHazard = calcWeibull(a.lastFail, etaApprox || a.mtbf, betaApprox || 2);
     
     const zScore = calculateZScore(a.lastFail, avgFail, stdFail);
     const riskLevel = currentHazard > 0.05 ? 'Critical' : currentHazard > 0.02 ? 'Warning' : 'Normal';

     return { ...a, avgFail, stdFail, betaApprox, etaApprox, currentHazard, zScore, riskLevel };
  });

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Cpu className="w-6 h-6 text-amber-400" />
            Deep Algorithmic Maintenance
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Weibull reliability modeling and statistical failure prediction for capital assets.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'weibull', label: 'Weibull Reliability Analysis', icon: Target },
            { id: 'depreciation', label: 'Replacement NPV', icon: TrendingDown }
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

        {activeTab === 'weibull' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
               <h2 className="text-sm font-bold text-slate-900">Failure Probability (Hazard Rate)</h2>
               <div className="text-xs text-slate-500 font-mono">h(t) = (β/η) * (t/η)^(β-1)</div>
             </div>
             <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
               <div className="col-span-3">Asset</div>
               <div className="col-span-2 text-center">Avg MTBF (μ)</div>
               <div className="col-span-2 text-center">Shape Factor (β)</div>
               <div className="col-span-3 text-center">Current Hazard Rate</div>
               <div className="col-span-2 text-right">Risk Assessment</div>
             </div>
             <div className="divide-y divide-slate-200">
               {assetAnalysis.map(a => (
                  <div key={a.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                     <div className="col-span-3">
                        <div className="font-bold text-slate-900">{a.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{a.id} • Age: {a.age}y</div>
                     </div>
                     <div className="col-span-2 text-center font-mono text-xs text-slate-700">
                        {a.avgFail > 0 ? a.avgFail.toFixed(0) : a.mtbf} hrs
                     </div>
                     <div className="col-span-2 text-center font-mono text-xs text-slate-700">
                        {a.betaApprox > 0 && a.betaApprox !== Infinity ? a.betaApprox.toFixed(2) : 'N/A'}
                     </div>
                     <div className="col-span-3 px-8">
                        <div className="flex items-center justify-between text-[10px] font-bold font-mono mb-1">
                           <span className={cn(a.currentHazard > 0.05 ? "text-rose-500" : "text-emerald-500")}>
                              {(a.currentHazard * 100).toFixed(2)}% chance
                           </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                              className={cn("h-full rounded-full", a.currentHazard > 0.05 ? "bg-rose-500" : a.currentHazard > 0.02 ? "bg-amber-500" : "bg-emerald-500")}
                              style={{ width: `${Math.min(100, a.currentHazard * 1000)}%` }} // Scaled for visual
                           />
                        </div>
                     </div>
                     <div className="col-span-2 flex justify-end">
                        <span className={cn(
                           "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1",
                           a.riskLevel === 'Critical' ? "bg-rose-50 text-rose-700 border-rose-200" :
                           a.riskLevel === 'Warning' ? "bg-amber-50 text-amber-700 border-amber-200" :
                           "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                           {a.riskLevel === 'Critical' && <ShieldAlert className="w-3 h-3" />}
                           {a.riskLevel}
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
