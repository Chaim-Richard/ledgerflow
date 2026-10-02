import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, RefreshCw, Eye, Activity } from 'lucide-react';
import { globalEventBus } from '../../lib/eventBus';
import { useUIStore } from '../../stores/useUIStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency } from '../../lib/utils';

export default function LedgerInterruptOverlay() {
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const setActiveTab = useUIStore(s => s.setActiveTab);
  useLedgerStore(s => s.transactions);
  useLedgerStore(s => s.accounts);
  const recomputeBalances = useLedgerStore(s => s.recomputeBalances);
  const runFullAudit = useLedgerStore(s => s.runFullAudit);

  useEffect(() => {
    // Subscribe to audit exceptions from the global EventBus
    const unsubscribe = globalEventBus.subscribe('LEDGER_AUDIT_EXCEPTION', (eventData: any) => {
      // Only display the high-priority interrupt overlay for critical cryptographic or mathematical imbalances
      if (eventData && eventData.severity === 'critical') {
        setActiveAlert(eventData);
        setIsDismissed(false); // Re-open if a new critical failure is detected
      }
    });

    return () => unsubscribe();
  }, []);

  if (!activeAlert || isDismissed) return null;

  const result = activeAlert.result;

  const handleInspect = () => {
    setIsDismissed(true);
    setActiveTab('audit');
  };

  const handleSyncBalances = () => {
    // Trigger repair logic
    recomputeBalances();
    runFullAudit();
    // Check if the issue was resolved
    const updatedAudit = useLedgerStore.getState().auditResult;
    const stillHasIssues = updatedAudit && (
      !updatedAudit.isBalanced || 
      updatedAudit.imbalances.length > 0 || 
      updatedAudit.orphans.length > 0 || 
      !updatedAudit.hashChainValid || 
      updatedAudit.missingAccounts.length > 0
    );
    
    if (!stillHasIssues) {
      setActiveAlert(null);
    }
  };

  const handleOverride = () => {
    setIsDismissed(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 180 }}
          className="relative w-full max-w-4xl bg-zinc-950 text-white rounded-[32px] border-2 border-red-500/30 overflow-hidden shadow-[0_0_80px_rgba(239,68,68,0.2)] p-4 md:p-10 md:p-14"
        >
          {/* Diagnostic Grid Accents */}
          <div className="absolute inset-0 technical-grid opacity-[0.03] pointer-events-none" />
          <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
            <ShieldAlert size={300} className="text-red-500" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-start gap-10">
            {/* Warning Shield Badge */}
            <div className="flex-shrink-0 w-20 h-20 rounded-[32px] bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center text-red-500 shadow-2xl animate-pulse">
              <ShieldAlert size={44} />
            </div>

            {/* Core Issue Information */}
            <div className="flex-1 space-y-6">
              <div className="space-y-2">
                <span className="inline-flex px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-medium uppercase tracking-wider rounded-lg">
                  TRIPLE-ENTRY SECURITY PROTOCOL BREACHED
                </span>
                <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-none">
                  Ledger Disparity Identified
                </h2>
                <p className="text-zinc-400 text-xs tracking-wider uppercase font-mono mt-1">
                  CAUSAL CHAIN AUDIT STATUS: <span className="text-red-400 font-extrabold">COMPROMISED</span>
                </p>
              </div>

              <div className="p-4 md:p-8 bg-zinc-900/60 rounded-[32px] border border-white/5 space-y-6">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Activity size={14} className="text-red-400" />
                  Forensic Health Summary
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total Debits</p>
                    <p className="text-lg font-black font-mono text-zinc-100 tabular-nums">{formatCurrency(result?.totalDebits || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total Credits</p>
                    <p className="text-lg font-black font-mono text-zinc-100 tabular-nums">{formatCurrency(result?.totalCredits || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Trial Balance</p>
                    <p className={`text-lg font-black font-mono ${result?.isBalanced ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result?.isBalanced ? 'BALANCED' : 'IMBALANCED'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Hash Integrity</p>
                    <p className={`text-lg font-black font-mono ${result?.hashChainValid ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result?.hashChainValid ? 'VERIFIED' : 'BROKEN'}
                    </p>
                  </div>
                </div>

                {/* Exception List Table */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                    Detailed Exception Queues:
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {result?.imbalances?.map((imb: any, index: number) => (
                      <div key={`imb-${index}`} className="flex items-center justify-between text-xs p-3.5 bg-red-950/20 border border-red-900/10 rounded-xl">
                        <span className="font-mono text-zinc-400">UUID: {imb.id.substring(0, 8)}... ({imb.type})</span>
                        <span className="text-red-400 font-bold font-mono tabular-nums">Imbalance: {formatCurrency(imb.diff)}</span>
                      </div>
                    ))}
                    {!result?.hashChainValid && (
                      <div className="flex items-center justify-between text-xs p-3.5 bg-orange-950/20 border border-orange-900/10 rounded-xl">
                        <span className="font-mono text-zinc-400">Cryptographic Version Broken Chain</span>
                        <span className="text-orange-400 font-semibold font-mono">Chain Index broken at {result?.brokenChainIndex}</span>
                      </div>
                    )}
                    {result?.orphans?.map((orph: any, index: number) => (
                      <div key={`orph-${index}`} className="flex items-center justify-between text-xs p-3.5 bg-zinc-800/40 border border-white/5 rounded-xl">
                        <span className="font-mono text-zinc-400">UUID: {orph.id.substring(0, 8)}... ({orph.type})</span>
                        <span className="text-zinc-300 font-semibold">{orph.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/5">
                <button
                  onClick={handleInspect}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-[32px] text-[11px] font-medium uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-red-500/10"
                 aria-label="Deep Audit Diagnosis">
                  <Eye size={16} />
                  Deep Audit Diagnosis
                </button>

                <button
                  onClick={handleSyncBalances}
                  className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-white/10 active:scale-95 text-zinc-100 rounded-[32px] text-[11px] font-medium uppercase tracking-wider flex items-center gap-2 transition-all"
                 aria-label="Trigger Core Re-Sync">
                  <RefreshCw size={16} />
                  Trigger Core Re-Sync
                </button>

                <button
                  onClick={handleOverride}
                  className="px-6 py-3 bg-transparent hover:bg-[var(--surface)]/5 active:scale-95 text-zinc-400 hover:text-white rounded-[32px] text-[11px] font-medium uppercase tracking-wider transition-all"
                 aria-label="Safe Bypass">
                  Safe Bypass
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
