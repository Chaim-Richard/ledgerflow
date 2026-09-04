
import React, { useState, useEffect } from 'react';
import { 
  Library, 
  Search, 
  CheckCircle2, 
  Zap,
  Star,
  Flame,
  ArrowRight,
  AlertTriangle,
  CalendarCheck,
  TrendingDown,
  PiggyBank,
  Landmark,
  Wrench,
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ToolSandbox from './ToolSandbox';
import { FINANCIAL_ALGORITHMS } from '../../lib/financial-algorithms';
import { useAuthStore } from '../../stores/useAuthStore';
import { AlgorithmDefinition } from '../../lib/algorithms/types';

const CATEGORIES = [
  'All', 
  'Speed Dial', 
  "Something's wrong", 
  "It's month-end", 
  "Where's the money going", 
  "Can I afford it", 
  "Tax time", 
  "Set me up"
];

const getMomentGroup = (algo: AlgorithmDefinition): string => {
  const id = algo.id;
  const tags = algo.tags || [];
  
  if (['find-my-error', 'forensics_duplicates', 'forensics_anomaly', 'benfords_law', 'category_consistency', 'policy_violator', 'duplicate-detection', 'anomaly-detection', 'category-consistency'].includes(id) || tags.includes('Audit')) {
    return "Something's wrong";
  }
  
  if (['working_capital_aging', 'working-capital-aging', 'subset_sum_recon', 'silent_micro_close', 'bank-rec-summary', 'gl-detail', 'continuous-close'].includes(id)) {
    return "It's month-end";
  }

  if (['pareto_concentration', 'pareto-analysis', 'profitability_heatmap', 'profitability-heatmap', 'expense_velocity', 'expense-velocity', 'vendor_concentration', 'vendor-concentration', 'job_profitability', 'subscription_audit', 'saas-unit-economics', 'customer-churn', 'vendor-churn'].includes(id)) {
    return "Where's the money going";
  }

  if (['runway_burn', 'cash-runway', 'monte_carlo', 'monte-carlo', 'virtual_tax_envelopes', 'wacc_capital', 'capital-budgeting', 'liquidity_stress', 'liquidity-stress', 'altman-z-score', 'cash-conversion-cycle', 'interest-rate-sensitivity', 'currency-exposure'].includes(id)) {
    return "Can I afford it";
  }

  if (['tax_deduction_scanner', 'fixed_asset_amortizer', '1099_totals', 'sales_tax_liability', 'tax-deduction-scanner', 'auto-setup'].includes(id)) {
    return "Tax time";
  }

  if (['zero_setup_books', 'rule_induction', 'cross_dimension_autofill', 'tf_idf', 'nl_entry_grammar', 'cross-dimension-inference', 'rule-induction', 'nl-parser', 'shared-transaction-identity'].includes(id)) {
    return "Set me up";
  }

  return "Where's the money going"; // Default fallback
};

const getIconForGroup = (group: string) => {
  switch (group) {
    case "Something's wrong": return AlertTriangle;
    case "It's month-end": return CalendarCheck;
    case "Where's the money going": return TrendingDown;
    case "Can I afford it": return PiggyBank;
    case "Tax time": return Landmark;
    case "Set me up": return Wrench;
    default: return Activity;
  }
};

const TOOLS = Object.values(FINANCIAL_ALGORITHMS).map((algo: any) => {
  const group = getMomentGroup(algo);
  return {
    id: algo.id,
    name: algo.name,
    desc: algo.description,
    cat: group,
    implemented: true,
    requires: algo.requires || [],
    icon: getIconForGroup(group)
  };
});

const DEFAULT_SPEED_DIAL = ['duplicate-detection', 'anomaly-detection', 'benfords-law', 'working-capital-aging'];

export default function ToolsCatalog() {
  const [activeCat, setActiveCat] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSandbox, setActiveSandbox] = useState<{ id: string, name: string } | null>(null);

  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const workspaces = useAuthStore(s => s.workspaces);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const businessType = currentWorkspace?.businessType || 'services';

  const [speedDialIds, setSpeedDialIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ledgerflow_speed_dial_tools');
      return saved ? JSON.parse(saved) : DEFAULT_SPEED_DIAL;
    } catch {
      return DEFAULT_SPEED_DIAL;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ledgerflow_speed_dial_tools', JSON.stringify(speedDialIds));
    } catch (e) {
      console.error(e);
    }
  }, [speedDialIds]);

  const toggleSpeedDial = (e: React.MouseEvent, toolId: string) => {
    e.stopPropagation();
    setSpeedDialIds(prev => 
      prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
    );
  };

  const speedDialTools = TOOLS.filter(t => speedDialIds.includes(t.id));

  // Determine relevance based on businessType. This is a simple heuristic for sorting.
  const isRelevant = (toolId: string) => {
    if (businessType === 'saas' && toolId.includes('saas')) return true;
    if (businessType === 'ecommerce' && toolId.includes('inventory')) return true;
    if (businessType === 'real-estate' && toolId.includes('property')) return true;
    if (businessType === 'freelance' && toolId.includes('1099')) return true;
    return false; // Default: not boosted
  };

  const filteredTools = TOOLS.filter(t => {
    const matchesCat = activeCat === 'All' 
      ? true 
      : activeCat === 'Speed Dial' 
        ? speedDialIds.includes(t.id) 
        : t.cat === activeCat;
    
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.desc.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  }).sort((a, b) => {
    // Sort relevant tools first
    const aRel = isRelevant(a.id) ? 1 : 0;
    const bRel = isRelevant(b.id) ? 1 : 0;
    if (aRel !== bRel) return bRel - aRel;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full bg-[var(--ink)] p-4 md:p-10 overflow-hidden">
       <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-8">
          <div className="space-y-4">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--brass)] rounded-xl flex items-center justify-center text-black shadow-lg">
                   <Library size={24} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase leading-none text-[var(--text)]">Tool Catalog</h1>
                  <p className="text-[11px] font-black text-[var(--muted)] uppercase tracking-widest truncate mt-3">Enterprise Financial Capabilities Suite</p>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="relative group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--text)] transition-colors" />
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Query capabilities..." 
                  className="w-full sm:w-80 h-11 pl-12 pr-6 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--text)] outline-none focus:border-[var(--brass-line)] transition-all shadow-sm"
                />
             </div>
          </div>
       </div>

       {/* SPEED DIAL PINNED BAR */}
       <div className="mb-8 bg-[var(--surface)] border border-[var(--brass-line)]/40 rounded-2xl p-4 md:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
               <Flame size={16} className="text-amber-500 fill-amber-500" />
               <h2 className="text-xs font-black uppercase tracking-wider text-[var(--text)]">Speed Dial Shortcuts</h2>
               <span className="text-[10px] font-mono font-bold text-[var(--muted)] px-2 py-0.5 bg-[var(--ink)] border border-[var(--line)] rounded-full">
                 {speedDialTools.length} pinned
               </span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--muted)]">Click ★ on any tool to pin/unpin</span>
          </div>

          {speedDialTools.length === 0 ? (
            <p className="text-xs text-[var(--muted)] italic py-2">No tools pinned to Speed Dial. Star your frequently used algorithms below for 1-click execution!</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
               {speedDialTools.map(tool => (
                 <button
                   key={`sd-${tool.id}`}
                   onClick={() => setActiveSandbox({ id: tool.id, name: tool.name })}
                   className="flex items-center gap-3 px-4 py-2.5 bg-[var(--ink)] hover:bg-[var(--brass)]/10 border border-[var(--line)] hover:border-[var(--brass)] rounded-xl text-left transition-all cursor-pointer group shrink-0"
                 >
                    <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-tight text-[var(--text)] group-hover:text-[var(--brass)] transition-colors whitespace-nowrap">{tool.name}</span>
                    <ArrowRight size={12} className="text-[var(--muted)] group-hover:text-[var(--brass)] group-hover:translate-x-0.5 transition-all" />
                 </button>
               ))}
            </div>
          )}
       </div>

       <div className="flex gap-2.5 mb-8 overflow-x-auto pb-2 custom-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-2",
                activeCat === cat ? "bg-[var(--brass)] text-black shadow-md font-bold" : "bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] hover:border-[var(--brass-line)] hover:text-[var(--text)]"
              )}
            >
              {cat === 'Speed Dial' && <Star size={12} className={activeCat === cat ? "fill-black" : "fill-amber-400 text-amber-400"} />}
              {cat}
            </button>
          ))}
       </div>

       <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
             {filteredTools.map((tool, idx) => {
               const isPinned = speedDialIds.includes(tool.id);
               return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  key={tool.id}
                  onClick={() => {
                    if (tool.implemented) {
                      setActiveSandbox({ id: tool.id, name: tool.name });
                    }
                  }}
                  className={cn(
                    "google-card p-8 md:p-10 bg-[var(--surface)] border-[var(--line)] transition-all group flex flex-col justify-between relative",
                    tool.implemented ? "cursor-pointer hover:border-slate-800 hover:shadow-lg hover:-translate-y-1" : "opacity-80 grayscale-[0.5]"
                  )}
                >
                   <div className="absolute top-6 right-6 flex items-center gap-2">
                      <button
                        onClick={(e) => toggleSpeedDial(e, tool.id)}
                        title={isPinned ? "Unpin from Speed Dial" : "Pin to Speed Dial"}
                        className="p-1.5 rounded-lg hover:bg-[var(--ink)] text-[var(--muted)] hover:text-amber-400 transition-all cursor-pointer"
                      >
                         <Star size={16} className={cn(isPinned ? "text-amber-400 fill-amber-400" : "text-[var(--muted)]")} />
                      </button>
                      {tool.implemented ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[8px] font-medium uppercase tracking-wider">Backlog</span>
                      )}
                   </div>

                   <div className="space-y-6">
                      <div className="w-11 h-11 bg-[var(--ink)] rounded-xl flex items-center justify-center text-[var(--text)] border border-[var(--line)] group-hover:bg-[var(--brass)] group-hover:text-black transition-all">
                         <tool.icon size={22} />
                      </div>
                      <div>
                         <h3 className="text-lg font-black text-[var(--text)] tracking-tight uppercase mb-2 leading-tight pr-12">{tool.name}</h3>
                         <div className="flex flex-wrap items-center gap-1.5 mb-3">
                            <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">{tool.cat}</span>
                            {tool.requires && tool.requires.length > 0 && (
                              <>
                                <span className="text-[var(--muted)] opacity-40 text-xs">•</span>
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-rose-900/30 bg-rose-500/10 text-rose-500">
                                  Needs {tool.requires.join(', ')}
                                </span>
                              </>
                            )}
                         </div>
                         <p className="text-xs font-medium text-[var(--muted)] leading-relaxed line-clamp-2">{tool.desc}</p>
                      </div>
                   </div>

                   <div className="mt-6 pt-6 border-t border-[var(--line)] flex items-center justify-between">
                      <button className={cn(
                        "flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all",
                        tool.implemented ? "text-[var(--text)] group-hover:text-[var(--brass)]" : "text-[var(--muted)] cursor-not-allowed"
                      )}>
                         {tool.implemented ? 'Open Mathematical Sandbox' : 'In Development'}
                         {tool.implemented && <Zap size={14} className="text-[var(--brass)]" />}
                      </button>
                   </div>
                </motion.div>
               );
             })}
          </div>

          <div className="mt-20 py-12 text-center border-t border-[var(--line)]/50">
             <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Listing {filteredTools.length} Active Financial Modules</p>
          </div>
       </div>

       <AnimatePresence>
          {activeSandbox && (
             <ToolSandbox 
                toolId={activeSandbox.id} 
                toolName={activeSandbox.name} 
                onClose={() => setActiveSandbox(null)} 
             />
          )}
       </AnimatePresence>
    </div>
  );
}
