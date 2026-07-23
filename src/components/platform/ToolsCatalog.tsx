
import React, { useState } from 'react';
import { 
  Library, 
  Search, 
  CheckCircle2, 
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ToolSandbox from './ToolSandbox';
import { FINANCIAL_ALGORITHMS } from '../../lib/financial-algorithms';

const CATEGORIES = ['All', 'Compliance', 'Intelligence', 'Automation', 'Planning', 'Valuation', 'Operations', 'Finance'];

const getCategoryForAlgo = (algo: any): string => {
  const domain = (algo.domain || '').toLowerCase();
  if (domain === 'forensics') return 'Compliance';
  if (domain === 'planning') return 'Planning';
  if (domain === 'valuation') return 'Valuation';
  if (domain === 'ease') return 'Automation';
  if (domain === 'recon') return 'Compliance';
  if (domain === 'ops') return 'Operations';
  if (algo.tags && algo.tags.length > 0) {
    if (algo.tags.includes('Audit') || algo.tags.includes('Compliance')) return 'Compliance';
    if (algo.tags.includes('AI') || algo.tags.includes('Pattern')) return 'Intelligence';
    if (algo.tags.includes('Automation')) return 'Automation';
    if (algo.tags.includes('Forecasting') || algo.tags.includes('Cash')) return 'Planning';
  }
  return 'Finance';
};

const TOOLS = Object.values(FINANCIAL_ALGORITHMS).map((algo: any) => ({
  id: algo.id,
  name: algo.name,
  desc: algo.description,
  cat: getCategoryForAlgo(algo),
  implemented: true,
  icon: Zap
}));

export default function ToolsCatalog() {
  const [activeCat, setActiveCat] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSandbox, setActiveSandbox] = useState<{ id: string, name: string } | null>(null);

  const filteredTools = TOOLS.filter(t => 
    (activeCat === 'All' || t.cat === activeCat) &&
    (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.desc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-[var(--ink)] p-4 md:p-10 overflow-hidden">
       <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-12">
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

       <div className="flex gap-2.5 mb-8 overflow-x-auto pb-2 custom-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
                activeCat === cat ? "bg-[var(--brass)] text-black shadow-md font-bold" : "bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] hover:border-[var(--brass-line)] hover:text-[var(--text)]"
              )}
            >
              {cat}
            </button>
          ))}
       </div>

       <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
             {filteredTools.map((tool, idx) => (
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
                   "google-card p-10 bg-[var(--surface)] border-[var(--line)] transition-all group flex flex-col justify-between relative",
                   tool.implemented ? "cursor-pointer hover:border-slate-800 hover:shadow-lg hover:-translate-y-1" : "opacity-80 grayscale-[0.5]"
                 )}
               >
                  {!tool.implemented && (
                    <div className="absolute top-6 right-6">
                       <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[8px] font-medium uppercase tracking-wider">Backlog</span>
                    </div>
                  )}
                  {tool.implemented && (
                    <div className="absolute top-6 right-6">
                       <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                  )}

                  <div className="space-y-6">
                     <div className="w-11 h-11 bg-[var(--ink)] rounded-xl flex items-center justify-center text-[var(--text)] border border-[var(--line)] group-hover:bg-[var(--brass)] group-hover:text-black transition-all">
                        <tool.icon size={22} />
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-[var(--text)] tracking-tight uppercase mb-2 leading-tight">{tool.name}</h3>
                        <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-3">{tool.cat}</p>
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
             ))}

             {/* End of results */}
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
