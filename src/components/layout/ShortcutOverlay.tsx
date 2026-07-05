import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Command, Search, ShieldCheck, Zap, Activity, Download, Plus, Settings } from 'lucide-react';

interface ShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutOverlay({ isOpen, onClose }: ShortcutOverlayProps) {
  const shortcuts: any[] = [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.5)] border border-slate-200 overflow-hidden"
          >
            <div className="p-4 md:p-10 border-b border-slate-200 bg-slate-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Command Directives</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Accelerated Keyboard Navigation</p>
                </div>
                <button 
                  onClick={onClose}
                  className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-800 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-4 md:p-10 grid grid-cols-1 gap-4 overflow-y-auto max-h-[60dvh] scrollbar-hide">
              {shortcuts.map((s, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-5 rounded-[32px] border border-transparent hover:border-slate-200 hover:bg-slate-50/20 transition-all group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-10 h-10 rounded-xl bg-slate-900/[0.03] border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors">
                      <s.icon size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-900">{s.label}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {s.mod && (
                      <span className="px-3 py-1.5 h-8 min-w-[32px] rounded-lg bg-slate-900 text-white/90 text-[10px] font-medium uppercase tracking-wider flex items-center justify-center shadow-lg shadow-ledger-ink/20">
                        {s.mod === 'Cmd' ? '⌘' : s.mod}
                      </span>
                    )}
                    <span className="px-3 py-1.5 h-8 min-w-[32px] rounded-lg bg-white border-2 border-slate-200 text-slate-900 text-[11px] font-medium uppercase tracking-wider flex items-center justify-center shadow-sm">
                      {s.key}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 md:p-8 bg-slate-900 text-center">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                Master the Protocol • Velocity is Efficiency
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
