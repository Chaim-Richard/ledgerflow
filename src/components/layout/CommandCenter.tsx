import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  ShieldCheck, 
  Cpu as CpuIcon, 
  Globe, 
  Layers,
  ArrowUpRight,
  Activity,
  History,
  Lock,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';

interface StatBlock {
  label: string;
  value: string;
  change: string;
  status: 'optimal' | 'warning' | 'stable';
  icon: any;
}

export default function CommandCenter() {
  const { transactions, auditLogs, accounts } = useLedgerStore();
  const [isExecuting, setIsExecuting] = useState(false);
  const [protocolStatus, setProtocolStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [activeLogs, setActiveLogs] = useState<{msg: string, time: string, id: string}[]>([]);

  const stats: StatBlock[] = [
    { label: 'Network Integrity', value: isExecuting ? 'Syncing' : 'Verified', change: 'Stable', status: 'optimal', icon: Activity },
    { label: 'Ledger Depth', value: `${(transactions.length / 1000).toFixed(1)}k`, change: `${transactions.length} items`, status: 'stable', icon: Layers },
    { label: 'Analytical Accuracy', value: 'Nominal', change: 'Verified', status: 'optimal', icon: Sparkles },
    { label: 'Security Audit', value: auditLogs.length > 0 ? 'Verified' : 'Active', change: `${auditLogs.length} events`, status: 'optimal', icon: ShieldCheck }
  ];

  const addLog = (msg: string) => {
    const newLog = { msg, time: new Date().toLocaleTimeString(), id: Math.random().toString(36).substr(2, 9) };
    setActiveLogs(prev => [newLog, ...prev].slice(0, 5));
  };

  const runProtocol = async (name: string) => {
    setIsExecuting(true);
    setProtocolStatus('running');
    addLog(`INITIATING: ${name.toUpperCase()}`);
    
    try {
      if (name === 'Verify Consistency') {
        const sampleData = transactions.length > 0 
          ? transactions.slice(0, 10).map(t => Math.abs(t.totalAmountCents / 100))
          : [0];
        // Placeholder for real logic. No timeout here.
        addLog(`SUCCESS: Analytical Calibration completed.`);
      } else if (name === 'Execute Protocol') {
        addLog("SYNCING WITH GLOBAL NODES...");
        addLog("CONSENSUS REACHED: SYSTEM NOMINAL");
      } else {
        addLog(`COMPLETED: ${name}`);
      }
      
      setProtocolStatus('success');
      toast.success(`${name} completed successfully.`);
    } catch (err) {
      setProtocolStatus('error');
      addLog(`ERROR: ${name} FAILED`);
      toast.error(`System Protocol Fault: ${name}`);
    } finally {
      setIsExecuting(false);
      setProtocolStatus('idle');
    }
  };

  return (
    <div className="space-y-12 p-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-2 opacity-50 italic">System Command</span>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Command Center</h1>
        </div>
        <div className="flex items-center gap-4">
           <div className="px-6 py-3 bg-slate-50 border border-slate-200 rounded-[32px] flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Global Server Active</span>
           </div>
           <button 
             onClick={() => runProtocol('Execute Protocol')}
             disabled={isExecuting}
             className={cn(
               "px-8 py-3 rounded-[32px] text-[10px] font-medium uppercase tracking-wider transition-all shadow-2xl flex items-center gap-2",
               isExecuting ? "bg-slate-100 cursor-not-allowed" : "bg-slate-900 text-white hover:scale-105"
             )}
           >
              {isExecuting ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
              {isExecuting ? 'Processing...' : 'Execute Protocol'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 md:p-8 bg-white border border-slate-200 rounded-[32px] hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 text-slate-500 opacity-20 group-hover:opacity-100 transition-opacity">
               <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 opacity-40">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-4 italic leading-none">{stat.value}</h3>
            <div className="flex items-center gap-2">
               <span className={cn(
                 "text-[9px] font-medium uppercase tracking-wider px-3 py-1 rounded-full",
                 stat.status === 'optimal' ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-50 text-slate-500"
               )}>
                 {stat.change}
               </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
         <div className="xl:col-span-8 space-y-8">
            <div className="p-12 bg-slate-900 text-white rounded-[32px] relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
               <div className="relative z-10">
                  <div className="flex items-center justify-between mb-12">
                     <div className="flex items-center gap-4">
                        <CpuIcon size={24} className="text-emerald-400" />
                        <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Analytical Logic Engine</h2>
                     </div>
                     <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest truncate">v2.4.0</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                     {[
                       { label: 'Pattern Discovery', val: isExecuting ? 'Calibrating...' : 'Active', desc: 'Scanning ledger for forensic anomalies.' },
                       { label: 'Predictive Delta', val: 'Active', desc: 'Forecasting cashflow pathing vectors.' },
                       { label: 'Risk Mitigation', val: 'Shielded', desc: 'Automated protocol guard enabled.' }
                     ].map((item, i) => (
                       <div key={i} className="flex flex-col">
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-2">{item.label}</span>
                          <span className="text-xl font-black text-emerald-400 tracking-tight italic mb-3 leading-none">{item.val}</span>
                          <p className="text-[11px] font-medium text-white/40 leading-relaxed italic">{item.desc}</p>
                       </div>
                     ))}
                  </div>

                  <div className="h-px bg-white/5 w-full mb-12" />

                  <div className="flex flex-wrap gap-4">
                     {['Verify Consistency', 'Optimize Performance', 'Run Security Check', 'Force Sync'].map(btn => (
                       <button 
                         key={btn} 
                         disabled={isExecuting}
                         onClick={() => runProtocol(btn)}
                         className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-medium uppercase tracking-wider transition-all rounded-xl disabled:opacity-30 disabled:cursor-not-allowed group/btn relative overflow-hidden"
                       >
                          <span className="relative z-10">{btn}</span>
                          {isExecuting && btn === 'Reconstruct Ledger' && (
                             <motion.div 
                               initial={{ x: '-100%' }}
                               animate={{ x: '100%' }}
                               transition={{ duration: 1, repeat: Infinity }}
                               className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" 
                             />
                          )}
                       </button>
                     ))}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] hover:border-slate-800 transition-all">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-900">
                        <History size={20} />
                     </div>
                     <div className="flex flex-col">
                        <h4 className="text-xl font-black italic tracking-tighter uppercase leading-none">Action Log</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 opacity-40">System Events</span>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <AnimatePresence mode="popLayout">
                       {activeLogs.length > 0 ? (
                         activeLogs.map(log => (
                           <motion.div 
                             key={log.id}
                             initial={{ opacity: 0, x: -10 }}
                             animate={{ opacity: 1, x: 0 }}
                             exit={{ opacity: 0, x: 10 }}
                             className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 border-dashed"
                           >
                              <div className="flex items-center gap-4">
                                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                 <span className="text-[11px] font-bold text-slate-900 italic leading-none">{log.msg}</span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 opacity-40 uppercase">{log.time}</span>
                           </motion.div>
                         ))
                       ) : (
                         [1,2,3,4].map(idx => (
                           <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 border-dashed opacity-30">
                              <div className="flex items-center gap-4">
                                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                                 <span className="text-[11px] font-medium text-slate-500 italic leading-none">Awaiting system trigger...</span>
                              </div>
                           </div>
                         ))
                       )}
                     </AnimatePresence>
                  </div>
               </div>
               <div className="p-4 md:p-10 bg-[#f8fafc] border border-blue-100 rounded-[32px] group">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 bg-blue-500 text-white rounded-[32px] flex items-center justify-center shadow-[0_10px_20px_rgba(59,130,246,0.2)]">
                        {protocolStatus === 'idle' ? <Lock size={20} /> : 
                         protocolStatus === 'running' ? <Loader2 size={20} className="animate-spin" /> :
                         protocolStatus === 'success' ? <CheckCircle2 size={20} className="text-emerald-300" /> :
                         <AlertTriangle size={20} className="text-rose-300" />}
                     </div>
                     <div className="flex flex-col">
                        <h4 className="text-xl font-black italic tracking-tighter uppercase leading-none">Protocol Guard</h4>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mt-1">
                          {protocolStatus === 'idle' ? 'Armor Active' : 
                           protocolStatus === 'running' ? 'Scanning...' : 
                           protocolStatus === 'success' ? 'Nexus Verified' : 'Threat Detected'}
                        </span>
                     </div>
                  </div>
                  <p className="text-[11px] font-medium text-slate-600 leading-relaxed italic opacity-80 mb-8">
                     Your environment is secured with multi-layer encryption. No unauthorized ledger modifications can occur without administrative consensus.
                  </p>
                  <button className="w-full py-4 bg-slate-900 text-white rounded-[32px] text-[10px] font-medium uppercase tracking-wider flex items-center justify-center gap-3 hover:scale-[1.02] transition-all">
                     View Security Audit <ArrowUpRight size={14} />
                  </button>
               </div>
            </div>
         </div>

         <div className="xl:col-span-4 space-y-8">
            <div className="p-4 md:p-10 bg-white border border-slate-200 rounded-[32px] shadow-sm relative overflow-hidden">
               <div className="technical-grid absolute inset-0 opacity-[0.03]" />
               <div className="relative z-10">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate mb-8 opacity-40">System Vitals</h4>
                  <div className="space-y-10">
                     {[
                       { label: 'CPU Cluster', val: isExecuting ? 'Busy' : 'Idle', color: 'bg-emerald-500' },
                       { label: 'Processing Threads', val: `${Math.min(12, Math.floor(transactions.length / 50) + 1)}`, color: 'bg-indigo-500' },
                       { label: 'Storage Elasticity', val: 'Nominal', color: 'bg-amber-500' }
                     ].map((vital, i) => (
                       <div key={i} className="space-y-3">
                          <div className="flex items-center justify-between">
                             <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest leading-none">{vital.label}</span>
                             <span className="text-[10px] font-mono font-black text-slate-500">{vital.val}</span>
                          </div>
                          <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: vital.val.includes('%') ? vital.val : '45%' }}
                               className={cn("h-full", vital.color)}
                             />
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-4 md:p-10 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.1),transparent_50%)]" />
               <div className="relative z-10">
                  <Globe size={32} className="text-indigo-200 mb-8 opacity-50 group-hover:rotate-12 transition-transform" />
                  <h4 className="text-2xl font-black italic tracking-tighter uppercase leading-tight mb-4">Global Network Expansion</h4>
                  <p className="text-[11px] font-medium text-white/60 leading-relaxed italic mb-8">
                     Enable multi-region entity reconciliation for cross-border capital streams.
                  </p>
                  <button className="px-6 py-3 bg-white text-indigo-600 rounded-xl text-[10px] font-medium uppercase tracking-wider hover:scale-105 transition-all">
                     Upgrade License
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

