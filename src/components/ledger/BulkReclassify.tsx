import React, { useState } from 'react';
import { ListFilter, RotateCcw, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { toast } from 'sonner';

export default function BulkReclassify() {
  const { transactions, setTransactions } = useLedgerStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState({ type: 'class', value: '' });

  const toggleAll = () => {
    if (selectedIds.size === transactions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(transactions.map(t => t.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleReclassify = () => {
    if (selectedIds.size === 0) {
      toast.error('No transactions selected.');
      return;
    }
    
    if (!batchAction.value.trim()) {
      toast.error('Please enter a target value.');
      return;
    }

    const value = batchAction.value.trim();
    const updatedTransactions = transactions.map(tx => {
      if (!selectedIds.has(tx.id)) return tx;
      
      const newLines = tx.lines.map(line => {
        if (batchAction.type === 'account') {
          return { ...line, accountName: value };
        } else if (batchAction.type === 'class') {
          return { ...line, class: value };
        } else if (batchAction.type === 'location') {
          return { ...line, location: value };
        } else if (batchAction.type === 'project') {
          return { ...line, project: value };
        }
        return line;
      });

      return { ...tx, lines: newLines };
    });

    setTransactions(updatedTransactions);
    toast.success(`Successfully reclassified ${selectedIds.size} transactions to ${value}.`);
    setSelectedIds(new Set());
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-[32px] bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
          <RotateCcw size={24} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">Batch Reclassify & Cleanup</h1>
          <p className="text-sm font-medium text-slate-500">Fix miscategorized items, correct project assignments, and mass-reclassify historical ledgers.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left: Action Canvas */}
        <div className="lg:w-80 shrink-0 space-y-6">
          <div className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Reclassification Vector</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Target Dimension</label>
                <select 
                  value={batchAction.type}
                  onChange={e => setBatchAction({...batchAction, type: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white transition-all font-bold text-sm"
                >
                  <option value="account">Base GL Account</option>
                  <option value="class">Class</option>
                  <option value="location">Location</option>
                  <option value="project">Project</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">New Value</label>
                <input 
                  type="text"
                  placeholder={`Set new ${batchAction.type}...`}
                  value={batchAction.value}
                  onChange={e => setBatchAction({...batchAction, value: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white transition-all font-bold text-sm"
                />
              </div>

              <button onClick={handleReclassify} className="w-full py-3.5 mt-2 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ledger-ink/10 flex items-center justify-center gap-2">
                <ArrowRightLeft size={16} /> Reclassify {selectedIds.size} Items
              </button>
            </div>
          </div>

          <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-[32px]">
            <div className="flex items-start gap-3 text-amber-700">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-xs uppercase tracking-widest">Audit Trail Warning</p>
                <p className="text-[11px] font-medium leading-relaxed opacity-90">Executing batch reclassifications will immutably modify historical ledger lines. All modifications are logged in the global audit trail.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Grid */}
        <div className="flex-1 bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/30">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{transactions.length} Candidate Transactions</span>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-sm flex items-center gap-2">
              <ListFilter size={14} /> Filter Uncategorized
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  <th className="p-4 w-12 text-center">
                    <input type="checkbox" checked={transactions.length > 0 && selectedIds.size === transactions.length} onChange={toggleAll} className="rounded border-zinc-300" />
                  </th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Account</th>
                  <th className="p-4">Class</th>
                  <th className="p-4">Location</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {transactions.slice(0, 50).map(tx => (
                  <tr key={tx.id} onClick={() => toggleOne(tx.id)} className={cn("hover:bg-slate-50/50 transition-colors cursor-pointer", selectedIds.has(tx.id) && "bg-indigo-600/5")}>
                    <td className="p-4 text-center">
                      <input type="checkbox" checked={selectedIds.has(tx.id)} readOnly className="rounded border-zinc-300 text-indigo-600" />
                    </td>
                    <td className="p-4 font-mono font-medium text-xs">{tx.date}</td>
                    <td className="p-4 font-bold text-slate-900 truncate max-w-[200px]">{tx.description}</td>
                    <td className="p-4 text-xs font-bold text-slate-500">{tx.lines[0]?.accountName}</td>
                    <td className="p-4 text-xs font-bold text-slate-500">{tx.lines[0]?.class || '-'}</td>
                    <td className="p-4 text-xs font-bold text-slate-500">{tx.lines[0]?.location || '-'}</td>
                    <td className="p-4 text-right font-mono font-bold">{formatCurrency((tx.totalAmountCents || 0) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
