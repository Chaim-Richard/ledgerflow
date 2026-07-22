import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  History,
  Filter,
  BarChart3,
  Zap,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { IntentResolver } from '../../lib/intentResolver';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface AICommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onFilter: (criteria: any) => void;
  businessContext: string;
}

export default function AICommandCenter({ isOpen, onClose, onFilter, businessContext }: AICommandCenterProps) {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const { accounts, transactions } = useLedgerStore.getState();
      const criteria = IntentResolver.resolve(
        query, 
        accounts.map(a => a.name), 
        transactions.map(t => t.project).filter((v, i, a) => v && a.indexOf(v) === i) as string[]
      );
      
      const filter: any = {};
      if (criteria.category) filter.category = criteria.category;
      if (criteria.project) filter.project = criteria.project;
      if (criteria.minAmountCents !== undefined) filter.minAmount = criteria.minAmountCents / 100;
      if (criteria.maxAmountCents !== undefined) filter.maxAmount = criteria.maxAmountCents / 100;
      if (criteria.startDate) filter.startDate = criteria.startDate;
      if (criteria.endDate) filter.endDate = criteria.endDate;
      
      onFilter(filter);
      setHistory(prev => [query, ...prev.slice(0, 4)]);
      toast.success("Query Processing Complete", {
        description: `Applied filters based on: "${query}"`
      });
      onClose();
      setQuery('');
    } catch (error) {
      console.error("Command error:", error);
      toast.error("Analytical Processing Failed");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] flex items-start justify-center pt-32 px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--ink)]/60 backdrop-blur-2xl"
      />
      
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        className="relative w-full max-w-4xl bg-[var(--panel)] rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden p-2"
      >
        <div className="bg-[var(--ink)] rounded-xl p-4 md:p-10 text-[var(--panel)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] pointer-events-none" />
          
          <form onSubmit={handleSubmit} className="mb-10 relative z-10">
            <div className="flex items-center gap-6 border-b border-white/5 pb-8 mb-8">
               <div className={cn(
                 "p-4 bg-[var(--surface)]/5 rounded-xl transition-all",
                 isProcessing ? "text-indigo-500 animate-spin" : "text-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
               )}>
                 <Sparkles size={32} />
               </div>
               <div className="flex-1">
                 <input 
                   ref={inputRef}
                   type="text" 
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   placeholder="Enter Natural Language Query..."
                   className="w-full bg-transparent border-none text-2xl md:text-4xl font-black tracking-tighter focus:outline-none placeholder:text-[var(--panel)]/20 font-display text-[var(--panel)]"
                 />
                 <div className="flex items-center gap-3 mt-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.8)]" />
                   <span className="text-[9px] font-black text-[var(--panel)]/40 uppercase tracking-widest truncate">Analytical Engine Active</span>
                 </div>
               </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                type="submit"
                disabled={!query.trim() || isProcessing}
                className="px-8 h-14 bg-indigo-600 text-[var(--panel)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-20 flex items-center gap-3 shadow-[0_15px_30px_-10px_rgba(79,70,229,0.4)]"
              >
                {isProcessing ? "Processing..." : "Run Analysis"}
                <Zap size={14} />
              </button>
              <div className="h-10 w-px bg-[var(--surface)]/10 mx-4" />
              <div className="flex items-center gap-6">
                 <button className="text-[10px] font-black text-[var(--panel)]/40 hover:text-indigo-400 uppercase tracking-widest transition-colors">Compare Period</button>
                 <button className="text-[10px] font-black text-[var(--panel)]/40 hover:text-indigo-400 uppercase tracking-widest transition-colors">Anomaly Sweep</button>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-2 gap-10 relative z-10">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-[var(--panel)]/20 uppercase tracking-widest truncate">Command History</h4>
              <div className="space-y-3">
                {history.length > 0 ? history.map((h, i) => (
                  <button 
                    key={i}
                    onClick={() => { setQuery(h); handleSubmit(); }}
                    className="w-full text-left p-4 rounded-xl bg-[var(--surface)]/5 border border-white/5 hover:bg-[var(--surface)]/10 transition-all flex items-center justify-between group"
                  >
                    <span className="text-xs font-bold text-[var(--panel)]/60 group-hover:text-[var(--panel)] transition-colors">{h}</span>
                    <History size={14} className="text-[var(--panel)]/20" />
                  </button>
                )) : (
                  <p className="text-[11px] font-bold text-[var(--panel)]/20 italic">No previous executions detected.</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
               <h4 className="text-[10px] font-black text-[var(--panel)]/20 uppercase tracking-widest truncate">System Shortcuts</h4>
               <div className="grid grid-cols-1 gap-3">
                 {[
                   { label: "Analyze High-Value Outflow", icon: AlertCircle, color: 'text-rose-400' },
                   { label: "Reconcile Missing Metadata", icon: Filter, color: 'text-amber-400' },
                   { label: "Predict Q3 Growth Matrix", icon: BarChart3, color: 'text-emerald-400' }
                 ].map((item, i) => (
                   <button key={i} className="flex items-center justify-between p-4 bg-[var(--surface)]/5 rounded-xl border border-white/5 hover:border-indigo-500/30 hover:bg-[var(--surface)]/10 transition-all group active:scale-95">
                     <div className="flex items-center gap-4">
                       <item.icon size={16} className={item.color} />
                       <span className="text-[10px] font-black text-[var(--panel)]/80 uppercase tracking-widest">{item.label}</span>
                     </div>
                     <ArrowRight size={14} className="text-[var(--panel)]/20 group-hover:text-indigo-400 transition-colors" />
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
