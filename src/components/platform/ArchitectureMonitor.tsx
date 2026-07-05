import React from 'react';
import { motion } from 'motion/react';
import { 
  Activity, 
  ShieldCheck, 
  Cpu as CpuIcon, 
  GitBranch, 
  TrendingUp,
  Search,
  Filter
} from 'lucide-react';

export default function ArchitectureMonitor({ layerStatus }: { layerStatus: any[] }) {
  const flow: any[] = [];

  return (
    <div className="p-4 md:p-8 bg-slate-50 rounded-[32px] border border-slate-200 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 md:p-8">
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 mb-4 h-fit">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Global Heartbeat Stable</span>
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-4 py-8 relative z-10">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
           <div className="w-96 h-96 border-2 border-slate-800 rounded-full animate-[spin_20s_linear_infinity]" />
           <div className="absolute w-64 h-64 border border-slate-800 rounded-full animate-[spin_15s_linear_infinity_reverse]" />
        </div>

        {flow.map((step, i) => (
          <React.Fragment key={step.id}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="w-full max-w-md group relative"
            >
              <div className="p-5 bg-white border border-slate-200 rounded-[32px] flex items-center justify-between hover:border-indigo-600 hover:shadow-xl hover:shadow-ledger-accent/5 transition-all cursor-crosshair">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-white rounded-[32px] flex items-center justify-center text-slate-900 border border-slate-200 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                    <step.icon size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                       <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 leading-none">{step.layer}</p>
                       <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                    <h4 className="text-base font-black text-slate-900 tracking-tight">{step.name}</h4>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none">Status: Ready</span>
                      <ShieldCheck size={14} className="text-emerald-500" />
                   </div>
                </div>
              </div>
            </motion.div>
            
            {i < flow.length - 1 && (
              <div className="flex flex-col items-center py-2 relative h-12">
                <div className="w-px h-full bg-gradient-to-b from-ledger-ink/20 via-ledger-accent/50 to-ledger-ink/20" />
                <motion.div 
                  animate={{ y: [0, 48] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute top-0 w-1.5 h-1.5 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-8 pt-8 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-[32px] border border-slate-200">
             <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Primary Engine</p>
             <p className="text-xs font-bold text-slate-900">Aho-Corasick Deterministic matching active.</p>
          </div>
          <div className="p-4 bg-white rounded-[32px] border border-slate-200">
             <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Integrity Proof</p>
             <p className="text-xs font-bold text-slate-900">SHA-256 Chain Verification active.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
