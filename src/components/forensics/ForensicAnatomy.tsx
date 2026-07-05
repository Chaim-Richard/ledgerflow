import React, { useMemo, useState } from 'react';
import { Transaction, ChartAccount } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Fingerprint, 
  AlertTriangle, 
  ArrowRight,
  Activity,
  CheckCircle2,
  FileSearch,
  SearchCode
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { useAuditTelemetry } from '../../hooks/useAuditTelemetry';

interface ForensicAnatomyProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  onAction: (action: string, details?: any) => void;
}

export default function ForensicAnatomy({ transactions, accounts, onAction }: ForensicAnatomyProps) {
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const metrics = useAuditTelemetry(transactions, accounts);

  const anomalies = useMemo(() => {
    return metrics.anomalies.map((a: any) => {
      const tx = transactions.find(t => t.id === a.transactionId);
      return { ...a, transaction: tx };
    }).filter((a: any) => a.transaction);
  }, [metrics.anomalies, transactions]);

  const selectedAnomaly = useMemo(() => 
    anomalies.find((a: any) => a.transactionId === selectedAnomalyId), 
    [anomalies, selectedAnomalyId]
  );

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest truncate mb-4">
            <SearchCode size={14} />
            Forensic Analysis
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Forensic Anatomy</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">Analytical decomposition of suspected data inconsistencies and outliers.</p>
        </div>
        <div className="flex gap-4">
           <div className="px-6 py-3 bg-rose-500 text-white rounded-[32px] text-[10px] font-medium uppercase tracking-wider truncate shadow-xl flex items-center gap-2">
              <ShieldAlert size={14} />
              {anomalies.length} Suspected Anomalies Detected
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Anomaly Stream */}
        <div className="lg:col-span-5 h-[calc(100vh-350px)] overflow-y-auto custom-scrollbar pr-4 space-y-4">
          {anomalies.map((a) => (
            <button
              key={a.transactionId}
              onClick={() => setSelectedAnomalyId(a.transactionId)}
              className={cn(
                "w-full p-8 text-left border rounded-[32px] transition-all relative overflow-hidden group",
                selectedAnomalyId === a.transactionId 
                  ? "bg-zinc-950 text-white border-zinc-900 shadow-2xl scale-[1.02]" 
                  : "bg-white border-slate-200 hover:border-rose-500/50 shadow-sm"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                   "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                   selectedAnomalyId === a.transactionId ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-500"
                )}>
                  <AlertTriangle size={20} />
                </div>
                <span className={cn(
                   "text-[9px] font-medium uppercase tracking-wider px-3 py-1 rounded-full",
                   selectedAnomalyId === a.transactionId ? "bg-white/10 text-white" : "bg-slate-50 text-slate-500"
                )}>
                  Score: {(a.score * 100).toFixed(0)}%
                </span>
              </div>
              
              <h4 className="text-lg font-black tracking-tight uppercase italic mb-2 truncate">
                {a.transaction?.payee || 'Unknown Agent'}
              </h4>
              <p className={cn(
                 "text-xs font-medium italic opacity-60 line-clamp-2",
                 selectedAnomalyId === a.transactionId ? "text-white/80" : "text-slate-500"
              )}>
                 {a.reason}
              </p>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-xl font-black tabular-nums">
                  {formatCurrency(a.transaction?.totalAmountCents || 0)}
                </span>
                <ArrowRight size={16} className={cn("transition-transform group-hover:translate-x-2", selectedAnomalyId === a.transactionId ? "text-rose-500" : "text-slate-200")} />
              </div>
            </button>
          ))}

          {anomalies.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-20 italic">
                <CheckCircle2 size={64} />
                <p className="text-xl font-medium uppercase tracking-wider truncate">Zero Deviations Located</p>
             </div>
          )}
        </div>

        {/* Deep Dive Panel */}
        <div className="lg:col-span-7">
           <AnimatePresence mode="wait">
              {selectedAnomaly ? (
                <motion.div 
                  key={selectedAnomaly.transactionId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-12 bg-white border border-slate-200 rounded-[32px] shadow-2xl h-full flex flex-col"
                >
                   <div className="flex items-center justify-between mb-12">
                      <div>
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest truncate block mb-2 font-mono">Forensic ID: {selectedAnomaly.transactionId.slice(0, 8)}</span>
                        <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Transaction Breakdown</h3>
                      </div>
                      <div className="flex gap-4">
                        <button className="px-6 py-3 border-2 border-slate-200 hover:border-rose-500 hover:text-rose-500 rounded-[32px] text-[10px] font-medium uppercase tracking-wider transition-all">Flag for Review</button>
                        <button className="px-6 py-3 bg-slate-900 text-white rounded-[32px] text-[10px] font-medium uppercase tracking-wider hover:bg-indigo-600 transition-all">Dismiss Node</button>
                      </div>
                   </div>

                    <div className="grid grid-cols-2 gap-8 mb-12">
                       <div className="p-4 md:p-8 bg-slate-50/50 rounded-[32px] space-y-4">
                          <div className="flex items-center gap-2 text-slate-500 opacity-40">
                             <Fingerprint size={16} />
                             <span className="text-[9px] font-medium uppercase tracking-wider">Digital Signature</span>
                          </div>
                          <p className="font-mono text-xs break-all opacity-60">{selectedAnomaly.signature || 'UNVERIFIED'}</p>
                       </div>
                       <div className="p-4 md:p-8 bg-slate-50/50 rounded-[32px] space-y-4">
                          <div className="flex items-center gap-2 text-slate-500 opacity-40">
                             <Activity size={16} />
                             <span className="text-[9px] font-medium uppercase tracking-wider">Z-Score Deviation</span>
                          </div>
                          <p className="text-2xl font-black text-rose-500">σ = {selectedAnomaly.zScore || 'N/A'}</p>
                       </div>
                    </div>

                   <div className="flex-1 space-y-10">
                      <div>
                         <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate mb-6">Historical Context comparison</h5>
                         <div className="h-2 bg-slate-200 rounded-full overflow-hidden flex">
                            <div className="h-full bg-slate-900 w-[30%]" />
                            <div className="h-full bg-rose-500 w-[70%] border-l-2 border-white" />
                         </div>
                         <div className="flex justify-between mt-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-40">
                            <span>Expected Variance Window</span>
                            <span>Observed Outlier Displacement</span>
                         </div>
                      </div>

                      <div className="bg-zinc-950 p-4 md:p-10 rounded-[32px] text-white relative overflow-hidden">
                         <div className="absolute technical-grid inset-0 opacity-[0.03]" />
                         <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-2 text-zinc-500">
                               <FileSearch size={18} />
                               <span className="text-[10px] font-medium uppercase tracking-wider truncate">Audit Narrative</span>
                            </div>
                            <p className="text-lg font-medium italic opacity-80 leading-relaxed">
                               The transaction originating from <span className="text-indigo-600">"{selectedAnomaly.transaction?.payee}"</span> exceeds the seasonally adjusted moving average by 3.2 standard deviations. Statistical analysis indicates this is consistent with a "Fat Finger" input or duplicate invoice scenario.
                            </p>
                         </div>
                      </div>
                   </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-50/30 rounded-[32px] border border-dashed border-slate-200 text-center space-y-6">
                   <SearchCode size={64} className="text-slate-200" />
                   <div>
                     <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest truncate">Node Selection Required</h3>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-widest opacity-40 mt-2 italic">Awaiting structural input for deep decomposition</p>
                   </div>
                </div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
