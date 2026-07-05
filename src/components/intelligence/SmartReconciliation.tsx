import React, { useState } from 'react';
import { ArrowRightLeft, CheckCircle2, ShieldAlert, Cpu, Zap, Link } from 'lucide-react';
import { cn } from '../../lib/utils';
import { combineStringSimilarity } from '../../lib/algorithms/fuzzy';

export default function SmartReconciliation() {
  const [activeTab, setActiveTab] = useState<'matches' | 'unmatched'>('matches');

  // Simulated un-reconciled bank feed lines
  const bankFeed: any[] = [];

  // Simulated un-reconciled ledger entries
  const ledgerEntries: any[] = [];

  // Run matching algorithm
  const matches = [];
  const unmatchedBank = [...bankFeed];
  
  for (const bank of bankFeed) {
     let bestMatch = null;
     let highestScore = 0;
     
     for (const ledger of ledgerEntries) {
        // Must match amount exactly (or within 1 cent due to rounding)
        if (Math.abs(bank.amount - ledger.amount) > 0.01) continue;
        
        // Date proximity (within 3 days)
        const bankDate = new Date(bank.date).getTime();
        const ledgerDate = new Date(ledger.date).getTime();
        const daysDiff = Math.abs(bankDate - ledgerDate) / (1000 * 3600 * 24);
        if (daysDiff > 3) continue;
        
        // String similarity score
        const similarity = combineStringSimilarity(bank.description, ledger.description);
        
        // Combined heuristic score
        // 50% exact amount, 20% date closeness, 30% text similarity
        const score = 0.5 + (0.2 * (1 - daysDiff/3)) + (0.3 * similarity);
        
        if (score > highestScore && score > 0.6) { // Minimum threshold 60% confidence
           highestScore = score;
           bestMatch = ledger;
        }
     }
     
     if (bestMatch) {
        matches.push({ bank, ledger: bestMatch, confidence: highestScore });
        // remove from unmatched
        const idx = unmatchedBank.findIndex(b => b.id === bank.id);
        if (idx > -1) unmatchedBank.splice(idx, 1);
     }
  }

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Zap className="w-6 h-6 text-sky-400" />
            Smart Reconciliation Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Fuzzy matching and multi-factor heuristic algorithms for automated bank to ledger reconciliation.
          </p>
        </div>
        <button className="h-10 px-4 bg-sky-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-sky-400 transition-colors">
           <Cpu className="w-4 h-4" /> Run Algorithm
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'matches', label: `High Confidence Matches (${matches.length})`, icon: Link },
            { id: 'unmatched', label: `Unmatched Exceptions (${unmatchedBank.length})`, icon: ShieldAlert }
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

        {activeTab === 'matches' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Bank Statement Line</div>
              <div className="col-span-1 flex justify-center"><ArrowRightLeft className="w-4 h-4 text-slate-300" /></div>
              <div className="col-span-4">Ledger Entry</div>
              <div className="col-span-2 text-right">Amount Matched</div>
              <div className="col-span-1 text-right">Confidence</div>
            </div>
            <div className="divide-y divide-slate-200">
              {matches.map(m => (
                <div key={m.bank.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-4 border-r border-slate-100 pr-4">
                     <div className="font-bold text-slate-900">{m.bank.description}</div>
                     <div className="text-[10px] font-mono text-slate-400 mt-0.5">{m.bank.date} • {m.bank.id}</div>
                  </div>
                  <div className="col-span-1 flex justify-center">
                     <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                     </div>
                  </div>
                  <div className="col-span-4 pl-4">
                     <div className="font-bold text-slate-900">{m.ledger.description}</div>
                     <div className="text-[10px] font-mono text-slate-400 mt-0.5">{m.ledger.date} • {m.ledger.id}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                     ${Math.abs(m.bank.amount).toLocaleString()}
                  </div>
                  <div className="col-span-1 flex justify-end">
                     <span className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider border",
                        m.confidence > 0.85 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                     )}>
                        {(m.confidence * 100).toFixed(1)}%
                     </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'unmatched' && (
           <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
               <div className="col-span-6">Bank Statement Line</div>
               <div className="col-span-3 text-center">Date</div>
               <div className="col-span-3 text-right">Amount</div>
             </div>
             <div className="divide-y divide-slate-200">
               {unmatchedBank.map(bank => (
                  <div key={bank.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                     <div className="col-span-6">
                        <div className="font-bold text-slate-900">{bank.description}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{bank.id}</div>
                     </div>
                     <div className="col-span-3 text-center text-xs font-mono text-slate-600">
                        {bank.date}
                     </div>
                     <div className="col-span-3 text-right font-mono font-bold text-slate-900">
                        ${bank.amount.toLocaleString()}
                     </div>
                  </div>
               ))}
               {unmatchedBank.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">All items matched perfectly.</div>
               )}
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
