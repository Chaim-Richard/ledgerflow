import type { Transaction, ChartAccount } from '../../types';
import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { categoryChoices } from '../../lib/accountChoices';
import { motion } from 'motion/react';
import { Clipboard, X } from 'lucide-react';

interface SelectionBarProps {
  selectedCount: number;
  totalAmount: number;
  avgAmount: number;
  onCopy: () => void;
  onClear: () => void;
  onBulkUpdate: (updates: Partial<Transaction> & { accountId?: string }) => void;
  accounts: ChartAccount[];
  formatCurrency: (cents: number) => string;
}

export default function SelectionBar({ 
  selectedCount, 
  totalAmount, 
  onCopy, 
  onClear,
  onBulkUpdate,
  accounts,
  formatCurrency
}: SelectionBarProps) {
  // categories only (no bank accounts), the most used first; applied on Enter or Apply, never while typing
  const choices = useLedgerStore(state => categoryChoices(accounts, state.transactions));
  const [text, setText] = useState('');
  const typed = text.trim().toLowerCase();
  const pick = choices.find(c => c.label.toLowerCase() === typed || c.value === text)
    || choices.find(c => accounts.find(a => a.id === c.value)?.name.toLowerCase() === typed);
  const match = pick ? accounts.find(a => a.id === pick.value) : undefined;
  const apply = () => { if (match) { onBulkUpdate({ accountId: match.id }); setText(''); } };
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
          <span className="text-sm font-black font-mono tabular-nums">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <input aria-label="Bulk Categorize"
            list="selection-bulk-account"
            placeholder="Bulk Categorize..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
            className="w-48 bg-zinc-800 text-[10px] font-medium uppercase tracking-wider px-4 py-2.5 rounded-xl border-none outline-none text-zinc-400 hover:text-white transition-all focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
          />
          <datalist id="selection-bulk-account">
            {choices.map(c => (
              <option key={c.value} value={c.label} />
            ))}
          </datalist>
        </div>
        <button type="button" onClick={apply} disabled={!match}
          className="px-3 py-2 rounded-xl bg-indigo-600 text-[10px] font-bold uppercase tracking-wider disabled:opacity-30">
          Apply
        </button>
        
        <button type="button" aria-label="Copy Text" onClick={onCopy} className="p-2.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors" title="Copy Text">
          <Clipboard aria-hidden="true" size={16} />
        </button>
        <button type="button" aria-label="Clear Selection" onClick={onClear} className="p-2.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors ml-2" title="Clear Selection">
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </motion.div>
  );
}
