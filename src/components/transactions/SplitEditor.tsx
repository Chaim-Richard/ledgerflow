import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState } from 'react';
import { Transaction, TransactionLine, ChartAccount, Project } from '../../types';
import { Plus, Trash2, Save, X, AlertCircle, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';

interface SplitEditorProps {
  transaction: Transaction;
  accounts: ChartAccount[];
  projects: Project[];
  onSave: (lines: TransactionLine[]) => void;
  onClose: () => void;
}

export default function SplitEditor({
  transaction,
  accounts,
  projects,
  onSave,
  onClose
}: SplitEditorProps) {
  const [lines, setLines] = useState<TransactionLine[]>(
    transaction.lines?.length > 0 
      ? [...transaction.lines] 
      : [{ accountId: '', accountName: '', amountCents: transaction.totalAmountCents }]
  );

  const totalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const diff = transaction.totalAmountCents - totalCents;
  const isBalanced = diff === 0;

  const addLine = () => {
    setLines([...lines, { accountId: '', accountName: '', amountCents: diff > 0 ? diff : 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<TransactionLine>) => {
    const nextLines = [...lines];
    nextLines[index] = { ...nextLines[index], ...updates };
    
    // Auto-calculate amount if quantity and unitPrice are updated
    if (updates.quantity !== undefined || updates.unitPriceCents !== undefined) {
      const q = updates.quantity ?? nextLines[index].quantity ?? 1;
      const p = updates.unitPriceCents ?? nextLines[index].unitPriceCents ?? 0;
      nextLines[index].amountCents = Math.round(q * p);
    }
    
    setLines(nextLines);
  };

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-5xl bg-slate-50 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] border border-[#333537]"
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white/50">
          <div>
            <h3 className="text-xl font-medium text-slate-900 tracking-tight flex items-center gap-2">
               <Layers className="text-indigo-600" size={20} />
               Split Transaction Lines
            </h3>
            <p className="text-[10px] text-slate-500 mt-1 font-black uppercase tracking-[0.2em]">{transaction.description} • {new Intl.NumberFormat('en-US', { style: 'currency', currency: transaction.currency }).format(transaction.totalAmountCents / 100)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-slate-50">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[1fr_150px_150px_100px_40px] gap-4 px-2 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
              <div>Account / Item Description</div>
              <div>Quantity & Price</div>
              <div>Amount (Total)</div>
              <div className="text-right">Split %</div>
              <div></div>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={idx} className="space-y-2">
                <div className={cn(
                  "grid grid-cols-[1fr_150px_150px_100px_40px] gap-4 items-center p-3 rounded-[32px] border border-slate-200 transition-all group",
                  expandedIndex === idx ? "bg-slate-50/40 border-indigo-600" : "bg-white/30 hover:bg-slate-50/20"
                )}>
                  <div className="flex flex-col gap-1">
                    <select 
                      value={line.accountId}
                      onChange={(e) => {
                        const acc = accounts.find(a => a.id === e.target.value);
                        updateLine(idx, { accountId: e.target.value, accountName: acc?.name || '' });
                      }}
                      className="bg-transparent border-none outline-none font-bold text-sm text-slate-900 focus:text-indigo-600 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-slate-50">Select Account</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id} className="bg-slate-50">{acc.name} [{acc.code}]</option>
                      ))}
                    </select>
                    <input 
                      type="text"
                      placeholder="Line item description (e.g. Milk 2%)"
                      value={line.description || ''}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      className="bg-transparent border-none outline-none text-[11px] font-medium text-slate-500 focus:text-indigo-600 placeholder:text-slate-500/30"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      placeholder="Qty"
                      value={line.quantity || ''}
                      onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 1 })}
                      className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-center text-slate-500 focus:border-indigo-600 outline-none"
                    />
                    <span className="text-slate-500 text-[10px] font-black uppercase">×</span>
                    <input 
                      type="number"
                      placeholder="Price"
                      value={line.unitPriceCents ? line.unitPriceCents / 100 : ''}
                      onChange={(e) => updateLine(idx, { unitPriceCents: TruthEngine.parseAmountToCents(e.target.value || '0') })}
                      className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-right text-slate-500 focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs opacity-50">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={line.amountCents / 100}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value || '0');
                        updateLine(idx, { amountCents: Math.round(val * 100) });
                      }}
                      className="w-full pl-6 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-right text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
                    />
                  </div>

                  <div className="text-right font-mono text-[10px] font-black text-slate-500">
                    {((line.amountCents / (transaction.totalAmountCents || 1)) * 100).toFixed(1)}%
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        expandedIndex === idx ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <Layers size={14} />
                    </button>
                    <button 
                      onClick={() => removeLine(idx)}
                      className="text-slate-500 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all p-2 flex items-center justify-center hover:bg-rose-50/10 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {expandedIndex === idx && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="overflow-hidden border-x border-b border-slate-200 rounded-b-2xl mx-2 p-4 bg-slate-50/10 flex flex-col gap-4"
                  >
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dimension Attribution</label>
                        <select 
                          value={line.project || ''}
                          onChange={(e) => updateLine(idx, { project: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-500 focus:text-indigo-600 outline-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-50">No Project</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.name} className="bg-slate-50">{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-[0.5] space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Class</label>
                        <select 
                          value={line.class || ''}
                          onChange={(e) => updateLine(idx, { class: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-500 focus:text-indigo-600 outline-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-50">No Class</option>
                          {useLedgerStore.getState().classes?.map(c => <option key={c} value={c} className="bg-slate-50">{c}</option>)}
                        </select>
                      </div>
                      <div className="flex-[0.5] space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</label>
                        <select 
                          value={line.location || ''}
                          onChange={(e) => updateLine(idx, { location: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-500 focus:text-indigo-600 outline-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-50">No Location</option>
                          {useLedgerStore.getState().locations?.map(l => <option key={l} value={l} className="bg-slate-50">{l}</option>)}
                        </select>
                      </div>
                      <div className="flex-[2] space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                          Custom Labels / Tags
                          <span className="text-[9px] lowercase italic font-medium opacity-50">Separate by comma</span>
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. Organic, Office Supplies, High Priority"
                          value={line.tags?.join(', ') || ''}
                          onChange={(e) => updateLine(idx, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          <button 
            onClick={addLine}
            className="flex items-center gap-3 px-6 py-4 bg-white/50 hover:bg-slate-50/50 text-indigo-600 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] transition-all mt-6 w-full justify-center border border-dashed border-slate-200 group"
          >
            <Plus size={16} className="group-hover:scale-125 transition-transform" />
            Append Split Line
          </button>
          </div>
        </div>

        <div className="p-4 md:p-6 border-t border-slate-200 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-3 px-5 py-2.5 rounded-[32px] text-[10px] font-medium uppercase tracking-wider",
              isBalanced ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
            )}>
              {isBalanced ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Chain Balanced
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="animate-bounce" />
                  Discrepancy: {new Intl.NumberFormat('en-US', { style: 'currency', currency: transaction.currency }).format(diff / 100)}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onClose} 
              className="px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSave(lines)}
              disabled={!isBalanced || lines.some(l => !l.accountId)}
              className="btn-primary !px-10 flex items-center gap-3 disabled:opacity-30 disabled:grayscale transition-all shadow-[0_0_20px_rgba(26,115,232,0.2)]"
            >
              <Save size={18} />
              Commit Atomic Split
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
