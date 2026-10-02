import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, CreditCard, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Bill, Vendor, ChartAccount } from '../../types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getIdToken } from '../../firebase';
import AsyncButton from '../ui/AsyncButton';
import { evaluateApprovalRequirement } from '../../lib/approvalWorkflow';
import { addComment, getCommentsForEntity } from '../../lib/commentService';
import { documentTotals, taxCodeFromRate, TAX_TREATMENTS } from '../../lib/taxCodes';
import { formatCurrency } from '../../lib/utils';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: Partial<Bill>) => void;
  vendors: Vendor[];
  accounts: ChartAccount[];
  /** Pre-filled bill, e.g. from a purchase order (BE-11). */
  initialBill?: Partial<Bill>;
}

export default function BillModal({ isOpen, onClose, onSave, vendors = [], accounts = [], initialBill }: BillModalProps) {
  // Ensure we have arrays even if props were passed as null
  const safeVendors = Array.isArray(vendors) ? vendors : [];
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(a => a?.type === 'expense' || a?.type === 'cost_of_goods' || a?.type === 'asset') : [];
  
  const storeBills = useLedgerStore(s => s.bills) || [];
  const storeTransactions = useLedgerStore(s => s.transactions) || [];
  useLedgerCollections('bills');
  const [autofillNotice, setAutofillNotice] = useState<string | null>(null);

  const [bill, setBill] = useState<Partial<Bill>>(() => ({
    number: `BILL-${Date.now().toString().slice(-6)}`,
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
    amountCents: 0
  }));

  const editingExisting = Boolean(initialBill?.id);
  useEffect(() => {
    // an existing bill keeps its number; only a new one gets the next number in the series
    if (isOpen && !editingExisting) {
      const fetchNextNumber = async () => {
        try {
          const wsId = useAuthStore.getState().currentWorkspaceId;
          if (!wsId) return;
          const token = await getIdToken().catch(() => '');
          const res = await fetch(`/api/v1/workspaces/${wsId}/next-number`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ type: 'bill' })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.number) {
              setBill(prev => ({ ...prev, number: data.number }));
            }
          }
        } catch (e) {
          console.error('Failed to fetch next bill number', e);
        }
      };
      fetchNextNumber();
    }
  }, [isOpen, editingExisting]);

  const [splits, setSplits] = useState<Array<{ id: string, amountCents: number, accountId: string, description: string }>>([
    { id: crypto.randomUUID(), amountCents: 0, accountId: '', description: '' }
  ]);

  const [memo, setMemo] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [filledFrom, setFilledFrom] = useState<Partial<Bill> | undefined>(undefined);
  if (isOpen && initialBill && initialBill !== filledFrom) {
    // copy the pre-filled bill into the form once per opening (adjusting state during render)
    setFilledFrom(initialBill);
    const { splits: initialSplits, ...fields } = initialBill;
    setBill(prev => ({ ...prev, ...fields }));
    if (initialSplits?.length) setSplits(initialSplits.map(s => ({ id: crypto.randomUUID(), amountCents: s.amountCents, accountId: s.accountId || '', description: s.description || '' })));
  }

  const total = splits.reduce((sum, split) => sum + split.amountCents, 0);

  // Tax: a purchase tax code (Settings → Tax); reverse charge means the vendor charges none
  const taxRates = useLedgerStore(s => s.taxRates || []);
  const workspaceCurrency = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';
  const purchaseCodes = useMemo(() => taxRates.filter(r => r.type === 'Sales' && r.appliesTo !== 'sales').map(taxCodeFromRate), [taxRates]);
  const taxCode = purchaseCodes.find(c => c.id === bill.taxCodeId) || null;
  const pricesIncludeTax = bill.pricesIncludeTax ?? true;
  const totals = documentTotals(total, 0, taxCode, pricesIncludeTax);
  const money = (cents: number) => formatCurrency(cents, bill.currency || workspaceCurrency);

  const handleVendorSelect = (vendorId: string) => {
    const vend = safeVendors.find(v => v.id === vendorId);
    setBill(prev => ({ ...prev, vendorId, vendorName: vend?.name }));
    setAutofillNotice(null);

    if (!vendorId) return;

    // Look for last used account for this vendor from previous bills
    let foundAccountId = '';
    let foundDesc = '';

    const prevBill = storeBills.find(b => b.vendorId === vendorId && b.splits && b.splits.length > 0 && b.splits[0].accountId);
    if (prevBill && prevBill.splits?.[0]?.accountId) {
      foundAccountId = prevBill.splits[0].accountId;
      foundDesc = prevBill.splits[0].description || '';
    } else {
      // Look in transaction history
      const prevTx = storeTransactions.find(t => 
        (((t as any).vendorId === vendorId || (t.metadata as any)?.vendorId === vendorId) || (vend && t.description?.toLowerCase().includes(vend.name.toLowerCase()))) &&
        t.lines && t.lines.length > 0
      );
      if (prevTx && prevTx.lines) {
        const matchingLine = prevTx.lines.find(l => accounts.some(a => a.id === l.accountId && (a.type === 'expense' || a.type === 'cost_of_goods'))) || prevTx.lines[0];
        if (matchingLine) {
          foundAccountId = matchingLine.accountId;
          foundDesc = prevTx.description || '';
        }
      }
    }

    if (foundAccountId) {
      const targetAcc = accounts.find(a => a.id === foundAccountId);
      setSplits(prev => {
        const next = [...prev];
        if (next.length > 0) {
          next[0] = {
            ...next[0],
            accountId: foundAccountId,
            description: next[0].description || foundDesc || `${vend?.name || 'Vendor'} expense`
          };
        }
        return next;
      });
      if (targetAcc) {
        setAutofillNotice(`Auto-filled account: ${targetAcc.name}`);
        toast.info(`⚡ Auto-filled account "${targetAcc.name}" from previous ${vend?.name || 'vendor'} history.`);
      }
    }
  };

  const handleAction = async (e: React.FormEvent, actionStatus: string) => {
    e.preventDefault();
    if (!bill.vendorId) {
      toast.error('Please select a vendor');
      return;
    }

    if (attachments.length > 0) {
      toast.success(`${attachments.length} file(s) attached`);
    }

    const wsId = useAuthStore.getState().currentWorkspaceId || 'default';
    const userEmail = useAuthStore.getState().user?.email || 'user';
    const approval = evaluateApprovalRequirement(
      { ...bill, amountCents: total } as Bill,
      'bill',
      { id: 'rule_1', workspaceId: wsId, entityType: 'bill', thresholdCents: 500000, approverRoles: ['owner', 'accountant'], autoApproveBelowThreshold: true }
    );

    let finalStatus = actionStatus;
    if (approval.requiresApproval && actionStatus === 'approved') {
      finalStatus = 'pending';
      toast.info('Bill amount exceeds threshold ($5,000). Submitted for management approval.');
      addComment({
        workspaceId: wsId,
        entityType: 'bill',
        entityId: bill.number || 'bill_new',
        authorEmail: userEmail,
        comment: 'Bill held for dual approval threshold.'
      });
    }

    await onSave({
      ...bill,
      status: finalStatus as any,
      // the total owed (tax included) and the tax, explicitly (taxCodes.ts)
      amountCents: totals.amountCents,
      lineSumCents: totals.subtotalCents,
      taxAmountCents: totals.taxCents,
      taxInclusive: true,
      taxVersion: 2,
      pricesIncludeTax,
      taxCodeId: taxCode?.id,
      taxTreatment: taxCode?.treatment,
      taxBreakdown: totals.components,
      selfAssessedTaxCents: totals.selfAssessedCents || undefined,
      splits,
      metadata: {
        ...(bill.metadata || {}),
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
          <button aria-label="Close" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="bill-vendor" className="micro-label">Vendor</label>
                {autofillNotice && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                    <Sparkles size={10} /> Auto-filled
                  </span>
                )}
              </div>
              <select 
                id="bill-vendor"
                required
                value={bill.vendorId || ''}
                onChange={(e) => handleVendorSelect(e.target.value)}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              >
                <option value="">Select Vendor</option>
                {safeVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="bill-number" className="micro-label">Bill Number</label>
              <input 
                id="bill-number"
                type="text"
                required
                value={bill.number}
                onChange={(e) => setBill({ ...bill, number: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="bill-status" className="micro-label">Status</label>
              <select 
                id="bill-status"
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
              <label htmlFor="bill-date" className="micro-label">Bill Date</label>
              <input 
                id="bill-date"
                type="date"
                required
                value={bill.date}
                onChange={(e) => setBill({ ...bill, date: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="bill-due-date" className="micro-label">Due Date</label>
              <input 
                id="bill-due-date"
                type="date"
                required
                value={bill.dueDate}
                onChange={(e) => setBill({ ...bill, dueDate: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="bill-tax-code" className="micro-label">Tax</label>
              <select id="bill-tax-code" value={bill.taxCodeId || ''} onChange={(e) => setBill({ ...bill, taxCodeId: e.target.value || undefined })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] outline-none font-bold">
                <option value="">No tax</option>
                {purchaseCodes.map(c => <option key={c.id} value={c.id}>{c.name}{c.treatment !== 'standard' ? ` (${TAX_TREATMENTS[c.treatment]})` : ''}</option>)}
              </select>
              {purchaseCodes.length === 0 && <p className="text-[11px] text-[var(--muted)]">Add tax codes in Taxes.</p>}
            </div>
            <div className="space-y-2 flex flex-col justify-end pb-3">
              <label htmlFor="bill-prices-include-tax" className="flex items-center gap-2 cursor-pointer">
                <input id="bill-prices-include-tax" type="checkbox" checked={pricesIncludeTax} onChange={e => setBill({ ...bill, pricesIncludeTax: e.target.checked })} className="w-5 h-5 rounded" />
                <span className="text-sm font-bold text-[var(--text)]">Amounts include tax (as on the vendor's bill)</span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="micro-label">Expense Allocation</h4>
              <button 
                type="button"
                aria-label="Add Split Expense"
                onClick={() => setSplits([...splits, { id: crypto.randomUUID(), amountCents: 0, accountId: '', description: '' }])}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-medium uppercase tracking-wider hover:bg-zinc-200 transition-all"
              >
                <Plus size={14} />
                Add Split
              </button>
            </div>
            
            <div className="space-y-3">
              {splits.map((split, idx) => (
                <div key={split.id} className="grid grid-cols-12 gap-4 items-end bg-[var(--ink)] p-4 rounded-[32px] border border-[var(--line)]">
                  <div className="col-span-5 space-y-1">
                    <label htmlFor={`bill-split-desc-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Description</label>
                    <input 
                      id={`bill-split-desc-${idx}`}
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
                    <label htmlFor={`bill-split-acc-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Expense Account</label>
                    <select 
                      id={`bill-split-acc-${idx}`}
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
                    <label htmlFor={`bill-split-amount-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Amount ({bill.currency || workspaceCurrency})</label>
                    <input 
                      id={`bill-split-amount-${idx}`}
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
                      aria-label={`Remove split line ${idx + 1}`}
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
                <label htmlFor="bill-memo" className="micro-label">Internal Memo</label>
                <textarea 
                  id="bill-memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Notes about this bill..."
                  className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none resize-none h-24"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="bill-file-upload" className="micro-label">Attachments & Receipts</label>
                <div className="flex items-center gap-4">
                   <label htmlFor="bill-file-upload" className="cursor-pointer flex items-center justify-center w-full px-4 py-3 bg-[var(--ink)] border-2 border-dashed border-zinc-300 rounded-xl hover:bg-zinc-100 transition-colors">
                     <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select Files</span>
                     <input id="bill-file-upload" type="file" multiple className="hidden" onChange={handleFileUpload} />
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
            <dl className="text-xs text-[var(--muted)] grid grid-cols-[auto_auto] gap-x-4 mb-1 tabular-nums" aria-label="Bill totals">
              <dt>Lines</dt><dd className="text-right font-mono">{money(totals.subtotalCents)}</dd>
              {totals.components.map(c => <React.Fragment key={c.name}><dt>{c.name} {c.rate}%{totals.selfAssessedCents ? ' (reverse charge: you account for it)' : pricesIncludeTax ? ' (included)' : ''}</dt><dd className="text-right font-mono">{money(c.taxCents)}</dd></React.Fragment>)}
            </dl>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Bill Amount</span>
            <span className="text-3xl font-black text-[var(--text)] font-mono">
              {money(totals.amountCents)}
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
              onClick={(e) => handleAction(e, 'approved')}
              loadingText="Approving..."
              className="px-6 py-3.5 bg-emerald-600 text-white rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              Approve Bill
            </AsyncButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
