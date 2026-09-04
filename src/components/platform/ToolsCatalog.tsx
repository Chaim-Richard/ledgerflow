
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
  const tags = (algo.tags || []).map(t => t.toLowerCase());
  const domain = (algo.domain || '').toLowerCase();
  const name = (algo.name || '').toLowerCase();

  // 1. Tax time
  if (
    ['1099-totals', '1099_totals', 'sales-tax-liability', 'sales_tax_liability', 'tax_deduction_scanner', 'tax-deduction-scanner', 'niche_3', 'fixed_asset_amortizer', '3', 'tax_set_aside'].includes(id) ||
    tags.some(t => t.includes('tax') || t.includes('1099')) ||
    name.includes('1099') || name.includes('sales tax')
  ) {
    return "Tax time";
  }

  // 2. Something's wrong (Forensics, Audit, Anomalies, Duplicates, Policy Violations)
  if (
    ['find-my-error', 'find_my_error', 'forensics_duplicates', 'forensics_anomaly', 'forensics_anomaly_detection', 'benfords_law', 'forensics_benford', 'category_consistency', 'forensics_categorization_consistency', 'policy_violator', 'forensics_policy', 'duplicate-detection', 'anomaly-detection', 'category-consistency', 'localized_forensics', 'moat_1'].includes(id) ||
    domain === 'forensics' ||
    tags.some(t => t.includes('fraud') || t.includes('outlier') || t.includes('anomaly'))
  ) {
    return "Something's wrong";
  }
  
  // 3. It's month-end (Reconciliation, General Ledger, Payroll, Close, Working Capital / Aging)
  if (
    ['gl-detail', 'payroll-summary', 'working_capital_aging', 'working-capital-aging', 'ops_2', 'ops_6', 'subset_sum_recon', 'recon_1', 'silent_micro_close', 'bank-rec-summary', 'continuous-close', 'continuous_close', 'moat_2'].includes(id) ||
    name.includes('general ledger') || name.includes('payroll') || name.includes('close') || name.includes('reconciliation')
  ) {
    return "It's month-end";
  }

  // 4. Can I afford it (Runway, Burn, Budget vs Actual, Monte Carlo, Solvency, Liquidity, CCC, Capital Budgeting)
  if (
    ['budget-vs-actual', 'runway_burn', 'cash-runway', 'planning_runway', 'planning_3', 'monte_carlo', 'monte-carlo', 'planning_4', 'wacc_capital', 'capital-budgeting', 'valuation_1', 'liquidity_stress', 'liquidity-stress', 'planning_5', 'altman-z-score', 'valuation_2', 'cash-conversion-cycle', 'ops_1', 'interest-rate-sensitivity', 'treasury_2', 'currency-exposure', 'treasury_1', 'valuation_3', 'niche_1'].includes(id) ||
    name.includes('budget') || name.includes('runway') || name.includes('solvency') || name.includes('liquidity') || name.includes('wacc')
  ) {
    return "Can I afford it";
  }

  // 5. Set me up (Auto setup, Rule induction, NL entry grammar, Inference, Token weighting, Setup)
  if (
    ['zero_setup_books', 'auto_setup', 'ease_1', 'rule_induction', 'ops_3', 'rule-induction', 'cross_dimension_autofill', 'cross-dimension-inference', 'moat_3', 'nl_entry_grammar', 'nl_parser', 'nl-parser', 'ease_2', 'shared-transaction-identity', 'shared_transaction_identity', 'moat_4', 'receipt_capture', 'ease_4', 'tf_idf', 'tf_idf_matching', 'system_1', 'fenwick_time_travel', '1', 'dimensional_ledger', '2'].includes(id) ||
    domain === 'system' ||
    name.includes('setup') || name.includes('induction')
  ) {
    return "Set me up";
  }

  // 6. Where's the money going (Concentration, Profitability, Expense velocity, Churn, Subscriptions)
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
