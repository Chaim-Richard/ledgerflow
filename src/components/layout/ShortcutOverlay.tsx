
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Command, Search, Activity, Zap, FileDown, Database, LayoutDashboard, List, Keyboard } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { APP_TABS, SETTINGS_TABS_REGISTRY, REPORT_TABS_REGISTRY, INTELLIGENCE_TABS_REGISTRY, ANALYTICAL_LENSES_REGISTRY } from '../../config/registry';

interface ShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutOverlay({ isOpen, onClose }: ShortcutOverlayProps) {
  const language = useUIStore(s => s.language);
  const speedDials = useUIStore(s => s.speedDials);

  const shortcuts = [
    { key: '⌘ + K', desc: 'Command Palette', icon: Search },
    { key: '⌘ + Q', desc: 'Quick Entry Mode', icon: Zap },
    { key: '⌘ + 1', desc: 'Dashboard View', icon: LayoutDashboard },
    { key: '⌘ + 2', desc: 'Transactions', icon: List },
    { key: '⌘ + 3', desc: 'Ledger Engine', icon: Database },
    { key: '⌘ + E', desc: 'Export Data', icon: FileDown },
    { key: '⌘ + P', desc: 'Reporting Engine', icon: Activity },
    { key: '⌘ + ⇧ + A', desc: 'System Architecture', icon: Command },
    { key: '⌘ + ⇧ + K', desc: 'Diagnostic Console', icon: Activity },
    { key: '⌘ + ⇧ + D', desc: 'Toggle Dark Mode', icon: Activity },
    { key: '⌘ + I', desc: 'Bank Feed Importer', icon: Database },
    { key: '⌘ + F', desc: 'Zen/Focus Mode', icon: Activity },
    { key: '?', desc: 'Keyboard Shortcuts', icon: Keyboard },
    { key: 'Esc', desc: 'Close Drawers', icon: X },
  ];

  const hasSpeedDials = speedDials && Object.keys(speedDials).length > 0;
  
  const ALL_TOOLS = [
    ...APP_TABS,
    ...SETTINGS_TABS_REGISTRY,
    ...REPORT_TABS_REGISTRY,
    ...INTELLIGENCE_TABS_REGISTRY,
    ...ANALYTICAL_LENSES_REGISTRY
  ];

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
            className="relative w-full max-w-4xl bg-[var(--surface)] rounded-[32px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.5)] border border-[var(--line)] overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-8 md:p-10 border-b border-[var(--line)] bg-[var(--ink)]/30 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-[var(--text)] tracking-tighter">Command Directives</h2>
                  <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-1">Accelerated Keyboard Navigation</p>
                </div>
                <button aria-label="Close" 
                  onClick={onClose}
                  className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:border-slate-800 transition-all shadow-sm"
                ><X size={20} /></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-12">
              <div>
                <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Command size={14} className="text-[var(--muted)]" />
                  System Shortcuts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {shortcuts.map((s) => (
                    <div 
                      key={s.key}
                      className="flex items-center justify-between p-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm hover:border-slate-300 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-[var(--ink)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)] group-hover:text-indigo-600 transition-colors">
                          <s.icon size={16} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{s.desc}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 min-h-[30px] min-w-[32px] rounded-lg bg-slate-100 border border-[var(--line)] text-slate-700 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center shadow-inner">
                          {s.key}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {hasSpeedDials && (
                <div>
                  <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Zap size={14} className="text-indigo-400" />
                    Configured Speed Dials
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(speedDials).map(([key, tabId]) => {
                      const tab = ALL_TOOLS.find(t => t.id === tabId);
                      return (
                        <div 
                          key={key}
                          className="flex items-center justify-between p-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 font-black">
                              {(((tab as typeof tab & { name?: string })?.label?.[language] || (tab as typeof tab & { name?: string })?.label?.['en']) || (tab as typeof tab & { name?: string })?.name || tabId).charAt(0)}
                            </div>
                            <span className="text-sm font-semibold text-[var(--text)]">
                              {tab ? (((tab as typeof tab & { name?: string }).label?.[language] || (tab as typeof tab & { name?: string }).label?.['en']) || (tab as typeof tab & { name?: string }).name || tab.id) : tabId}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 min-h-[30px] min-w-[32px] rounded-lg bg-[var(--surface)] border border-indigo-200 text-indigo-700 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center shadow-sm">
                              ⌥ + {key.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 md:p-6 bg-slate-900 text-center shrink-0">
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
