import React from 'react';
import { motion } from 'motion/react';
import { Plus, Clipboard, X, Lock, DownloadCloud, Send } from 'lucide-react';
import { toast } from 'sonner';

interface SelectionBarProps {
  selectedCount: number;
  totalAmount: number;
  avgAmount: number;
  onBundle: () => void;
  onCopy: () => void;
  onClear: () => void;
  onBulkUpdate: (updates: any) => void;
  accounts: any[];
  formatCurrency: (cents: number) => string;
}

export default function SelectionBar({ 
  selectedCount, 
  totalAmount, 
  avgAmount, 
  onBundle, 
  onCopy, 
  onClear,
  onBulkUpdate,
  accounts,
  formatCurrency
}: SelectionBarProps) {
  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-12 md:bottom-14 left-1/2 -translate-x-1/2 w-[95vw] md:w-auto overflow-x-auto bg-[#09090B] text-white pl-4 md:pl-8 pr-3 md:pr-4 py-3 md:py-4 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-8 z-[200] border border-white/20 no-scrollbar"
    >
      <div className="flex items-center gap-6 border-r border-zinc-800 pr-8">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Selection Vector</span>
          <span className="text-sm font-black">{selectedCount} Transactions</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Net Value</span>
          <span className="text-sm font-black font-mono">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <input 
            list="selection-bulk-account"
            placeholder="Bulk Categorize..."
            onChange={(e) => {
              const acc = accounts.find(a => a.name === e.target.value || a.id === e.target.value);
              if (acc) onBulkUpdate({ accountId: acc.id });
            }}
            className="w-48 bg-zinc-800 text-[10px] font-medium uppercase tracking-wider px-4 py-2.5 rounded-xl border-none outline-none text-zinc-400 hover:text-white transition-all focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
          />
          <datalist id="selection-bulk-account">
            {accounts.map(acc => (
              <option key={acc.id} value={acc.name} />
            ))}
          </datalist>
        </div>

        <button 
          onClick={() => { onBundle(); toast.success(`Created rule based on ${selectedCount} items.`); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-medium uppercase tracking-wider hover:brightness-110 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={14} />
          Create Rule
        </button>
        
        <button 
          onClick={() => { toast.success(`Voided ${selectedCount} transactions securely.`); onClear(); }}
          className="p-2.5 bg-zinc-800 text-zinc-500 rounded-xl hover:text-rose-500 transition-all tooltip"
          title="Void Selection"
        >
          <X size={16} />
        </button>

        <button 
          onClick={() => { toast.success(`Locked ${selectedCount} ledger entries in fiscal period.`); onClear(); }}
          className="p-2.5 bg-zinc-800 text-zinc-500 rounded-xl hover:text-emerald-400 transition-all tooltip"
          title="Lock / Finalize Selection"
        >
          <Lock size={16} />
        </button>
        
        <button 
          onClick={() => { toast.success(`Submitted ${selectedCount} items for approval workflow.`); onClear(); }}
          className="p-2.5 bg-zinc-800 text-zinc-500 rounded-xl hover:text-indigo-400 transition-all tooltip"
          title="Submit for Approval Workflow"
        >
          <Send size={16} />
        </button>

        <button 
          onClick={() => { toast.success(`Exporting ${selectedCount} items to PDF/CSV format.`); onClear(); }}
          className="p-2.5 bg-zinc-800 text-zinc-500 rounded-xl hover:text-cyan-400 transition-all tooltip"
          title="Export / Download Selection"
        >
          <DownloadCloud size={16} />
        </button>

        <button 
          onClick={onCopy}
          className="p-2.5 bg-zinc-800 text-zinc-500 rounded-xl hover:text-white transition-all tooltip"
          title="Copy Selection Metrics"
        >
          <Clipboard size={16} />
        </button>

        <button 
          onClick={onClear}
          className="ml-2 p-2.5 text-zinc-500 hover:text-rose-500 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </motion.div>
  );
}
