import React, { Suspense } from 'react';
import { Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { SETTINGS_TABS_REGISTRY, SETTINGS_COMPONENTS } from '../../config/registry';
import { useUIStore } from '../../stores/useUIStore';
import { ViewErrorBoundary } from '../common/ViewErrorBoundary';

export default function Settings() {
  const language = useUIStore(state => state.language);
  const activeSubTab = useUIStore(state => state.activeSettingsTab || 'appearance');
  const setActiveSubTab = useUIStore(state => state.setActiveSettingsTab);

  const activeTabDef = SETTINGS_TABS_REGISTRY.find(t => t.id === activeSubTab);
  const ActiveComponent = activeTabDef ? SETTINGS_COMPONENTS[activeTabDef.componentName] : null;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 py-6 px-4 md:py-12 md:px-8">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 pb-12 border-b border-[var(--line)]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-[0.3em]">
            <Terminal size={12} />
            Precision Core v2.0
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-[var(--text)] tracking-tighter">Settings</h1>
          <p className="text-[var(--muted)] font-medium text-lg max-w-xl">
            Configure institutional rule bridges, developer integrations, and enterprise-grade security protocols.
          </p>
        </div>

        <div className="flex bg-[var(--surface)] p-1.5 rounded-[32px] border border-[var(--line)] overflow-x-auto custom-scrollbar whitespace-nowrap">
          {SETTINGS_TABS_REGISTRY.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-medium uppercase tracking-wider transition-all",
                activeSubTab === tab.id 
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm ring-1 ring-slate-200" 
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              <tab.icon size={14} />
              {((tab as any).label?.[language] || (tab as any).label?.['en']) || (tab as any).name || tab.id}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2 space-y-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSubTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-10"
            >
              {ActiveComponent && (
                <Suspense fallback={<div className="h-40 flex items-center justify-center font-bold text-[var(--muted)] uppercase tracking-widest text-xs">Loading module...</div>}>
                  <ViewErrorBoundary viewName={(activeTabDef as any)?.label?.en || activeSubTab}>
                    <ActiveComponent />
                  </ViewErrorBoundary>
                </Suspense>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Sidebar Documentation Context (Could also be modularized later) */}
        <div className="space-y-10">
          <div className="p-4 md:p-10 bg-[var(--surface)] rounded-[40px] border border-[var(--line)] shadow-sm group hover:border-indigo-600 transition-all duration-500">
            <h4 className="text-[11px] font-black text-[var(--text)] uppercase tracking-[0.3em] mb-6 opacity-40">Documentation Protocol</h4>
            <div className="space-y-4">
              <p className="text-[11px] text-[var(--muted)] leading-relaxed font-bold uppercase tracking-widest mb-8">
                The architecture runs entirely on dynamic topological registries. Settings components are lazy-loaded on demand via the SETTINGS_COMPONENTS registry mapping.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
