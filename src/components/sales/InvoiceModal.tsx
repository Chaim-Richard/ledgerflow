import { useDialog } from '../../hooks/useDialog';
import { useSuggestedRate } from '../../hooks/useSuggestedRate';
import { documentCurrencies } from '../../lib/exchangeRates';
import { latestDocumentFor } from '../../lib/repeatDocument';
import { calculateDueDate, isFixedTerm, termsForCustomer } from '../../lib/paymentTerms';
import { isArchivedParty } from '../../lib/contacts';
import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useState, useEffect, useMemo } from 'react';
import { isIncomeAccount, isUndepositedFundsAccount, resolveAccountRole } from '../../lib/accountUtils';
import { X, Plus, Trash2, Save, Download, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { Invoice, Customer, ChartAccount } from '../../types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getIdToken } from '../../firebase';
import AsyncButton from '../ui/AsyncButton';
import PdfPreviewModal, { downloadDocumentPdf } from '../ui/PdfPreviewModal';
import { formatCurrency, safeConfirm } from '../../lib/utils';
import { customerPricer, findInventoryItem, lineAmountCents, setLineDescription, taxCodeToFillFromItem } from '../../lib/invoiceLines';
import TaxExemptionNotice from './TaxExemptionNotice';
import { customRateCode, documentTotals, effectiveRate, taxCodeFromRate, TAX_TREATMENTS } from '../../lib/taxCodes';
import { depositAppliedCents } from '../../lib/documentMath';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import AttachmentsPanel from '../common/AttachmentsPanel';
import { LineLabels } from '../common/LineLabels';
import { attachmentProblem } from '../../lib/attachments';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `attachmentFiles`: files picked for a new invoice, kept with it once it is saved (K-07) */
  onSave: (invoice: Partial<Invoice> & { attachmentFiles?: File[] }) => void;
  customers: Customer[];
  accounts: ChartAccount[];
  initialInvoice?: Partial<Invoice>;
  /** A sale receipt (K-03): paid on the spot; saved as an issued invoice with its payment recorded at once. */
  receipt?: boolean;
}

/** What a sale receipt adds to the saved invoice: where the money went and how (not stored on the invoice). */
export interface ReceiptPayment { cashAccountId: string; method: string }

export default function InvoiceModal({ isOpen, onClose, onSave, customers = [], accounts = [], initialInvoice, receipt = false }: InvoiceModalProps) {
  // Ensure we have arrays even if props were passed as null
  // archived contacts aren't offered for new documents; one already on this document stays (I-22)
  const safeCustomers = (Array.isArray(customers) ? customers : []).filter(c => !isArchivedParty(c) || c.id === initialInvoice?.customerId);
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(a => isIncomeAccount(a)) : [];
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const workspaceCurrency = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';
  const inventoryItems = useLedgerStore(s => s.inventory || []);
  useLedgerCollections('inventory', 'invoices');
  const pastInvoices = useLedgerStore(s => s.invoices);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  // a sale receipt goes into a bank account or Undeposited Funds (then "Make deposit" takes it to the bank)
  const chartAccounts = useLedgerStore(s => s.accounts);
  const paidIntoChoices = useMemo(() => (chartAccounts || []).filter(a => !a.isArchived && (resolveAccountRole(a) === 'cash' || isUndepositedFundsAccount(a))), [chartAccounts]);
  const [receiptAccountId, setReceiptAccountId] = useState('');
  const [receiptMethod, setReceiptMethod] = useState('card');
  const paidIntoId = receiptAccountId || (paidIntoChoices.find(isUndepositedFundsAccount) || paidIntoChoices[0])?.id || '';

  const [invoice, setInvoice] = useState<Partial<Invoice>>(() => initialInvoice || ({
    number: `INV-${Date.now().toString().slice(-6)}`,
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
    amountCents: 0
  }));

  const [items, setItems] = useState<Array<{ id: string, itemId?: string, description: string, quantity: number, rateCents: number, amountCents: number, accountId: string, taxRate?: number, unitCostCents?: number, dimensions?: Record<string, string> }>>([
    { id: crypto.randomUUID(), description: '', quantity: 1, rateCents: 0, amountCents: 0, accountId: '' }
  ]);

  useEffect(() => {
    if (initialInvoice) {
      // an existing invoice replaces the form; a new one (e.g. for a customer) fills in the defaults
      setInvoice(prev => (initialInvoice.id ? initialInvoice : { ...prev, ...initialInvoice }));
      if (initialInvoice.items && initialInvoice.items.length > 0) {
        setItems(initialInvoice.items as any);
      }
    }
  }, [initialInvoice]);

  const editingExisting = Boolean(initialInvoice?.id);
  useEffect(() => {
    // a new invoice gets the next number; an existing one keeps its own
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
            body: JSON.stringify({ type: 'invoice' })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.number) {
              setInvoice(prev => ({ ...prev, number: data.number }));
            }
          }
        } catch (e) {
          console.error('Failed to fetch next invoice number', e);
        }
      };
      fetchNextNumber();
    }
  }, [isOpen, editingExisting]);

  // an edited invoice keeps its memo, terms and email text (they were saved in metadata)
  const savedText = (key: string) => {
    const v = (initialInvoice?.metadata as Record<string, unknown> | undefined)?.[key];
    return typeof v === 'string' ? v : '';
  };
  const [memo, setMemo] = useState(() => savedText('memo'));
  const [terms, setTerms] = useState(() => savedText('terms'));
  const [emailSubject, setEmailSubject] = useState(() => savedText('emailSubject'));
  const [emailBody, setEmailBody] = useState(() => savedText('emailBody'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const total = items.reduce((sum, item) => sum + item.amountCents, 0);
  // Tax: a saved tax code (Settings → Tax), or a custom rate typed here (older invoices)
  const taxRates = useLedgerStore(s => s.taxRates || []);
  const salesCodes = useMemo(() => taxRates.filter(r => r.type === 'Sales' && r.appliesTo !== 'purchases').map(taxCodeFromRate), [taxRates]);
  const taxChoice = invoice.taxCodeId || (Number(invoice.taxRate) > 0 ? 'custom' : '');
  const taxCode = taxChoice === 'custom' ? customRateCode(Number(invoice.taxRate) || 0) : salesCodes.find(c => c.id === taxChoice) || null;
  const pricesIncludeTax = invoice.pricesIncludeTax ?? (invoice.taxVersion === 2 ? false : Boolean(invoice.taxInclusive));
  const totals = documentTotals(total, invoice.discountCents || 0, taxCode, pricesIncludeTax);
  const depositCents = depositAppliedCents({ amountCents: totals.amountCents, depositCents: invoice.depositCents });
  const currency = invoice.currency || workspaceCurrency;
  // the rate fills itself in for another currency until the person types one (BA-06, I-23)
  const [rateTyped, setRateTyped] = useState(false);
  const rateNote = useSuggestedRate({
    currency, homeCurrency: workspaceCurrency, enabled: !editingExisting && !rateTyped, docs: pastInvoices, date: invoice.date,
    onRate: rate => setInvoice(prev => ({ ...prev, exchangeRate: rate })),
  });
  // I-23: a new invoice for a customer can copy the lines of their latest invoice
  const lastForCustomer = !editingExisting && invoice.customerId
    ? latestDocumentFor(pastInvoices, d => d.customerId === invoice.customerId, d => d.items) : null;
  const linesEmpty = items.every(i => !i.description.trim() && !i.amountCents && !i.itemId);
  const repeatLast = () => {
    if (!lastForCustomer?.items) return;
    setItems(lastForCustomer.items.map(i => ({ ...i, id: crypto.randomUUID() })));
    setInvoice(prev => ({
      ...prev,
      ...(lastForCustomer.taxCodeId ? { taxCodeId: lastForCustomer.taxCodeId } : {}),
      ...(lastForCustomer.pricesIncludeTax !== undefined ? { pricesIncludeTax: lastForCustomer.pricesIncludeTax } : {}),
      ...(lastForCustomer.discountCents ? { discountCents: lastForCustomer.discountCents } : {}),
    }));
    setDirty(true);
  };
  const currencyChoices = useMemo(() => documentCurrencies(workspaceCurrency, currency, [...pastInvoices, ...safeCustomers]), [workspaceCurrency, currency, pastInvoices, safeCustomers]);
  const money = (cents: number) => formatCurrency(cents, currency);

  const handleAction = async (e: React.FormEvent, actionStatus: string) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!invoice.customerId) {
      toast.error('Please select a customer');
      return;
    }
    if ((invoice.depositCents || 0) > totals.amountCents) {
      toast.error("The deposit can't be more than the invoice total");
      return;
    }
    if (receipt && !paidIntoId) {
      toast.error('Add a bank account (or Undeposited Funds) to the chart first: a sale receipt needs somewhere the money went');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSave({
        ...invoice,
        status: actionStatus as any,
        ...(receipt ? { paymentTerms: 'due_on_receipt', dueDate: invoice.date, receiptPayment: { cashAccountId: paidIntoId, method: receiptMethod } as ReceiptPayment } : {}),
        currency,
        // the total owed (after the discount, tax included) and the tax, explicitly (taxCodes.ts)
        amountCents: totals.amountCents,
        lineSumCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxAmountCents: totals.taxCents,
        taxInclusive: true,
        taxVersion: 2,
        pricesIncludeTax,
        taxCodeId: taxCode?.id,
        taxTreatment: taxCode?.treatment,
        taxBreakdown: totals.components,
        taxRate: taxCode ? Math.round(effectiveRate(taxCode.components) * 100000) / 1000 : 0,
        items,
        metadata: {
          ...(invoice.metadata || {}),
          ...(receipt ? { saleReceipt: true } : {}),
          memo,
          terms,
          emailSubject,
          emailBody,
        },
        // files picked for a new invoice are kept with it once it has an id (Sales.tsx)
        ...(attachments.length > 0 && !invoice.id ? { attachmentFiles: attachments } : {}),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => handleAction(e, invoice.status || 'pending');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const refused = picked.map(f => attachmentProblem(f)).filter(Boolean);
    if (refused.length) toast.error(refused.join('; '));
    setAttachments(prev => [...prev, ...picked.filter(f => !attachmentProblem(f))]);
  };

  // I-07: closing with unsaved edits asks first
  const [dirty, setDirty] = useState(false);
  const requestClose = () => {
    if (!dirty || safeConfirm('Discard your changes to this invoice?')) onClose();
  };

  const { dialogProps, titleId } = useDialog(requestClose, isOpen);
  if (!isOpen) return null;

  return (
    <div {...dialogProps} className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={requestClose}
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
            <h2 id={titleId} className="text-2xl font-black text-[var(--text)] tracking-tight">{receipt ? 'New sale receipt' : editingExisting ? `Edit invoice ${invoice.number || ''}`.trim() : 'New invoice'}</h2>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Sales & Receivables</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400" title="Print invoice" aria-label="Print invoice">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </button>
            <button aria-label="Close" onClick={requestClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400"><X size={24} /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} onChange={() => setDirty(true)} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label htmlFor="inv-customer" className="micro-label">Customer</label>
              <div className="relative">
                <input 
                  id="inv-customer"
                  required
                  list="invoice-customer-list"
                  value={invoice.customerName || invoice.customerId || ''}
                  onChange={(e) => {
                    const cust = safeCustomers.find(c => c.name === e.target.value || c.id === e.target.value);
                    // a new invoice starts in the customer's currency (Y-22); an existing one keeps its own
                    const custCurrency = cust && !editingExisting ? (cust.currency || workspaceCurrency) : null;
                    const currencyChange = custCurrency && custCurrency !== currency ? { currency: custCurrency, exchangeRate: 1 } : {};
                    // a new invoice takes the customer's usual terms, and the due date follows (I-23)
                    const terms = !editingExisting ? termsForCustomer(cust as { id: string; paymentTerms?: string } | undefined, pastInvoices) : null;
                    const termsChange = terms ? { paymentTerms: terms, dueDate: calculateDueDate(invoice.date || '', terms) } : {};
                    setInvoice({ ...invoice, customerId: cust ? cust.id : `new-${crypto.randomUUID()}`, customerName: cust ? cust.name : e.target.value, ...currencyChange, ...termsChange });
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
              <label htmlFor="inv-number" className="micro-label">Invoice Number</label>
              <input 
                id="inv-number"
                type="text"
                required
                value={invoice.number}
                onChange={(e) => setInvoice({ ...invoice, number: e.target.value })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="inv-status" className="micro-label">Status</label>
              <select 
                id="inv-status"
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <label htmlFor="inv-type" className="micro-label">Invoice Type</label>
              <select 
                id="inv-type"
                value={invoice.type || 'standard'}
                onChange={(e) => setInvoice({ ...invoice, type: e.target.value as any })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              >
                <option value="standard">Standard</option>
                <option value="recurring">Recurring</option>
                <option value="progress">Progress</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="inv-payment-terms" className="micro-label">Payment Terms</label>
              <select 
                id="inv-payment-terms"
                value={invoice.paymentTerms || 'due_on_receipt'}
                // the due date follows the terms (it stayed on the invoice date before; L-186)
                onChange={(e) => setInvoice({ ...invoice, paymentTerms: e.target.value, ...(isFixedTerm(e.target.value) ? { dueDate: calculateDueDate(invoice.date || '', e.target.value) } : {}) })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              >
                <option value="due_on_receipt">Due on Receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_60">Net 60</option>
              </select>
            </div>

            {invoice.type === 'recurring' && (
               <div className="space-y-2">
                 <label htmlFor="inv-recurring-interval" className="micro-label">Recurring Interval</label>
                 <select 
                   id="inv-recurring-interval"
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
                 <label htmlFor="inv-progress-pct" className="micro-label">Progress Percentage (%)</label>
                 <input 
                   id="inv-progress-pct"
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
              <label htmlFor="inv-date" className="micro-label">Invoice Date</label>
              <input 
                id="inv-date"
                type="date"
                required
                value={invoice.date}
                onChange={(e) => setInvoice({ ...invoice, date: e.target.value, ...(isFixedTerm(invoice.paymentTerms) && e.target.value ? { dueDate: calculateDueDate(e.target.value, invoice.paymentTerms) } : {}) })}
                className="w-full px-5 py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="inv-due-date" className="micro-label">Due Date</label>
              <input 
                id="inv-due-date"
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
               <label htmlFor="inv-discount" className="micro-label">Discount ({currency})</label>
               <input 
                 id="inv-discount"
                 type="number" step="0.01" min="0" value={(invoice.discountCents || 0) / 100}
                 onChange={(e) => setInvoice({ ...invoice, discountCents: TruthEngine.parseAmountToCents(e.target.value || '0') })}
                 className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
               />
             </div>
             <div className="space-y-2">
               <label htmlFor="inv-deposit" className="micro-label">Deposit ({currency})</label>
               <input 
                 id="inv-deposit"
                 type="number" step="0.01" min="0" value={(invoice.depositCents || 0) / 100}
                 onChange={(e) => setInvoice({ ...invoice, depositCents: TruthEngine.parseAmountToCents(e.target.value || '0') })}
                 aria-describedby="inv-deposit-help"
                 className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
               />
               <p id="inv-deposit-help" className="text-[11px] text-[var(--muted)]">Paid in advance (booked to Customer Deposits). Tax stays on the full total; the deposit lowers the amount due.</p>
             </div>
             <div className="space-y-2">
               <label htmlFor="inv-retainage" className="micro-label">Retainage ({currency})</label>
               <input 
                 id="inv-retainage"
                 type="number" step="0.01" min="0" value={(invoice.retainageCents || 0) / 100}
                 onChange={(e) => setInvoice({ ...invoice, retainageCents: TruthEngine.parseAmountToCents(e.target.value || '0') })}
                 className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
               />
             </div>
             <div className="space-y-2">
                 <label htmlFor="inv-milestone" className="micro-label">Milestone / Proj.</label>
                 <input 
                   id="inv-milestone"
                   type="text" value={invoice.milestone || ''}
                   onChange={(e) => setInvoice({ ...invoice, milestone: e.target.value })}
                   className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                 />
             </div>
             <div className="space-y-2">
                 <label htmlFor="inv-tax-code" className="micro-label">Tax</label>
                 <select
                   id="inv-tax-code"
                   value={taxChoice}
                   onChange={(e) => setInvoice({ ...invoice, taxCodeId: e.target.value === 'custom' || e.target.value === '' ? undefined : e.target.value, taxRate: e.target.value === 'custom' ? (invoice.taxRate || 0) : 0 })}
                   className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                 >
                   <option value="">No tax</option>
                   {salesCodes.map(c => <option key={c.id} value={c.id}>{c.name}{c.treatment !== 'standard' ? ` (${TAX_TREATMENTS[c.treatment]})` : ''}</option>)}
                   <option value="custom">Other rate…</option>
                 </select>
                 {taxChoice === 'custom' && (
                   <input
                     aria-label="Tax rate (%)"
                     type="number" step="0.001" min="0" max="100" value={invoice.taxRate || 0}
                     onChange={(e) => setInvoice({ ...invoice, taxRate: parseFloat(e.target.value || '0') })}
                     className="w-full px-4 py-2 bg-[var(--ink)] border border-[var(--line)] rounded-xl outline-none font-mono"
                   />
                 )}
                 {salesCodes.length === 0 && <p className="text-[11px] text-[var(--muted)]">Add tax codes in Taxes.</p>}
                 <TaxExemptionNotice customer={safeCustomers.find(c => c.id === invoice.customerId)} date={invoice.date || ''} charging={totals.taxCents > 0} onNoTax={() => setInvoice({ ...invoice, taxCodeId: salesCodes.find(c => c.treatment === 'exempt')?.id, taxRate: 0 })} />
             </div>
             <div className="space-y-2 flex flex-col justify-end pb-3">
               <label htmlFor="inv-tax-inclusive" className="flex items-center gap-2 cursor-pointer">
                 <input id="inv-tax-inclusive" type="checkbox" checked={pricesIncludeTax} onChange={e => setInvoice({ ...invoice, pricesIncludeTax: e.target.checked })} className="w-5 h-5 rounded border-zinc-300 text-[var(--text)] focus:ring-zinc-900" />
                 <span className="text-sm font-bold text-[var(--text)]">Prices include tax</span>
               </label>
             </div>
             <div className="space-y-2">
                 <label htmlFor="inv-currency" className="micro-label">Currency</label>
                 <select 
                   id="inv-currency"
                   value={currency}
                   onChange={(e) => setInvoice({ ...invoice, currency: e.target.value, exchangeRate: e.target.value === workspaceCurrency ? 1 : invoice.exchangeRate })}
                   className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-bold"
                 >
                   {currencyChoices.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
             </div>
             <div className="space-y-2">
                 <label htmlFor="inv-exchange-rate" className="micro-label">Exchange Rate</label>
                 <input 
                   id="inv-exchange-rate"
                   type="number" step="0.0001" min="0.0001" value={invoice.exchangeRate || 1}
                   onChange={(e) => { setRateTyped(true); setInvoice({ ...invoice, exchangeRate: parseFloat(e.target.value || '1') }); }}
                   className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none font-mono"
                 />
                 {rateNote && <p role="status" className="text-[11px] text-[var(--muted)] px-2">{rateNote}</p>}
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="micro-label">Line Items</h3>
              {lastForCustomer && linesEmpty && (
                <button type="button" onClick={repeatLast}
                  className="ml-auto mr-2 px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider border border-[var(--line)] text-[var(--text)] hover:border-[var(--brass-line)]">
                  Same as last time ({lastForCustomer.number || 'last invoice'}, {lastForCustomer.items?.length} line{lastForCustomer.items?.length === 1 ? '' : 's'})
                </button>
              )}
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
                    <label htmlFor={`inv-item-desc-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Item / Description</label>
                    <div className="relative">
                      <input 
                        id={`inv-item-desc-${idx}`}
                        type="text"
                        list={`invoice-inventory-list-${idx}`}
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...items]; const fillCode = taxCodeToFillFromItem(newItems[idx].itemId, findInventoryItem(inventoryItems, e.target.value), salesCodes.map(c => c.id)); // A-7: a newly chosen item fills its tax code
                          newItems[idx] = setLineDescription(newItems[idx], e.target.value, inventoryItems, customerPricer(useAuthStore.getState().getCurrentWorkspace()?.priceLists, invoice.customerId));
                          setItems(newItems); if (fillCode) setInvoice(prev => ({ ...prev, taxCodeId: fillCode, taxRate: 0 }));
                        }}
                        placeholder="Service or Product"
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                      <datalist id={`invoice-inventory-list-${idx}`}>
                        {inventoryItems.map(i => (
                          <option key={i.id} value={i.name}>{i.sku ? `[${i.sku}] ` : ''}{i.name} · {formatCurrency(i.unitPriceCents)} · stock {i.quantityAtHand}</option>
                        ))}
                      </datalist>
                    </div>
                    {idx === 0 && inventoryItems.length === 0 && (
                      <p className="text-[10px] text-[var(--muted)]">No items yet — add products in Inventory to pick them here.</p>
                    )}
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <label htmlFor={`inv-item-qty-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Qty</label>
                    <input 
                      id={`inv-item-qty-${idx}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...items];
                        const qty = parseFloat(e.target.value || '0');
                        newItems[idx] = { ...newItems[idx], quantity: qty, amountCents: lineAmountCents(qty, newItems[idx].rateCents) };
                        setItems(newItems);
                      }}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <label htmlFor={`inv-item-rate-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Rate ({currency})</label>
                    <input 
                      id={`inv-item-rate-${idx}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.rateCents / 100}
                      onChange={(e) => {
                        const newItems = [...items];
                        const rateCents = TruthEngine.parseAmountToCents(e.target.value || '0');
                        newItems[idx] = { ...newItems[idx], rateCents, amountCents: lineAmountCents(newItems[idx].quantity, rateCents) };
                        setItems(newItems);
                      }}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                    />
                  </div>
                  <div className="col-span-8 md:col-span-2 space-y-1">
                    <label htmlFor={`inv-item-acc-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Income Account</label>
                    <div className="relative">
                      <input 
                        id={`inv-item-acc-${idx}`}
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
                  <div className="col-span-9 md:col-span-1 space-y-1 flex flex-col justify-end">
                    <div className="px-2 py-2 text-right font-mono font-bold text-[var(--text)] border border-transparent tabular-nums">
                      {money(item.amountCents)}
                    </div>
                  </div>
                  <div className="col-span-1 pb-1">
                    <button 
                      type="button"
                      aria-label={`Remove line ${idx + 1}`}
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="p-2 text-zinc-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="col-span-12"><LineLabels value={item.dimensions} lineNumber={idx + 1} accountId={item.accountId} date={invoice.date || ''}
                    onChange={dimensions => setItems(items.map((it, i) => (i === idx ? { ...it, dimensions } : it)))} /></div>{/* BF-09 */}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[var(--line)] pt-8 mt-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="inv-memo" className="micro-label">Customer Memo</label>
                <textarea 
                  id="inv-memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Message to customer..."
                  className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none resize-none h-24"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="inv-terms" className="micro-label">Terms & Conditions</label>
                <textarea 
                  id="inv-terms"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Standard terms..."
                  className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none resize-none h-24 text-xs"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="inv-email-subject" className="micro-label">Email Subject</label>
                <input 
                  id="inv-email-subject"
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Invoice from us"
                  className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                />
              </div>
              {invoice.id ? (
                <AttachmentsPanel target={{ collection: 'invoices', id: invoice.id, label: `Invoice ${invoice.number || ''}`.trim() }} />
              ) : (
                <div className="space-y-2">
                  <label htmlFor="inv-attachments" className="micro-label">Files</label>
                  <label htmlFor="inv-attachments" className="cursor-pointer flex items-center justify-center w-full px-4 py-3 bg-[var(--ink)] border-2 border-dashed border-zinc-300 rounded-xl hover:bg-zinc-100 transition-colors">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select files</span>
                    <input id="inv-attachments" type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                  {attachments.length > 0 && (
                    <ul className="flex flex-wrap gap-2 mt-2" aria-label="Files to keep with the invoice">
                      {attachments.map(f => (
                        <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-1 px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-lg">
                          <bdi>{f.name}</bdi>
                          <button type="button" onClick={() => setAttachments(prev => prev.filter(x => x !== f))} aria-label={`Don't attach ${f.name}`} className="text-zinc-400 hover:text-rose-600"><X size={12} aria-hidden="true" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {attachments.length > 0 && <p className="text-[10px] text-[var(--muted)]">Kept with the invoice when you save it.</p>}
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="p-4 md:p-8 border-t border-[var(--line)] bg-[var(--ink)]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col w-full sm:w-auto">
            <dl className="text-xs text-[var(--muted)] grid grid-cols-[auto_auto] gap-x-4 mb-1 tabular-nums" aria-label="Invoice totals">
              <dt>Subtotal</dt><dd className="text-right font-mono">{money(totals.subtotalCents)}</dd>
              {totals.discountCents > 0 && <><dt>Discount</dt><dd className="text-right font-mono">−{money(totals.discountCents)}</dd></>}
              {totals.components.map(c => <React.Fragment key={c.name}><dt>{c.name} {c.rate}%{pricesIncludeTax ? ' (included)' : ''}</dt><dd className="text-right font-mono">{money(c.taxCents)}</dd></React.Fragment>)}
              {taxCode && taxCode.treatment !== 'standard' && <><dt>Tax</dt><dd className="text-right">{TAX_TREATMENTS[taxCode.treatment]}</dd></>}
              {depositCents > 0 && <><dt>Total</dt><dd className="text-right font-mono">{money(totals.amountCents)}</dd><dt>Deposit received</dt><dd className="text-right font-mono">−{money(depositCents)}</dd></>}
            </dl>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{depositCents > 0 ? 'Amount due' : 'Total'}</span>
            <span className="text-3xl font-black text-[var(--text)] font-mono">
              {money(totals.amountCents - depositCents)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
            {invoice.id && (
              <>
                <button 
                  type="button"
                  onClick={() => setShowPdfPreview(true)}
                  className="px-4 py-3.5 bg-[var(--surface)] border border-[var(--line)] text-zinc-700 dark:text-zinc-300 rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center gap-1.5"
                >
                  <Eye size={14} />
                  Preview PDF
                </button>
                <button 
                  type="button"
                  onClick={() => downloadDocumentPdf('invoice', invoice.id!, currentWorkspaceId || 'default', `invoice_${invoice.number || invoice.id}.pdf`)}
                  className="px-4 py-3.5 bg-[var(--surface)] border border-[var(--line)] text-indigo-600 dark:text-indigo-400 rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all flex items-center gap-1.5"
                >
                  <Download size={14} />
                  Download PDF
                </button>
              </>
            )}
            <button 
              type="button"
              onClick={requestClose}
              className="px-6 py-3.5 bg-[var(--surface)] border border-[var(--line)] text-zinc-600 rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-[var(--ink)] transition-all"
             aria-label="Cancel">
              Cancel
            </button>
            {receipt ? (
              <>
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Paid into
                  <select aria-label="Paid into" value={paidIntoId} onChange={e => setReceiptAccountId(e.target.value)}
                    className="px-3 py-2 bg-[var(--ink)] border border-[var(--line)] rounded-xl text-xs font-medium normal-case text-[var(--text)]">
                    {paidIntoChoices.length === 0 && <option value="">No bank account in the chart</option>}
                    {paidIntoChoices.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} – ` : ''}{a.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Method
                  <select aria-label="Payment method" value={receiptMethod} onChange={e => setReceiptMethod(e.target.value)}
                    className="px-3 py-2 bg-[var(--ink)] border border-[var(--line)] rounded-xl text-xs font-medium normal-case text-[var(--text)]">
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="check">Check</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <AsyncButton
                  type="button"
                  onClick={(e) => handleAction(e, 'sent')}
                  loadingText="Saving..."
                  className="px-6 py-3.5 bg-emerald-600 text-white rounded-[32px] font-medium uppercase tracking-wider text-[10px] hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
                >
                  <Save size={16} />
                  Save receipt
                </AsyncButton>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </motion.div>

      {showPdfPreview && invoice.id && (
        <PdfPreviewModal
          isOpen={showPdfPreview}
          onClose={() => setShowPdfPreview(false)}
          title={`Invoice ${invoice.number || invoice.id}`}
          documentType="invoice"
          documentId={invoice.id}
          workspaceId={currentWorkspaceId || 'default'}
          filename={`invoice_${invoice.number || invoice.id}.pdf`}
        />
      )}
    </div>
  );
}
