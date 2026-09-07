import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useState } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { Invoice, Customer, ChartAccount } from '../../types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AsyncButton from '../ui/AsyncButton';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: Partial<Invoice>) => void;
  customers: Customer[];
  accounts: ChartAccount[];
}

export default function InvoiceModal({ isOpen, onClose, onSave, customers = [], accounts = [] }: InvoiceModalProps) {
  // Ensure we have arrays even if props were passed as null
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(a => a?.type === 'income') : [];

  const [invoice, setInvoice] = useState<Partial<Invoice>>(() => ({
    number: `INV-${Date.now().toString().slice(-6)}`,
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
    amountCents: 0,
    totalCents: 0
  }));

  const [items, setItems] = useState<Array<{ id: string, description: string, quantity: number, rateCents: number, amountCents: number, accountId: string }>>([
    { id: crypto.randomUUID(), description: '', quantity: 1, rateCents: 0, amountCents: 0, accountId: '' }
  ]);

  const [memo, setMemo] = useState('');
  const [terms, setTerms] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  const total = items.reduce((sum, item) => sum + item.amountCents, 0);

  const handleAction = async (e: React.FormEvent, actionStatus: string) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!invoice.customerId) {
      toast.error('Please select a customer');
      return;
    }
    
    // Support file attachments (preview only)
    if (attachments.length > 0) {
      toast.success(`${attachments.length} file(s) attached`);
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...invoice,
        status: actionStatus as any,
        totalCents: total,
        amountCents: total,
        metadata: {
          memo,
          terms,
          emailSubject,
          emailBody,
          hasAttachments: attachments.length > 0
        }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => handleAction(e, invoice.status || 'pending');

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
          <div>
            <h3 className="text-2xl font-black text-[var(--text)] tracking-tight">Create New Invoice</h3>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Sales & Receivables</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400" title="Print Invoice">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </button>
            <button aria-label="Close" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"><X size={24} /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="micro-label">Customer</label>
              <div className="relative">
                <input 
                  required
                  list="invoice-customer-list"
                  value={invoice.customerName || invoice.customerId || ''}
                  onChange={(e) => {
                    const cust = safeCustomers.find(c => c.name === e.target.value || c.id === e.target.value);
                    setInvoice({ ...invoice, customerId: cust ? cust.id : `new-${crypto.randomUUID()}`, customerName: cust ? cust.name : e.target.value });
                  }}
                  placeholder="Type or select customer"
                  className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                />
                <datalist id="invoice-customer-list">
                  {safeCustomers.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
            </div>
            <div className="space-y-2">
              <label className="micro-label">Invoice Number</label>
              <input 
                type="text"
                required
                value={invoice.number}
                onChange={(e) => setInvoice({ ...invoice, number: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="micro-label">Status</label>
              <select 
                value={invoice.status}
                onChange={(e) => setInvoice({ ...invoice, status: e.target.value as any })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              >
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="micro-label">Invoice Type</label>
              <select 
                value={invoice.type || 'standard'}
                onChange={(e) => setInvoice({ ...invoice, type: e.target.value as any })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              >
                <option value="standard">Standard</option>
                <option value="recurring">Recurring</option>
                <option value="progress">Progress</option>
              </select>
            </div>
            
            {invoice.type === 'recurring' && (
               <div className="space-y-2">
                 <label className="micro-label">Recurring Interval</label>
                 <select 
                   value={invoice.recurringInterval || 'monthly'}
                   onChange={(e) => setInvoice({ ...invoice, recurringInterval: e.target.value as any })}
                   className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                 >
                   <option value="weekly">Weekly</option>
                   <option value="monthly">Monthly</option>
                   <option value="yearly">Yearly</option>
                 </select>
               </div>
            )}

            {invoice.type === 'progress' && (
               <div className="space-y-2">
                 <label className="micro-label">Progress Percentage (%)</label>
                 <input 
                   type="number"
                   min="0"
                   max="100"
                   value={invoice.progressPercentage || 0}
                   onChange={(e) => setInvoice({ ...invoice, progressPercentage: parseInt(e.target.value, 10) })}
                   className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                 />
               </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="micro-label">Invoice Date</label>
              <input 
                type="date"
                required
                value={invoice.date}
                onChange={(e) => setInvoice({ ...invoice, date: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="micro-label">Due Date</label>
              <input 
                type="date"
                required
                value={invoice.dueDate}
                onChange={(e) => setInvoice({ ...invoice, dueDate: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
             <div className="space-y-2">
               <label className="micro-label">Discount ($)</label>
               <input 
                 type="number" step="0.01" min="0" value={(invoice.discountCents || 0) / 100}
                 onChange={(e) => setInvoice({ ...invoice, discountCents: TruthEngine.parseAmountToCents(e.target.value || '0') })}
                 className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
               />
             </div>
             <div className="space-y-2">
               <label className="micro-label">Deposit ($)</label>
               <input 
                 type="number" step="0.01" min="0" value={(invoice.depositCents || 0) / 100}
                 onChange={(e) => setInvoice({ ...invoice, depositCents: TruthEngine.parseAmountToCents(e.target.value || '0') })}
                 className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
               />
             </div>
             <div className="space-y-2">
               <label className="micro-label">Retainage ($)</label>
               <input 
                 type="number" step="0.01" min="0" value={(invoice.retainageCents || 0) / 100}
                 onChange={(e) => setInvoice({ ...invoice, retainageCents: TruthEngine.parseAmountToCents(e.target.value || '0') })}
                 className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
               />
             </div>
             <div className="space-y-2">
                 <label className="micro-label">Milestone / Proj.</label>
                 <input 
                   type="text" value={invoice.milestone || ''}
                   onChange={(e) => setInvoice({ ...invoice, milestone: e.target.value })}
                   className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                 />
             </div>
             <div className="space-y-2">
                 <label className="micro-label">Tax Rate (%)</label>
                 <input 
                   type="number" step="0.001" min="0" max="100" value={invoice.taxRate || 0}
                   onChange={(e) => setInvoice({ ...invoice, taxRate: parseFloat(e.target.value || '0') })}
                   className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
                 />
             </div>
             <div className="space-y-2 flex flex-col justify-end pb-3">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={invoice.taxInclusive || false} onChange={e => setInvoice({ ...invoice, taxInclusive: e.target.checked })} className="w-5 h-5 rounded border-zinc-300 text-[var(--text)] focus:ring-zinc-900" />
                 <span className="text-sm font-bold text-zinc-700">Tax Inclusive</span>
               </label>
             </div>
             <div className="space-y-2">
                 <label className="micro-label">Currency</label>
                 <select 
                   value={invoice.currency || 'USD'}
                   onChange={(e) => setInvoice({ ...invoice, currency: e.target.value })}
                   className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                 >
                   <option value="USD">USD</option>
                   <option value="EUR">EUR</option>
                   <option value="GBP">GBP</option>
                 </select>
             </div>
             <div className="space-y-2">
                 <label className="micro-label">Exchange Rate</label>
                 <input 
                   type="number" step="0.0001" min="0.0001" value={invoice.exchangeRate || 1}
                   onChange={(e) => setInvoice({ ...invoice, exchangeRate: parseFloat(e.target.value || '1') })}
                   className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
                 />
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="micro-label">Line Items</h4>
              <button 
                type="button"
                onClick={() => setItems([...items, { id: crypto.randomUUID(), description: '', quantity: 1, rateCents: 0, amountCents: 0, accountId: '' }])}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-medium uppercase tracking-wider hover:bg-zinc-200 transition-all"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>
            
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 items-end bg-[var(--ink)] p-4 rounded-[32px] border border-[var(--line)]">
                  <div className="col-span-12 md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Description</label>
                    <input 
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].description = e.target.value;
                        setItems(newItems);
                      }}
                      placeholder="Service or Product"
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Qty</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...items];
                        const qty = parseFloat(e.target.value || '0');
                        newItems[idx].quantity = qty;
                        newItems[idx].amountCents = Math.round(qty * newItems[idx].rateCents);
                        setItems(newItems);
                      }}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Rate ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.rateCents / 100}
                      onChange={(e) => {
                        const newItems = [...items];
                        const rateCents = TruthEngine.parseAmountToCents(e.target.value || '0');
                        newItems[idx].rateCents = rateCents;
                        newItems[idx].amountCents = Math.round(newItems[idx].quantity * rateCents);
                        setItems(newItems);
                      }}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                    />
                  </div>
                  <div className="col-span-8 md:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Income Account</label>
                    <div className="relative">
                      <input 
                        list={`invoice-account-${idx}`}
                        value={safeAccounts.find(a => a.id === item.accountId)?.name || item.accountId || ''}
                        onChange={(e) => {
                          const acc = safeAccounts.find(a => a.name === e.target.value || a.id === e.target.value);
                          const newItems = [...items];
                          newItems[idx].accountId = acc ? acc.id : e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Type or select account"
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                      <datalist id={`invoice-account-${idx}`}>
                        {safeAccounts.map(a => <option key={a.id} value={a.name} />)}
                      </datalist>
                    </div>
                  </div>
                  <div className="col-span-3 md:col-span-1 space-y-1 flex flex-col justify-end">
                    <div className="px-2 py-2 text-right font-mono font-bold text-[var(--text)] border border-transparent">
                      {(item.amountCents / 100).toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1 pb-1">
                    <button 
                      type="button"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
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
                <label className="micro-label">Customer Memo</label>
                <textarea 
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Message to customer..."
                  className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none resize-none h-24"
                />
              </div>
              <div className="space-y-2">
                <label className="micro-label">Terms & Conditions</label>
                <textarea 
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Standard terms..."
                  className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none resize-none h-24 text-xs"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="micro-label">Email Subject</label>
                <input 
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Invoice from us"
                  className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="micro-label">Attachments</label>
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
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Amount</span>
            <span className="text-3xl font-black text-[var(--text)] font-mono">
              {(total / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 bg-[var(--surface)] border border-[var(--line)] text-zinc-600 rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-[var(--ink)] transition-all"
             aria-label="Cancel">
              Cancel
            </button>
            <AsyncButton 
              type="button"
              onClick={(e) => handleAction(e, 'draft')}
              loadingText="Saving..."
              className="px-6 py-3.5 bg-zinc-100 text-zinc-700 rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-zinc-200 transition-all flex items-center gap-2"
            >
              Save Draft
            </AsyncButton>
            <AsyncButton 
              type="submit"
              onClick={(e) => handleAction(e, 'pending')}
              loadingText="Saving..."
              className="px-6 py-3.5 bg-zinc-900 text-white rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-zinc-800 transition-all shadow-lg flex items-center gap-2"
            >
              <Save size={16} />
              Save & Close
            </AsyncButton>
            <AsyncButton 
              type="button"
              onClick={(e) => handleAction(e, 'sent')}
              loadingText="Sending..."
              className="px-6 py-3.5 bg-slate-900 text-white rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
            >
              Send Invoice
            </AsyncButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
