import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Invoice } from '../../types';
import {
  Plus,
  Users,
  Download,
  Mail,
  Clock,
  AlertCircle,
  Activity,
  ShieldCheck,
  TrendingUp,
  Trash2, DollarSign,
  Eye, Ban, Undo2, Bell, BellOff, Pencil
} from 'lucide-react';
import { parseLocalDate, cn, formatCurrency, getLocalDateISO } from '../../lib/utils';
import { getIdToken } from '../../firebase';
import { resolveAccountRole } from '../../lib/accountUtils';
import { isPostable, lineAmount, isOpenInvoice } from '../../lib/txFilters';
import { format, differenceInDays } from 'date-fns';
import { motion } from 'motion/react';

import InvoiceModal from './InvoiceModal';
import { useRecordFocus, recordElementId } from '../../hooks/useRecordFocus';
import { EmptyState } from '../ui/EmptyState';
import CustomerModal from './CustomerModal';
import { PartyDetailView } from '../common/PartyDetailView';
import WriteOffModal from './WriteOffModal';
import InvoiceEmailDialog from './InvoiceEmailDialog';
import PdfPreviewModal, { downloadDocumentPdf } from '../ui/PdfPreviewModal';
import ReceivePaymentModal from './ReceivePaymentModal';

import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { printInvoice } from '../../lib/printInvoice';
import { convertEstimateToInvoice } from '../../lib/estimateConverter';
import { detectDuplicateContacts } from '../../lib/contactUtils';
import { getDefaultTaxConfig, generateDefaultTaxRates } from '../../lib/taxRateDefaults';
import { calculateNextOccurrence } from '../../lib/recurringEngine';

import CustomerDetailView from './CustomerDetailView';

export default function Sales() {
  const user = useAuthStore(s => s.user);
  const invoices = useLedgerStore(s => s.invoices);
  const customers = useLedgerStore(s => s.customers);
  const accounts = useLedgerStore(s => s.accounts);
  const { addEntity, updateEntity } = useEntityOperations();

  const transactions = useLedgerStore(s => s.transactions);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const customerBalances = useMemo(() => {
    const map: Record<string, number> = {};
    
    // 1. Unpaid invoices
    (invoices || []).forEach(inv => {
      if (inv.customerId && isOpenInvoice(inv)) {
        map[inv.customerId] = (map[inv.customerId] || 0) + lineAmount(inv as any);
      }
    });

    // 2. Transaction-based AR logic (fallback aging report logic)
    // Add pending AR lines that map to this customer by name
    if (transactions) {
      transactions.filter(isPostable).forEach(tx => {
        let arAmount = 0;
        tx.lines?.forEach(l => {
          const acc = accounts?.find(a => a.id === l.accountId);
          // If it's an AR account
          if (acc && (resolveAccountRole(acc) === 'ar' || (acc.type === 'asset' && acc.name.toLowerCase().includes('receivable')))) {
            arAmount += lineAmount(l, tx); // Positive is debit (increase AR)
          }
        });
        
        if (arAmount > 0) {
          // Try to match to a customer
          const matchedCust = customers?.find(c => tx.payee?.toLowerCase() === c.name.toLowerCase() || tx.description?.toLowerCase().includes(c.name.toLowerCase()));
          if (matchedCust) {
            map[matchedCust.id] = (map[matchedCust.id] || 0) + arAmount;
          }
        }
      });
    }

    return map;
  }, [invoices, transactions, customers, accounts]);
  const onAddInvoice = async (data: any) => { 
    let res;
    if (data.id) { 
      const { id, ...updates } = data; 
      res = await updateEntity('invoices', id, updates); 
    } else {
      res = await addEntity('invoices', data); 
    }

    if (data.type === 'recurring') {
      const startDateStr = data.date || getLocalDateISO();
      const anchorDay = Number(startDateStr.split('-')[2]) || 1;
      const nextOcc = calculateNextOccurrence(startDateStr, data.recurringInterval || 'monthly', anchorDay);
      // The daily job copies this invoice as a draft on each date (recurringService.ts)
      const { id: _id, number: _number, status: _status, date: _date, dueDate, amountPaidCents: _paid, paymentToken: _token,
        metadata: _metadata, type: _type, recurringInterval: _interval, createdAt: _created, updatedAt: _updated, ...invoiceFields } = data;
      const dueDays = dueDate && startDateStr ? Math.max(0, Math.round((Date.parse(`${String(dueDate).slice(0, 10)}T00:00:00Z`) - Date.parse(`${startDateStr.slice(0, 10)}T00:00:00Z`)) / 86400000)) : 30;
      await addEntity('recurring', {
        description: `Recurring Invoice: ${data.customerName || 'Customer'} - ${data.number || 'Standard'}`,
        amountCents: data.amountCents || 0,
        frequency: data.recurringInterval || 'monthly',
        nextOccurrence: nextOcc,
        anchorDay,
        isActive: true,
        status: 'active',
        type: 'invoice',
        payee: data.customerName || '',
        invoiceTemplate: { ...invoiceFields, dueDays },
        template: {
          description: `Invoice: ${data.customerName || 'Customer'}`,
          amountCents: data.amountCents || 0,
          customerId: data.customerId,
          tags: ['recurring', 'invoice', ...(data.tags || [])]
        }
      }, 'Recurring schedule registered');
    }
    return res;
  };
  const onAddCustomer = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity('customers', id, updates); } return addEntity('customers', data); };
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'customers' | 'pipeline'>('pipeline');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [newInvoiceFor, setNewInvoiceFor] = useState<Partial<Invoice> | undefined>(undefined);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [paymentDocumentId, setPaymentDocumentId] = useState<string | null>(null);
  const [paymentContactId, setPaymentContactId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isWriteOffOpen, setIsWriteOffOpen] = useState(false);
  const [selectedInvoiceForWriteOff, setSelectedInvoiceForWriteOff] = useState<Invoice | null>(null);
  const [previewPdfInvoice, setPreviewPdfInvoice] = useState<Invoice | null>(null);
  const [emailInvoice, setEmailInvoice] = useState<Invoice | null>(null);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const [searchTerm, setSearchTerm] = useState('');
  // A record link (#sales/invoice/<id>, e.g. from Data Health) shows and highlights the invoice
  const focusedInvoiceId = useRecordFocus('invoice', { ready: invoices.length > 0, onFocus: () => { setActiveSubTab('invoices'); setSearchTerm(''); } });

  // The customer paid after all: reverse the bad debt write-off (server, badDebtService.ts); the
  // invoice is open again for the payment.
  const reverseWriteOff = async (inv: Invoice) => {
    if (!currentWorkspaceId) return;
    try {
      const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(currentWorkspaceId)}/invoices/${encodeURIComponent(inv.id)}/write-off/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
        body: JSON.stringify({ reason: 'Customer paid after all' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'The write-off could not be reversed');
      toast.success(`Write-off reversed: ${formatCurrency(inv.writtenOffCents || 0)} is due again. Record the payment now.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The write-off could not be reversed');
    }
  };

  const agingBuckets = useMemo(() => {
    const now = new Date();
    return {
      overdue: invoices.filter(i => isOpenInvoice(i) && (i.status === 'overdue' || parseLocalDate(i.dueDate) < now)).reduce((sum, i) => sum + lineAmount(i as any), 0),
      dueSoon: invoices.filter(i => {
        const dueDate = parseLocalDate(i.dueDate);
        const diff = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return isOpenInvoice(i) && (i.status === 'sent' || i.status === 'pending') && diff >= 0 && diff <= 30;
      }).reduce((sum, i) => sum + lineAmount(i as any), 0),
      total: invoices.filter(isOpenInvoice).reduce((sum, i) => sum + lineAmount(i as any), 0)
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i: Invoice) => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      const customer = customers?.find(c => c.id === i.customerId);
      const searchStr = `${i.customerName || ''} ${i.number || ''} ${i.metadata ? JSON.stringify(i.metadata) : ''} ${i.tags?.join(' ') || ''} ${customer?.tags?.join(' ') || ''} ${customer?.metadata ? JSON.stringify(customer.metadata) : ''}`.toLowerCase();
      return searchStr.includes(term);
    });
  }, [invoices, customers, searchTerm]);

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'sent': 
      case 'pending':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'void': return 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through';
      default: return 'bg-[var(--ink)] text-zinc-650 border-[var(--line)]';
    }
  };

  if (selectedCustomerId) {
    return <CustomerDetailView customerId={selectedCustomerId} onBack={() => setSelectedCustomerId(null)} />;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Rule Header with brand gold backdrop */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-[var(--brass)] opacity-10 rounded-full blur-3xl hidden md:block pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 text-[10px] font-mono text-[var(--brass)] font-semibold mb-2 shadow-xs">
              <TrendingUp size={12} />
              SALES & ACCOUNTS RECEIVABLE
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">Invoicing & Customer Accounts</h1>
            <p className="text-xs text-[var(--muted)] font-medium mt-1">Manage receivables, recurring billing, and client credit balances.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center bg-[var(--surface)]/80 p-1 rounded-xl border border-[var(--line)] shadow-inner backdrop-blur-sm">

              <button 
                onClick={() => setActiveSubTab('invoices')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeSubTab === 'invoices' 
                    ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Invoices & AP
              </button>
              <button 
                onClick={() => setActiveSubTab('customers')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeSubTab === 'customers' 
                    ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Customers & Clients
              </button>
            </div>
            <button 
              onClick={() => activeSubTab === 'invoices' ? setIsInvoiceModalOpen(true) : setIsCustomerModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black rounded-xl text-xs font-bold hover:opacity-95 transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              {activeSubTab === 'invoices' ? 'Add Invoice' : 'Add Customer'}
            </button>
          </div>
        </div>
      </div>

      {/* Psychological Header: Aging Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm relative overflow-hidden group"
        >
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-rose-500 font-semibold mb-3 relative z-10">Critical Overdue</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-rose-600 tracking-tight relative z-10 tabular-nums">{formatCurrency(agingBuckets.overdue)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)] relative z-10">
             <AlertCircle size={12} />
             Immediate Disbursement Priority
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm relative overflow-hidden group"
        >
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-semibold mb-3 relative z-10">Short-Term (30d)</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-amber-600 tracking-tight relative z-10 tabular-nums">{formatCurrency(agingBuckets.dueSoon)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)] relative z-10">
             <Activity size={12} />
             Operational Inflow Expected
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm relative overflow-hidden group"
        >
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-semibold mb-3 relative z-10">Mid-Term (30-60d)</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text)] tracking-tight relative z-10 tabular-nums">{formatCurrency(0 /* N/A for sales */)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)] relative z-10">
             <Clock size={12} />
             Liquidity Forecast Cluster
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--brass-line)] shadow-sm relative overflow-hidden group bg-gradient-to-b from-[var(--brass-soft)] to-[var(--panel)]"
        >
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-semibold mb-3 relative z-10">Total Accounts Receivable</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text)] tracking-tight relative z-10 tabular-nums">{formatCurrency(agingBuckets.total)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)] relative z-10">
             <ShieldCheck size={12} className="text-[var(--brass)]" />
             Unpaid invoices, all customers
          </div>
        </motion.div>
      </div>

      {activeSubTab === 'invoices' && (
        <div className="ledger-card p-1 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-[var(--line)]/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Number</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Customer</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Date</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Due</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Amount</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">State</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} id={recordElementId('invoice', inv.id)} aria-current={focusedInvoiceId === inv.id ? 'true' : undefined}
                    className={cn("group hover:bg-[var(--ink)]/30 transition-all", focusedInvoiceId === inv.id && "ring-2 ring-inset ring-[var(--brass)]")}>
                    <td className="p-4 md:p-8 font-mono font-bold text-slate-500 group-hover:text-[var(--text)] transition-colors">{inv.number}</td>
                    <td className="p-4 md:p-8">
                       <div className="flex flex-col">
                          <span className="font-black text-[var(--text)] text-base tracking-tight">{inv.customerName}</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8">
                       <span className="font-bold text-[var(--text)]">{inv.date ? format(parseLocalDate(inv.date), 'MMM dd, yyyy') : 'N/A'}</span>
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex flex-col">
                        <span className={cn(
                          "font-bold text-[var(--text)]",
                          inv.status === 'overdue' && "text-rose-600"
                        )}>
                          {inv.dueDate ? format(parseLocalDate(inv.dueDate), 'MMM dd, yyyy') : 'N/A'}
                        </span>
                        {inv.status === 'pending' && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">
                            {differenceInDays(parseLocalDate(inv.dueDate), new Date())} T-Days Left
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-[var(--text)] text-lg tracking-tighter tabular-nums">
                      {formatCurrency(inv.amountCents || 0)}
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex justify-center">
                        <span className={cn(
                          "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm",
                          getStatusColor(inv.status)
                        )}>
                          {inv.status}
                        </span>
                        {(inv.writtenOffCents || 0) > 0 && (
                          <span className="text-[10px] text-amber-600 font-bold" title={inv.writeOffReason || undefined}>written off {formatCurrency(inv.writtenOffCents || 0)}</span>
                        )}
                      </div>
                      {inv.metadata?.cogsPending && (
                        <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-[var(--neg)]">
                          <span title="The cost of the items sold was not recorded: add an Inventory and a Cost of Goods Sold account, then retry.">Cost not recorded</span>
                          <button type="button" onClick={() => updateEntity('invoices', inv.id, {}, 'Invoice re-posted')} className="underline font-bold">Retry</button>
                        </div>
                      )}
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex items-center gap-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        {inv.status !== 'void' && (
                          <button
                            type="button"
                            onClick={() => { setNewInvoiceFor(inv); setIsInvoiceModalOpen(true); }}
                            className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
                            title="Edit invoice"
                            aria-label={`Edit invoice ${inv.number || ''}`.trim()}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {inv.status !== 'paid' && (
                          <button 
                            onClick={() => {
                              if (inv.customerId) {
                                setPaymentContactId(inv.customerId);
                                setPaymentDocumentId(inv.id);
                                setIsPaymentModalOpen(true);
                              } else {
                                toast.error('Invoice is missing a customer.');
                              }
                            }}
                            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                            title="Receive Payment"
                          >
                            <DollarSign size={16} />
                          </button>
                        )}
                        {(inv.writtenOffCents || 0) > 0 && (
                          <button
                            onClick={() => reverseWriteOff(inv)}
                            className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-amber-600 transition-all"
                            title="Customer paid after all: reverse the bad debt write-off"
                            aria-label="Reverse the bad debt write-off"
                          >
                            <Undo2 size={16} />
                          </button>
                        )}
                        {inv.status !== 'draft' && (inv.status === 'overdue' || (inv.status !== 'paid' && inv.status !== 'void' && differenceInDays(new Date(), parseLocalDate(inv.dueDate)) > 0)) && (
                          <button
                            onClick={() => {
                              setSelectedInvoiceForWriteOff(inv);
                              setIsWriteOffOpen(true);
                            }}
                            className="p-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                            title="Write Off Bad Debt"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                        {inv.status !== 'draft' && inv.status !== 'void' && (
                          <button
                            onClick={() => setEmailInvoice(inv)}
                            className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
                            title="Email the invoice or a reminder; see emails sent"
                            aria-label="Email the invoice"
                          >
                            <Mail size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setPreviewPdfInvoice(inv)}
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
                          title="Preview PDF"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => downloadDocumentPdf('invoice', inv.id, currentWorkspaceId || 'default', `invoice_${inv.number || inv.id}.pdf`)}
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
                          title="Download PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            // a new draft with the same customer and lines: no number (the series gives one), no payments,
                            // write-offs, links or sent/viewed history carried over
                            const { id: _id, uid: _uid, number: _number, status: _status, amountPaidCents: _paid, settledByRecordsCents: _settled,
                              writtenOffCents: _wo, writeOffTransactionId: _woTx, writeOffReason: _wr, writtenOffAt: _woAt, writeOffReversalTransactionId: _woRev,
                              paymentDate: _pd, paidAt: _pa, posted: _posted, isLocked: _locked, lockedAt: _lockedAt, paymentToken: _token, metadata: _meta,
                              dueDate: _due, ...fields } = inv;
                            setNewInvoiceFor({ ...fields, date: getLocalDateISO(), status: 'draft' });
                            setIsInvoiceModalOpen(true);
                          }}
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
                          title="Duplicate as a new draft"
                          aria-label="Duplicate as a new draft"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button 
                          onClick={() => onAddInvoice({ id: inv.id, status: 'void' })} 
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-rose-500 transition-all"
                          title="Void invoice"
                          aria-label="Void invoice"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12">
                      <EmptyState 
                        title="No Invoices Detected" 
                        description="There are currently no accounts receivable in this view. Create a new invoice or seed demo data to populate."
                        actionLabel="CREATE INVOICE"
                        onAction={() => setIsInvoiceModalOpen(true)}
                        showSeedData={true}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {activeSubTab === 'customers' && (
        <div className="ledger-card p-1 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-[var(--line)]/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Customer Profile</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Contact</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap text-right">Net Receivable</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {customers.map((cust) => (
                  <tr 
                    key={cust.id} 
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className="group hover:bg-[var(--ink)]/30 transition-all cursor-pointer"
                  >
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-900 rounded-[32px] flex items-center justify-center text-white font-black text-xl border border-white/10 shadow-2xl">
                             {(cust.name || 'VE').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-[var(--text)] text-lg tracking-tight">{cust.name}</span>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); updateEntity('customers', cust.id, { noReminders: !cust.noReminders }, cust.noReminders ? `Automatic reminders on for ${cust.name}` : `No automatic reminders for ${cust.name}`); }}
                              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mt-1 ${cust.noReminders ? 'text-[var(--muted)]' : 'text-emerald-500'}`}
                              aria-pressed={!cust.noReminders}
                              title="Automatic payment reminders (Settings → Emails & Reminders)">
                               {cust.noReminders ? <BellOff size={10} aria-hidden="true" /> : <Bell size={10} aria-hidden="true" />}
                               {cust.noReminders ? 'No reminders' : 'Reminders on'}
                            </button>
                          </div>
                       </div>
                    </td>
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-2 group/email">
                          <Users size={16} className="text-slate-500 opacity-40" />
                          <span className="font-bold text-[var(--text)] group-hover/email:text-indigo-600 transition-colors">{cust.email}</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-[var(--text)] text-xl tracking-tighter tabular-nums">
                      {formatCurrency(customerBalances[cust.id] ?? cust.balanceCents ?? 0)}
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all justify-end">
                        
                        <button onClick={(e)=> {e.stopPropagation(); setNewInvoiceFor({ customerId: cust.id, customerName: cust.name }); setIsInvoiceModalOpen(true); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded" title="Enter Invoice"><Plus size={14}/></button>
                        
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-24 text-center relative overflow-hidden">
                       <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
                       <div className="relative z-10 flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-slate-200/20 rounded-[32px] flex items-center justify-center text-slate-500/30">
                             <Users size={40} />
                          </div>
                          <p className="text-base font-black text-slate-500/40 uppercase tracking-[0.5em]">Supplier Registry Offline</p>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* mounted per opening, so a new invoice never inherits the last one's fields */}
      {isInvoiceModalOpen && <InvoiceModal
        key={newInvoiceFor?.id || 'new'}
        isOpen={isInvoiceModalOpen}
        onClose={() => { setIsInvoiceModalOpen(false); setNewInvoiceFor(undefined); }}
        onSave={async (inv) => {
          await onAddInvoice(inv);
          setIsInvoiceModalOpen(false);
          setNewInvoiceFor(undefined);
        }}
        customers={customers}
        accounts={accounts}
        initialInvoice={newInvoiceFor}
      />}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSave={async (cust) => {
          await onAddCustomer(cust);
          setIsCustomerModalOpen(false);
        }}
      />
      {isPaymentModalOpen && paymentDocumentId && paymentContactId && (
        <ReceivePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          defaultDirection="received"
          defaultDocumentId={paymentDocumentId}
          defaultContactId={paymentContactId}
        />
      )}
      {emailInvoice && <InvoiceEmailDialog invoice={emailInvoice} onClose={() => setEmailInvoice(null)} />}
      {isWriteOffOpen && selectedInvoiceForWriteOff && (
        <WriteOffModal
          isOpen={isWriteOffOpen}
          onClose={() => {
            setIsWriteOffOpen(false);
            setSelectedInvoiceForWriteOff(null);
          }}
          invoice={selectedInvoiceForWriteOff}
        />
      )}
      {previewPdfInvoice && (
        <PdfPreviewModal
          isOpen={!!previewPdfInvoice}
          onClose={() => setPreviewPdfInvoice(null)}
          title={`Invoice ${previewPdfInvoice.number || previewPdfInvoice.id}`}
          documentType="invoice"
          documentId={previewPdfInvoice.id}
          workspaceId={currentWorkspaceId || 'default'}
          filename={`invoice_${previewPdfInvoice.number || previewPdfInvoice.id}.pdf`}
        />
      )}
    </div>
  );
}

