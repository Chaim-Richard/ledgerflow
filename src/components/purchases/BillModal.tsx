import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useState } from 'react';
import { X, Plus, Trash2, Save, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';
import { Bill, Vendor, ChartAccount } from '../../types';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: Partial<Bill>) => void;
  vendors: Vendor[];
  accounts: ChartAccount[];
}

export default function BillModal({ isOpen, onClose, onSave, vendors = [], accounts = [] }: BillModalProps) {
  // Ensure we have arrays even if props were passed as null
  const safeVendors = Array.isArray(vendors) ? vendors : [];
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(a => a?.type === 'expense') : [];

  const [bill, setBill] = useState<Partial<Bill>>(() => ({
    number: `BILL-${Date.now().toString().slice(-6)}`,
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
    amountCents: 0
  }));

  const [splits, setSplits] = useState<Array<{ amountCents: number, accountId: string, description: string }>>([
    { amountCents: 0, accountId: '', description: '' }
  ]);

  const [memo, setMemo] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const total = splits.reduce((sum, split) => sum + split.amountCents, 0);

  const handleAction = (e: React.FormEvent, actionStatus: string) => {
    e.preventDefault();
    if (!bill.vendorId) {
      toast.error('Please select a vendor');
      return;
    }

    if (attachments.length > 0) {
      toast.success(`${attachments.length} file(s) attached`);
    }

    onSave({
      ...bill,
      status: actionStatus as any,
      amountCents: total,
      splits,
      metadata: {
        memo,
        hasAttachments: attachments.length > 0
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => handleAction(e, bill.status || 'pending');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-[var(--surface)] rounded-[40px] shadow-2xl border border-[var(--line)] overflow-hidden flex flex-col max-h-[90dvh]"
      >
        <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-900 text-white rounded-[32px] flex items-center justify-center shadow-xl shadow-zinc-900/20">
              <CreditCard size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-[var(--text)] tracking-tight">Record New Bill</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Purchases & Payables</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="micro-label">Vendor</label>
              <select 
                required
                value={bill.vendorId || ''}
                onChange={(e) => {
                  const vend = safeVendors.find(v => v.id === e.target.value);
                  setBill({ ...bill, vendorId: e.target.value, vendorName: vend?.name });
                }}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              >
                <option value="">Select Vendor</option>
                {safeVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="micro-label">Bill Number</label>
              <input 
                type="text"
                required
                value={bill.number}
                onChange={(e) => setBill({ ...bill, number: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="micro-label">Status</label>
              <select 
                value={bill.status}
                onChange={(e) => setBill({ ...bill, status: e.target.value as any })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              >
                <option value="pending">Pending</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="micro-label">Bill Date</label>
              <input 
                type="date"
                required
                value={bill.date}
                onChange={(e) => setBill({ ...bill, date: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="micro-label">Due Date</label>
              <input 
                type="date"
                required
                value={bill.dueDate}
                onChange={(e) => setBill({ ...bill, dueDate: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="micro-label">Expense Allocation</h4>
              <button 
                type="button"
                onClick={() => setSplits([...splits, { amountCents: 0, accountId: '', description: '' }])}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-medium uppercase tracking-wider hover:bg-zinc-200 transition-all"
              >
                <Plus size={14} />
                Add Split
              </button>
            </div>
            
            <div className="space-y-3">
              {splits.map((split, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-4 items-end bg-[var(--ink)] p-4 rounded-[32px] border border-[var(--line)]">
                  <div className="col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Description</label>
                    <input 
                      type="text"
                      value={split.description}
                      onChange={(e) => {
                        const newSplits = [...splits];
                        newSplits[idx].description = e.target.value;
                        setSplits(newSplits);
                      }}
                      placeholder="What was this for?"
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Expense Account</label>
                    <select 
                      value={split.accountId}
                      onChange={(e) => {
                        const newSplits = [...splits];
                        newSplits[idx].accountId = e.target.value;
                        setSplits(newSplits);
                      }}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="">Select Account</option>
                      {safeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Amount ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={split.amountCents / 100}
                      onChange={(e) => {
                        const newSplits = [...splits];
                        newSplits[idx].amountCents = TruthEngine.parseAmountToCents(e.target.value || '0');
                        setSplits(newSplits);
                      }}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                    />
                  </div>
                  <div className="col-span-1 pb-1">
                    <button 
                      type="button"
                      onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                      className="p-2 text-zinc-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[var(--line)] pt-8 mt-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="micro-label">Internal Memo</label>
                <textarea 
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Notes about this bill..."
                  className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none resize-none h-24"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="micro-label">Attachments & Receipts</label>
                <div className="flex items-center gap-4">
                   <label className="cursor-pointer flex items-center justify-center w-full px-4 py-3 bg-[var(--ink)] border-2 border-dashed border-zinc-300 rounded-xl hover:bg-zinc-100 transition-colors">
                     <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select Files</span>
                     <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                   </label>
                </div>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                     {attachments.map((f, i) => (
                       <span key={i} className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-lg">{f.name}</span>
                     ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="p-4 md:p-8 border-t border-[var(--line)] bg-[var(--ink)]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Bill Amount</span>
            <span className="text-3xl font-black text-[var(--text)] font-mono">
              {(total / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 bg-[var(--surface)] border border-[var(--line)] text-zinc-600 rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-[var(--ink)] transition-all"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={(e) => handleAction(e, 'draft')}
              className="px-6 py-3.5 bg-zinc-100 text-zinc-700 rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-zinc-200 transition-all flex items-center gap-2"
            >
              Save Draft
            </button>
            <button 
              type="submit"
              onClick={(e) => handleAction(e, 'pending')}
              className="px-6 py-3.5 bg-zinc-900 text-white rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-zinc-800 transition-all shadow-lg flex items-center gap-2"
            >
              <Save size={16} />
              Save & Close
            </button>
            <button 
              type="button"
              onClick={(e) => handleAction(e, 'approved')}
              className="px-6 py-3.5 bg-emerald-600 text-white rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              Approve Bill
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
