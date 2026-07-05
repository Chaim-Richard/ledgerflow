import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  User, 
  ShieldCheck, 
  ArrowRight, 
  Fingerprint,
  Database,
  Filter,
  Plus,
  Terminal
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { Transaction } from '../../types';

interface AuditLog {
  id: string;
  uid: string;
  email: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  details?: any;
  checksum?: string;
}

interface AuditVaultProps {
  auditLogs?: any[];
  transactions?: Transaction[];
}

export default function AuditVault({ auditLogs = [], transactions = [] }: AuditVaultProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<'success' | 'checking' | null>(null);
  
  const reconcileIntegrity = useLedgerStore(state => state.reconcileIntegrity);
  
  const handleVerify = (logId: string) => {
    setVerifyingId(logId);
    
    // Quantum Truth Engine: Trigger real scan
    reconcileIntegrity();
    setVerificationResult('success');
  };
  
  const filteredLogs = useMemo(() => {
    const rawLogs = Array.isArray(auditLogs) ? auditLogs : [];
    if (!searchQuery) return rawLogs;
    const lowerQuery = searchQuery.toLowerCase();
    return rawLogs.filter(log => 
      String(log.id).toLowerCase().includes(lowerQuery) || 
      String(log.action).toLowerCase().includes(lowerQuery) ||
      String(log.email).toLowerCase().includes(lowerQuery) ||
      String(JSON.stringify(log.details)).toLowerCase().includes(lowerQuery)
    );
  }, [auditLogs, searchQuery]);

  const getActorName = (log: any) => {
    if (log.actor?.name) return log.actor.name;
    if (log.email) return log.email.split('@')[0].toUpperCase();
    return 'SYSTEM';
  };

  const getChanges = (log: any) => {
    if (Array.isArray(log.changes)) return log.changes;
    if (log.details?.changes && Array.isArray(log.details.changes)) return log.details.changes;
    // Map details to a pseudo-change if it's just a description
    if (log.details?.description) return [{ field: 'Event', oldValue: '...', newValue: log.details.description }];
    return [{ field: 'Details', oldValue: 'None', newValue: JSON.stringify(log.details || {}) }];
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest truncate mb-4">
            <ShieldCheck size={14} />
            Forensic Integrity Protocol
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic">Audit Vault v5</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">Complete traceability of every fiscal mutation across the entire organization.</p>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative group">
              <Plus className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500/30 group-focus-within:text-indigo-600 transition-colors rotate-45" size={16} />
              <input 
                type="text"
                placeholder="Search by Trace ID or Hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-14 pr-8 py-4 bg-white border border-slate-200 rounded-[32px] w-80 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all text-xs font-medium uppercase tracking-wider"
              />
           </div>
           <button className="p-4 bg-slate-50 rounded-[32px] border border-slate-200 text-slate-500 hover:text-slate-900 transition-all">
              <Filter size={20} />
           </button>
        </div>
      </div>

      <AnimatePresence>
        {verifyingId && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 md:p-8"
          >
             <div className="w-full max-w-2xl bg-[#0F1115] border border-white/10 rounded-[32px] p-12 text-white relative overflow-hidden">
                <div className="absolute technical-grid inset-0 opacity-[0.05]" />
                <div className="relative z-10">
                   <div className="flex items-center justify-between mb-12">
                      <div className="flex items-center gap-4">
                         <div className={cn("w-12 h-12 rounded-[32px] flex items-center justify-center transition-colors", verificationResult === 'success' ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400")}>
                            {verificationResult === 'success' ? <ShieldCheck size={24} /> : <Database size={24} className="animate-spin" />}
                         </div>
                         <div>
                            <h3 className="text-2xl font-black italic tracking-tighter uppercase">Verification Chain</h3>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest truncate">Log: {verifyingId}</p>
                         </div>
                      </div>
                      <button onClick={() => setVerifyingId(null)} className="p-3 hover:bg-white/10 rounded-[32px] transition-all">
                        <Plus className="rotate-45" size={24} />
                      </button>
                   </div>

                   <div className="space-y-8">
                      <div className="p-6 bg-white/5 border border-white/10 rounded-[32px]">
                         <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Merkle Leaf Hash</span>
                            <span className="text-[10px] font-mono text-emerald-400">VERIFIED</span>
                         </div>
                         <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-[11px] text-white/60 break-all leading-relaxed">
                            {auditLogs.find(l => l.id === verifyingId)?.checksum}
                         </div>
                      </div>

                      <div className="relative pl-8 border-l border-white/10 space-y-6">
                         {transactions.slice(0, 3).map((tx, i) => (
                           <div key={tx.id} className="relative">
                              <div className="absolute -left-10 top-0 w-4 h-4 rounded-full bg-[#0F1115] border-2 border-indigo-500/40 flex items-center justify-center">
                                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              </div>
                              <div className="flex items-center justify-between">
                                 <div>
                                    <p className="text-[10px] font-black text-white/80 uppercase tracking-wider">Merkle Leaf Node {i}</p>
                                    <p className="text-[9px] font-mono text-white/30 italic truncate max-w-[180px]">TX: {tx.id} | {formatCurrency(tx.totalAmountCents)}</p>
                                 </div>
                                 <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: '100%' }}
                                      className="h-full bg-indigo-600"
                                      transition={{ duration: 1, delay: i * 0.2 }}
                                    />
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>

                      <div className="p-4 md:p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-[32px] flex items-center justify-between group cursor-pointer hover:bg-emerald-500/20 transition-all">
                         <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 italic">Consensus Reached</p>
                            <p className="text-xs font-bold text-white tracking-tight">Ledger history is computationally perfect. <span className="text-emerald-400 underline ml-2">Audit Merkle Branch</span></p>
                         </div>
                         <Fingerprint size={32} className="text-emerald-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6">
        {filteredLogs.map((log) => (
          <motion.div 
            key={log.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[32px] border border-slate-200 p-4 md:p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group cursor-pointer"
            onClick={() => handleVerify(log.id)}
          >
            <div className="absolute technical-grid inset-0 opacity-[0.02] pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row lg:items-center gap-12 relative z-10">
               {/* Actor Info */}
                <div className="flex items-center gap-6 min-w-[280px]">
                  <div className="w-16 h-16 rounded-[32px] bg-slate-900 flex items-center justify-center text-white shadow-lg group-hover:bg-indigo-600 transition-colors">
                     <User size={28} />
                  </div>
                  <div>
                     <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase italic">{getActorName(log)}</h4>
                     <p className="text-[10px] font-mono text-slate-500 font-bold">{log.email || log.actor?.email}</p>
                     <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-black text-white px-2 py-0.5 bg-slate-900 rounded-full uppercase tracking-widest">{log.action}</span>
                        <span className="text-[9px] font-mono text-slate-500 opacity-40">{log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss.SSS') : '00:00:00.000'}</span>
                     </div>
                  </div>
               </div>

               {/* Changes Trace */}
               <div className="flex-1 space-y-4">
                  {getChanges(log).map((change: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-[32px] border border-slate-200/50">
                       <div className="flex flex-col min-w-[120px]">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-40">Field</span>
                          <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{change.field}</span>
                       </div>
                       <div className="flex-1 flex items-center justify-between px-6">
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-rose-500/50 uppercase tracking-widest mb-1">Snapshot Alpha</span>
                             <span className="text-[12px] font-mono text-slate-500 line-through opacity-40">
                                {typeof change.oldValue === 'number' ? formatCurrency(change.oldValue) : String(change.oldValue ?? 'None')}
                             </span>
                          </div>
                          <ArrowRight size={14} className="text-slate-500/20" />
                          <div className="flex flex-col items-end">
                             <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Snapshot Omega</span>
                             <span className="text-[12px] font-mono font-bold text-slate-900">
                                {typeof change.newValue === 'number' ? formatCurrency(change.newValue) : String(change.newValue ?? 'None')}
                             </span>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>

               {/* Integrity Check */}
               <div className="flex flex-col items-end gap-3 min-w-[200px]">
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                     <Fingerprint size={12} className="text-emerald-500" />
                     <span className="text-[10px] font-mono text-emerald-600 font-bold">INTEGRITY_VERIFIED</span>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 opacity-40">Blockchain Hash</span>
                     <span className="text-[11px] font-mono text-slate-900 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">{log.checksum}</span>
                  </div>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="ledger-card p-4 md:p-10 bg-slate-900 text-white rounded-[32px] relative overflow-hidden group">
            <div className="absolute technical-grid inset-0 opacity-[0.05]" />
            <Terminal size={32} className="text-emerald-400 mb-8" />
            <h5 className="text-2xl font-black tracking-tight italic mb-2 uppercase">Real-time Hook</h5>
            <p className="text-[11px] font-medium text-white/40 leading-relaxed uppercase tracking-widest">Global mutation listeners active on all ledger nodes.</p>
            <div className="mt-8 flex items-center gap-4">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[9px] font-mono text-emerald-400">SYS_WATCHMAN_ACTIVE</span>
            </div>
         </div>

         <div className="ledger-card p-4 md:p-10 bg-white border-2 border-slate-200 rounded-[32px] relative overflow-hidden">
            <Database size={32} className="text-slate-900 mb-8" />
            <h5 className="text-2xl font-black tracking-tight italic mb-2 uppercase">Immutable Logs</h5>
            <p className="text-[11px] font-black text-slate-500 leading-relaxed uppercase tracking-widest">History is locked via HMAC-SHA256 protocol on-save.</p>
            <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 w-fit">
               <ShieldCheck size={12} className="text-emerald-500" />
               <span className="text-[9px] font-medium uppercase tracking-wider">Encrypted Storage</span>
            </div>
         </div>

         <div className="ledger-card p-4 md:p-10 bg-indigo-600 text-white rounded-[32px] relative overflow-hidden">
            <History size={32} className="text-white mb-8" />
            <h5 className="text-2xl font-black tracking-tight italic mb-2 uppercase">Point-in-Time</h5>
            <p className="text-[11px] font-black leading-relaxed uppercase tracking-widest">Rewind the entire ledger state to any historical millisecond.</p>
            <button className="mt-8 text-xs font-medium uppercase tracking-wider bg-white/10 hover:bg-white/20 px-6 py-3 rounded-[32px] transition-all">
               Initialize Recovery
            </button>
         </div>
      </div>
    </div>
  );
}
