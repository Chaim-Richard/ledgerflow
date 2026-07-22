import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Command, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Transaction } from '../../types';

interface SystemSearchProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onNavigate: (view: string, details?: any) => void;
}

export const SystemSearch = ({ isOpen, onClose, transactions, onNavigate }: SystemSearchProps) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [isPerforming, setIsPerforming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const interpretCommand = (text: string) => {
    const q = text.toLowerCase();
    if (q.startsWith('add ') || q.startsWith('new ')) {
      return { type: 'action', label: `Create new entry: "${text.slice(4)}"`, action: () => onNavigate('dashboard', { action: 'quick-entry', initial: text.slice(4) }) };
    }
    if (q.includes('audit') || q.includes('check')) {
       return { type: 'view', label: 'Launch System Audit Review', action: () => onNavigate('audit') };
    }
    return null;
  };

  const smartCommand = interpretCommand(query);

  const results = query.trim().length > 1 ? transactions.filter(tx => 
     tx.description.toLowerCase().includes(query.toLowerCase()) ||
     tx.payee?.toLowerCase().includes(query.toLowerCase()) ||
     tx.totalAmountCents.toString().includes(query)
  ).slice(0, 8) : [];

  const commands = [
    { id: 'dash', label: 'Go to Management Dashboard', icon: Zap, action: () => onNavigate('dashboard') },
    { id: 'ledger', label: 'Open Transaction Ledger', icon: Zap, action: () => onNavigate('transactions') },
    { id: 'intel', label: 'Open Analysis Hub', icon: Zap, action: () => onNavigate('intelligence') },
    { id: 'inv', label: 'View Inventory', icon: Zap, action: () => onNavigate('inventory') },
  ].filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[var(--ink)]/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-[var(--surface)] rounded-xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] overflow-hidden"
          >
            <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center gap-6">
               <Search size={28} className="text-[var(--faint)] opacity-40" />
               <input 
                 ref={inputRef}
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 placeholder="Type command or search records..."
                 className="flex-1 bg-transparent border-none outline-none text-2xl font-black text-[var(--text)] uppercase tracking-tighter placeholder:text-[var(--faint)]/20"
               />
               <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ink)] rounded-xl border border-[var(--line)] text-[10px] font-black text-[var(--faint)] uppercase tracking-widest">
                  <Command size={14} />
                  K
               </div>
            </div>

            <div className="p-4 max-h-[60dvh] overflow-y-auto">
               {smartCommand && (
                 <button 
                   onClick={() => { smartCommand.action(); onClose(); }}
                   className="w-full mb-4 flex items-center justify-between p-6 bg-[var(--ink)] rounded-xl text-[var(--panel)] shadow-xl hover:scale-[1.01] transition-all group overflow-hidden relative"
                 >
                   <div className="flex items-center gap-4 relative z-10">
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                         <Zap size={18} />
                      </div>
                      <span className="text-lg font-black uppercase tracking-tight">{smartCommand.label}</span>
                   </div>
                   <kbd className="px-2 py-1 bg-[var(--surface)]/10 rounded-lg text-[9px] font-medium uppercase tracking-wider">ENTER</kbd>
                 </button>
               )}

               {query.trim().length === 0 && (
                 <div className="p-4 md:p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-[var(--ink)] rounded-xl flex items-center justify-center mx-auto text-indigo-600 border border-[var(--line)]">
                       <Zap size={28} className="animate-pulse" />
                    </div>
                    <p className="text-[10px] font-black text-[var(--faint)] uppercase tracking-[0.5em]">Search Active</p>
                 </div>
               )}

               <div className="space-y-2">
                 {commands.map(cmd => (
                   <button 
                     key={cmd.id}
                     onClick={() => { cmd.action(); onClose(); }}
                     className="w-full flex items-center justify-between p-6 hover:bg-[var(--ink)] rounded-xl transition-all group"
                   >
                     <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-[var(--ink)] text-emerald-400 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                           <cmd.icon size={22} />
                        </div>
                        <span className="text-xl font-black text-[var(--text)] uppercase tracking-tight">{cmd.label}</span>
                     </div>
                     <ArrowRight size={20} className="text-[var(--faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
                   </button>
                 ))}

                 {results.length > 0 && (
                   <div className="pt-8">
                     <p className="px-6 text-[10px] font-black text-[var(--faint)] uppercase tracking-widest truncate mb-4">Transaction Results</p>
                     {results.map(tx => (
                       <button 
                         key={tx.id}
                         onClick={() => { onNavigate('transactions', { selectedId: tx.id }); onClose(); }}
                         className="w-full flex items-center justify-between p-6 hover:bg-[var(--ink)] rounded-xl transition-all group"
                       >
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 bg-[var(--surface)] text-[var(--text)] rounded-xl flex items-center justify-center shadow-sm font-mono text-[10px] font-black">
                               DNA
                            </div>
                            <div className="text-left">
                               <p className="text-lg font-black text-[var(--text)] uppercase tracking-tight leading-tight">{tx.description}</p>
                               <p className="text-[10px] font-bold text-[var(--faint)] uppercase opacity-40">{tx.payee} • {tx.date}</p>
                            </div>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className={cn(
                              "text-lg font-black font-mono tracking-tighter",
                              tx.totalAmountCents >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {tx.totalAmountCents >= 0 ? '+' : ''}{(tx.totalAmountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </span>
                            <div className="flex items-center gap-1">
                               <ShieldCheck size={10} className="text-emerald-500" />
                               <span className="text-[8px] font-black uppercase text-emerald-500">Verified</span>
                            </div>
                         </div>
                       </button>
                     ))}
                   </div>
                 )}
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
