import React, { useState, useMemo } from 'react';
import { ShieldAlert, BarChart, Brain, Radar, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { mean, standardDeviation, calculateZScore, calculateBenfordsDistribution, benfordsLawExpected } from '../../lib/algorithms/math';

export default function AlgorithmicIntegrity() {
  const [activeTab, setActiveTab] = useState<'anomalies' | 'benford'>('anomalies');

  // Ledger data for algorithms
  const ledgerTransactions = useLedgerStore(state => state.transactions || []);
  
  const transactions = useMemo(() => {
    return ledgerTransactions.map(t => {
      let amt = 0;
      t.lines?.forEach(l => { amt += Math.abs(l.amountCents / 100); });
      return {
          id: t.id,
          date: t.date,
          account: 'Mixed', // Simplified
          amount: amt,
          vendor: t.payee || 'Unknown'
      };
    });
  }, [ledgerTransactions]);

  const amounts = transactions.map(t => t.amount);
  const m = mean(amounts);
  const std = standardDeviation(amounts);

  const anomalies = transactions.map(t => {
     const z = calculateZScore(t.amount, m, std);
     return { ...t, zScore: z };
  }).filter(t => Math.abs(t.zScore) > 2.5).sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  const benfordDist = calculateBenfordsDistribution(amounts);

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-[var(--ink)] text-[var(--panel)] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Brain className="w-6 h-6 text-fuchsia-400" />
            Algorithmic Integrity Engine
          </h1>
          <p className="text-sm text-[var(--faint)] mt-1">
            Uncover hidden patterns, statistical anomalies, and forensic deviations in the general ledger.
          </p>
        </div>
        <div className="flex gap-4">
           <div className="text-right">
              <div className="text-[10px] text-[var(--faint)] font-bold uppercase tracking-wider">Analyzed Records</div>
              <div className="text-xl font-bold font-mono text-[var(--panel)]">{transactions.length.toLocaleString()}</div>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 w-max">
          {[
            { id: 'anomalies', label: 'Z-Score Outliers', icon: Radar },
            { id: 'benford', label: 'Benford\'s Law Test', icon: BarChart }
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                   "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                   activeTab === tab.id ? "bg-[var(--ink)] text-[var(--panel)]" : "text-[var(--muted)] hover:bg-[var(--ink)]"
                )}
             >
                <tab.icon className="w-4 h-4" /> {tab.label}
             </button>
          ))}
        </div>

        {activeTab === 'anomalies' && (
          <div className="bg-[var(--surface)] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[var(--line)] bg-[var(--ink)] flex items-center justify-between">
               <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Detected Statistical Anomalies (|Z| &gt; 2.5)
               </h2>
               <div className="text-xs text-[var(--muted)] font-mono">μ = ${m.toFixed(2)} | σ = ${std.toFixed(2)}</div>
            </div>
            <div className="grid grid-cols-12 p-4 bg-[var(--ink)] border-b border-[var(--line)] text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Transaction ID</div>
              <div className="col-span-2">Account</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-3 text-right">Z-Score Deviation</div>
            </div>
            <div className="divide-y divide-slate-200">
              {anomalies.map(a => (
                <div key={a.id} className="grid grid-cols-12 p-4 items-center hover:bg-[var(--ink)] transition-colors">
                  <div className="col-span-2 text-xs font-mono text-slate-600">{a.date}</div>
                  <div className="col-span-3 font-bold text-[var(--text)]">{a.id}</div>
                  <div className="col-span-2 text-xs font-bold text-slate-700">{a.account}</div>
                  <div className="col-span-2 text-right font-mono font-bold text-[var(--text)]">
                     ${a.amount.toLocaleString()}
                  </div>
                  <div className="col-span-3 flex justify-end">
                     <span className="px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                        Z = {a.zScore.toFixed(2)}
                     </span>
                  </div>
                </div>
              ))}
              {anomalies.length === 0 && (
                 <div className="p-8 text-center text-[var(--muted)] text-sm">No statistical anomalies detected.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'benford' && (
           <div className="bg-[var(--surface)] rounded-2xl p-6 shadow-sm">
             <h2 className="text-lg font-bold text-[var(--text)] mb-2">Benford's Law Distribution</h2>
             <p className="text-sm text-[var(--muted)] mb-8">Compares the distribution of leading digits in the ledger against the expected logarithmic distribution. Large variances indicate potential data manipulation or artificial entries.</p>
             
             <div className="space-y-4">
                {[1,2,3,4,5,6,7,8,9].map(digit => {
                   const expected = benfordsLawExpected(digit);
                   const actual = benfordDist[digit] || 0;
                   const variance = Math.abs(expected - actual);
                   const isSuspect = variance > 0.05; // 5% variance threshold
                   
                   return (
                      <div key={digit} className="flex items-center gap-4">
                         <div className="w-8 text-center font-bold font-mono text-slate-700 text-lg">{digit}</div>
                         <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                               <span>Actual: {(actual * 100).toFixed(1)}%</span>
                               <span>Expected: {(expected * 100).toFixed(1)}%</span>
                            </div>
                            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                               <div className="absolute top-0 left-0 h-full bg-slate-200" style={{ width: `${expected * 100}%` }} />
                               <div className={cn("absolute top-0 left-0 h-full opacity-80", isSuspect ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${actual * 100}%` }} />
                            </div>
                         </div>
                         <div className="w-24 text-right">
                            {isSuspect && <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center justify-end gap-1"><AlertTriangle className="w-3 h-3" /> SUSPECT</span>}
                         </div>
                      </div>
                   )
                })}
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
