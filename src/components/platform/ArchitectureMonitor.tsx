
import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Database, Layout, ShieldCheck, Activity, Brain, Settings, FileText, Component, Zap, GitCommit, Search, Code, Key } from 'lucide-react';
import { APP_TABS, SETTINGS_TABS_REGISTRY, REPORT_TABS_REGISTRY, INTELLIGENCE_TABS_REGISTRY, ANALYTICAL_LENSES_REGISTRY, DASHBOARD_KPI_REGISTRY, SYSTEM_COMMANDS } from '../../config/registry';

export default function ArchitectureMonitor({ layerStatus }: { layerStatus?: any[] }) {
  
  const structureNodes = useMemo(() => [
    {
      id: 'core_apps',
      name: 'Core Applications',
      count: APP_TABS.length,
      icon: Component,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      desc: 'Main operations and workflows'
    },
    {
      id: 'intelligence',
      name: 'Intelligence Engine',
      count: INTELLIGENCE_TABS_REGISTRY.length + ANALYTICAL_LENSES_REGISTRY.length,
      icon: Brain,
      color: 'text-fuchsia-600',
      bg: 'bg-fuchsia-50',
      border: 'border-fuchsia-100',
      desc: 'AI copilot & analytical lenses'
    },
    {
      id: 'reports',
      name: 'Reporting Suite',
      count: REPORT_TABS_REGISTRY.length,
      icon: FileText,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      desc: 'Financial & operational reports'
    },
    {
      id: 'settings',
      name: 'System Config',
      count: SETTINGS_TABS_REGISTRY.length,
      icon: Settings,
      color: 'text-slate-600',
      bg: 'bg-[var(--ink)]',
      border: 'border-[var(--line)]',
      desc: 'Platform & workspace settings'
    },
    {
      id: 'kpis',
      name: 'KPI Metrics',
      count: DASHBOARD_KPI_REGISTRY.length,
      icon: Activity,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      desc: 'Dynamic dashboard indicators'
    },
    {
      id: 'commands',
      name: 'Command Palette',
      count: SYSTEM_COMMANDS.length,
      icon: Zap,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      border: 'border-cyan-100',
      desc: 'Omni-search commands'
    }
  ], []);

  const totalModules = structureNodes.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="p-6 md:p-8 bg-[var(--ink)] rounded-[32px] border border-[var(--line)] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 md:p-8 z-20">
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 h-fit shadow-sm">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Architecture Stable</span>
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col items-center gap-8 pt-4">
        {/* Core State Engine */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900 pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 flex items-center justify-center mb-4">
                <Database size={28} />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1">State Machine</h4>
              <h3 className="text-xl font-bold text-white tracking-tight">Zustand Central Store</h3>
              <p className="text-xs text-slate-400 mt-2">Single source of integrity for UI state, Active Tools, and Global Data.</p>
            </div>
          </div>
        </motion.div>

        
        {/* Data Access Layer (DAL) */}
        <div className="w-px h-8 bg-gradient-to-b from-slate-300 to-slate-200 relative">
           <motion.div 
             animate={{ y: [0, 32] }}
             transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
             className="absolute top-0 -left-1 w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.6)]"
           />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="p-6 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex items-center justify-center mb-4 shadow-inner">
                <Database size={24} />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-1">Data Access Layer (DAL)</h4>
              <h3 className="text-lg font-bold text-[var(--text)] tracking-tight">Supabase (Postgres)</h3>
              <p className="text-xs text-slate-500 mt-2">Screens read through src/lib/db with row level security; live lists fetch only what changed.</p>
            </div>
          </div>
        </motion.div>

        {/* Data Flow Line 2 */}
  
        <div className="w-px h-12 bg-gradient-to-b from-slate-300 to-slate-200 relative">
           <motion.div 
             animate={{ y: [0, 48] }}
             transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
             className="absolute top-0 -left-1 w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.6)]"
           />
        </div>

        {/* Dynamic Registry Hub */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full bg-[var(--surface)] p-8 rounded-[32px] border border-[var(--line)] shadow-xl"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100">
                <GitCommit size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text)] tracking-tight">Dynamic Registry Hub</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{totalModules} Total Active Modules</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {structureNodes.map((node, i) => (
              <motion.div 
                key={node.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (i * 0.05) }}
                className="p-5 border border-[var(--line)] bg-[var(--ink)] rounded-2xl flex flex-col gap-3 hover:border-indigo-200 hover:bg-[var(--surface)] transition-all hover:shadow-md group"
              >
                <div className="flex items-center justify-between">
                  <div className={"w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm transition-colors " + node.bg + " " + node.color + " " + node.border}>
                    <node.icon size={18} />
                  </div>
                  <div className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--line)] rounded-full shadow-sm text-[10px] font-bold text-slate-700">
                    {node.count} Nodes
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-bold text-[var(--text)] tracking-tight">{node.name}</h5>
                  <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-snug">{node.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Extensibility Note */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl w-full"
        >
          <Code size={16} className="text-indigo-600" />
          <p className="text-xs font-medium text-indigo-900">
            <strong>Highly Extensible:</strong> Adding new features simply requires appending to the arrays in <code className="bg-[var(--surface)] px-1.5 py-0.5 rounded text-indigo-600 font-mono text-[10px] border border-indigo-200">src/config/registry.tsx</code>. The UI dynamically adapts.
          </p>
        </motion.div>

      </div>
    </div>
  );
}
