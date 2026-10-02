import React, { useState, useMemo } from 'react';
import { Network, Database, Cpu, Layers, ArrowRight, Waypoints, Code2, Blocks, Sparkles, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APP_TABS } from '../../config/registry';
import { FINANCIAL_ALGORITHMS } from '../../lib/financial-algorithms';

export default function ArchitectureViewer() {
  const [activeTab, setActiveTab] = useState<'topology' | 'modules' | 'algorithms' | 'data'>('topology');
  const [searchQuery, setSearchQuery] = useState('');

  const algorithmsList = Object.values(FINANCIAL_ALGORITHMS);
  
  const filteredAlgos = useMemo(() => {
    if (!searchQuery) return algorithmsList;
    return algorithmsList.filter((a: any) => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, algorithmsList]);

  const filteredModules = useMemo(() => {
    if (!searchQuery) return APP_TABS;
    return APP_TABS.filter((t: any) => 
      t.label.en.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="w-full p-8 max-w-[1600px] mx-auto h-full overflow-y-auto bg-[var(--ink)]/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-8 border-b border-[var(--line)]">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] flex items-center gap-3 tracking-tight">
            <Network aria-hidden="true" className="text-indigo-600 w-8 h-8" />
            System Architecture & Developer Hub
          </h1>
          <p className="text-[var(--muted)] mt-3 max-w-3xl text-sm leading-relaxed">
            A comprehensive, real-time map of the application's domain structure. This interface provides absolute clarity on <strong>data flow</strong>, <strong>active modules</strong>, and <strong>computational algorithms</strong> to ensure zero complexity creep when scaling or refactoring.
          </p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
          {['topology', 'modules', 'algorithms', 'data'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-[var(--surface)] text-indigo-700 shadow-sm ring-1 ring-slate-900/5' 
                  : 'text-[var(--muted)] hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TOPOLOGY MAP */}
        {activeTab === 'topology' && (
          <motion.div key="topology" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
            
            <div className="bg-[var(--surface)] p-10 rounded-[32px] border border-[var(--line)] shadow-xl shadow-slate-200/20">
              <h2 className="text-xl font-bold text-[var(--text)] mb-8 flex items-center gap-3">
                <Waypoints aria-hidden="true" className="text-indigo-500" />
                The Tripartite Data Flow
              </h2>
              
              <div className="relative flex flex-col lg:flex-row items-center justify-between gap-6">
                
                {/* Layer 1: Persistence */}
                <div className="w-full lg:w-1/3 bg-[var(--ink)] border-2 border-[var(--line)] rounded-[24px] p-6 text-center relative z-10 hover:border-indigo-300 transition-colors">
                  <Database aria-hidden="true" className="w-10 h-10 text-[var(--muted)] mx-auto mb-4" />
                  <h3 className="text-lg font-black text-[var(--text)] mb-2">Layer 1: Data Persistence</h3>
                  <p className="text-sm text-[var(--muted)] mb-4">Firebase Firestore & Auth</p>
                  <div className="inline-block px-4 py-2 bg-[var(--surface)] rounded-lg border border-[var(--line)] text-xs font-mono text-slate-600">
                    src/modules/firebase/
                  </div>
                </div>

                <ArrowRight aria-hidden="true" className="hidden lg:block w-8 h-8 text-indigo-300 flex-shrink-0" />

                {/* Layer 2: State */}
                <div className="w-full lg:w-1/3 bg-indigo-600 border-2 border-indigo-500 rounded-[24px] p-6 text-center relative z-10 shadow-lg shadow-indigo-600/20">
                  <Activity aria-hidden="true" className="w-10 h-10 text-indigo-200 mx-auto mb-4" />
                  <h3 className="text-lg font-black text-white mb-2">Layer 2: Local State (Integrity)</h3>
                  <p className="text-sm text-indigo-100 mb-4">Zustand Store (Transactions, Accounts)</p>
                  <div className="inline-block px-4 py-2 bg-indigo-700/50 rounded-lg border border-indigo-500 text-xs font-mono text-white">
                    src/stores/useLedgerStore.ts
                  </div>
                </div>

                <ArrowRight aria-hidden="true" className="hidden lg:block w-8 h-8 text-indigo-300 flex-shrink-0" />

                {/* Layer 3: Presentation */}
                <div className="w-full lg:w-1/3 space-y-4">
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-[24px] p-6 text-center hover:border-emerald-400 transition-colors">
                    <Cpu aria-hidden="true" className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                    <h3 className="font-bold text-[var(--text)] mb-1">Pure Algorithms</h3>
                    <div className="text-xs font-mono text-[var(--muted)]">src/lib/algorithms/</div>
                  </div>
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-[24px] p-6 text-center hover:border-amber-400 transition-colors">
                    <Layers aria-hidden="true" className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                    <h3 className="font-bold text-[var(--text)] mb-1">UI React Views</h3>
                    <div className="text-xs font-mono text-[var(--muted)]">src/components/</div>
                  </div>
                </div>

              </div>

              <div className="mt-10 bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                  <Sparkles aria-hidden="true" className="w-5 h-5 text-indigo-500" /> Golden Rule of Scalability
                </h4>
                <p className="text-indigo-800/80 text-sm leading-relaxed">
                  Views (Layer 3) and Algorithms (Layer 3) <strong>MUST NEVER</strong> fetch their own data or access Firebase directly. They must always receive <code>transactions</code> and <code>accounts</code> directly from the Zustand Store (Layer 2) or via function props. This guarantees absolute decoupling, infinite testability, and prevents state fragmentation.
                </p>
              </div>
            </div>

          </motion.div>
        )}

        {/* MODULES MAP */}
        {activeTab === 'modules' && (
          <motion.div key="modules" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-3">
                <Blocks aria-hidden="true" className="text-indigo-500" /> Active System Modules ({APP_TABS.length})
              </h2>
              <input aria-label="Search modules"
                type="text" 
                placeholder="Search modules..." 
                className="px-4 py-2 rounded-xl border border-[var(--line)] focus:ring-2 focus:ring-indigo-500 outline-none text-sm w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredModules.map((tab: any) => (
                <div key={tab.id} className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--line)] hover:border-indigo-300 hover:shadow-md transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--ink)] flex items-center justify-center text-[var(--muted)] group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      {tab.icon && <tab.icon size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--text)]">{tab.label.en}</h3>
                      <p className="text-xs text-[var(--muted)] mt-1 font-mono">{tab.id}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[var(--line)] flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)]">{tab.groupId}</span>
                    <span className="text-[10px] bg-slate-100 text-[var(--muted)] px-2 py-1 rounded font-mono">
                      src/components/...
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </motion.div>
        )}

        {/* ALGORITHMS MAP */}
        {activeTab === 'algorithms' && (
          <motion.div key="algorithms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-3">
                <Cpu aria-hidden="true" className="text-emerald-500" /> Pure Computational Algorithms ({algorithmsList.length})
              </h2>
              <input aria-label="Search algorithms"
                type="text" 
                placeholder="Search algorithms..." 
                className="px-4 py-2 rounded-xl border border-[var(--line)] focus:ring-2 focus:ring-emerald-500 outline-none text-sm w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100 mb-8 flex gap-4 items-start">
              <Code2 aria-hidden="true" className="text-emerald-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-emerald-900 mb-1">Algorithm Design Contract</h4>
                <p className="text-emerald-800/80 text-sm">
                  Every algorithm must be a pure function matching <code>(transactions, accounts, inputs) =&gt; {'{'} metrics, charts, insights {'}'}</code>. They are located in <code>src/lib/algorithms/</code> and registered in <code>index.ts</code>. Do NOT add UI components inside the algorithm files.
                </p>
              </div>
            </div>

            
            <div className="flex flex-col gap-8">
              {['finance', 'operations', 'forensics', 'planning', 'treasury', 'system', 'uncategorized'].map(domain => {
                const domainAlgos = filteredAlgos.filter((a: any) => (a.domain || 'uncategorized') === domain);
                if (domainAlgos.length === 0) return null;
                return (
                  <div key={domain} className="bg-[var(--ink)] p-6 rounded-2xl border border-[var(--line)]">
                    <h3 className="text-lg font-black text-[var(--text)] uppercase tracking-widest mb-6 flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      {domain} ({domainAlgos.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {domainAlgos.map((algo: any) => (
                        <div key={algo.id} className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--line)] hover:border-emerald-400 hover:shadow-lg transition-all flex flex-col h-full group">
                          <div className="flex-grow">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-[var(--text)] text-sm group-hover:text-emerald-700 transition-colors">{algo.name}</h3>
                              <span className="text-[10px] font-mono bg-slate-100 text-[var(--muted)] px-1.5 py-0.5 rounded">ID: {algo.id}</span>
                            </div>
                            <p className="text-xs text-[var(--muted)] mb-4">{algo.description}</p>
                            
                            {algo.tags && algo.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-4">
                                {algo.tags.map((tag: string) => (
                                  <span key={tag} className="px-1.5 py-0.5 bg-slate-100 text-[var(--muted)] text-[9px] rounded uppercase font-bold tracking-wider">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {algo.inputs && algo.inputs.length > 0 && (
                            <div className="mt-auto pt-3 border-t border-[var(--line)]">
                              <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Required Inputs</div>
                              <div className="flex flex-wrap gap-1.5">
                                {algo.inputs.map((input: any) => (
                                  <span key={input.key} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium border border-emerald-100">
                                    {input.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
