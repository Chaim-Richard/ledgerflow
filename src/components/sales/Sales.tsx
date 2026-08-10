import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { User } from 'firebase/auth';
import { Invoice, Customer, ChartAccount } from '../../types';
import { 
  Plus, 
  Search, 
  Users, 
  MoreVertical,
  Filter,
  Download,
  Mail,
  Clock,
  AlertCircle,
  Activity,
  ShieldCheck,
  TrendingUp,
  Package,
  RefreshCw,
  Kanban,
  Trash2, Zap,
  Check
} from 'lucide-react';
import { parseLocalDate, cn, formatCurrency } from '../../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { motion } from 'motion/react';

import InvoiceModal from './InvoiceModal';
import CustomerModal from './CustomerModal';



import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { printInvoice } from '../../lib/printInvoice';

export default function Sales() {
  const user = useAuthStore(s => s.user);
  const invoices = useLedgerStore(s => s.invoices);
  const customers = useLedgerStore(s => s.customers);
  const accounts = useLedgerStore(s => s.accounts);
  const { addEntity, updateEntity } = useEntityOperations();
  const onAddInvoice = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity('invoices', id, updates); } return addEntity('invoices', data); };
  const onAddCustomer = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity('customers', id, updates); } return addEntity('customers', data); };
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'customers' | 'pipeline'>('pipeline');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const agingBuckets = useMemo(() => {
    const now = new Date();
    return {
      overdue: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.totalCents || 0), 0),
      dueSoon: invoices.filter(i => {
        const dueDate = parseLocalDate(i.dueDate);
        const diff = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return (i.status === 'sent' || i.status === 'pending') && diff >= 0 && diff <= 30;
      }).reduce((sum, i) => sum + (i.totalCents || 0), 0),
      total: invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.totalCents || 0), 0)
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
      default: return 'bg-[var(--ink)] text-zinc-650 border-[var(--line)]';
    }
  };

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
              onClick={() => {
                if (activeSubTab === 'invoices') {
                  setEditingInvoice(null);
                  setIsInvoiceModalOpen(true);
                } else {
                  setEditingCustomer(null);
                  setIsCustomerModalOpen(true);
                }
              }}
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
          <p className="text-2xl sm:text-3xl font-mono font-bold text-rose-600 tracking-tight relative z-10">{formatCurrency(agingBuckets.overdue)}</p>
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
          <p className="text-2xl sm:text-3xl font-mono font-bold text-amber-600 tracking-tight relative z-10">{formatCurrency(agingBuckets.dueSoon)}</p>
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
          <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text)] tracking-tight relative z-10">{formatCurrency(0 /* N/A for sales */)}</p>
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
          <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text)] tracking-tight relative z-10">{formatCurrency(agingBuckets.total)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)] relative z-10">
             <ShieldCheck size={12} className="text-[var(--brass)]" />
             Verified System Liability
          </div>
        </motion.div>
      </div>

      {activeSubTab === 'invoices' && (
        <div className="ledger-card p-1 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-[var(--line)]/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Liability Node</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Supplier</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Timestamp</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Maturity</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Magnitude</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">State</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="group hover:bg-[var(--ink)]/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8 font-mono font-bold text-slate-500 group-hover:text-[var(--text)] transition-colors">{inv.number}</td>
                    <td className="p-4 md:p-8">
                       <div className="flex flex-col">
                          <span className="font-black text-[var(--text)] text-base tracking-tight">
                            {customers?.find(c => c.id === inv.customerId)?.name || inv.customerName}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">
                            {inv.type === 'estimate' ? 'ESTIMATE' : (inv.type === 'quote' ? 'QUOTE' : 'INVOICE')}
                          </span>
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
                    <td className="p-4 md:p-8 text-right font-black font-mono text-[var(--text)] text-lg tracking-tighter">
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
                      </div>
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        {inv.type === 'estimate' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddInvoice({ id: inv.id, type: 'standard', status: 'pending' });
                              toast.success('Estimate converted to Invoice');
                            }}
                            className="p-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20"
                            title="Convert to Invoice"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        {inv.status !== 'paid' && inv.type !== 'estimate' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddInvoice({ id: inv.id, status: 'paid' });
                            }}
                            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                            title="Execute Settlement"
                          >
                            <Zap size={16} />
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingInvoice(inv);
                            setIsInvoiceModalOpen(true);
                          }}
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-blue-600 transition-all"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        {inv.paymentToken && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(`${window.location.origin}/i/${inv.paymentToken}`);
                              toast.success('Public link copied to clipboard');
                            }}
                            className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-[var(--text)] transition-all"
                            title="Copy Public Link"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const { id, paymentToken, ...rest } = inv;
                            const newBill = { ...rest, number: `${inv.number}-COPY`, status: 'pending' as any };
                            onAddInvoice(newBill);
                            toast.success('Copied successfully');
                          }}
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
                          title="Duplicate"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddInvoice({ id: inv.id, status: 'void' });
                          }} 
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-rose-500 transition-all"
                          title="Void Liability"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-24 text-center relative overflow-hidden">
                       <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
                       <div className="relative z-10 flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-slate-200/20 rounded-[32px] flex items-center justify-center text-slate-500/30">
                             <Package size={40} />
                          </div>
                          <p className="text-base font-black text-slate-500/40 uppercase tracking-[0.5em]">No Financial Liabilities Detected</p>
                       </div>
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
                  <tr key={cust.id} className="group hover:bg-[var(--ink)]/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-900 rounded-[32px] flex items-center justify-center text-white font-black text-xl border border-white/10 shadow-2xl">
                             {(cust.name || 'VE').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-[var(--text)] text-lg tracking-tight">{cust.name}</span>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">
                               <ShieldCheck size={10} />
                               Preferred Partner
                            </div>
                          </div>
                       </div>
                    </td>
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-2 group/email">
                          <Users size={16} className="text-slate-500 opacity-40" />
                          <span className="font-bold text-[var(--text)] group-hover/email:text-indigo-600 transition-colors">{cust.email}</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-[var(--text)] text-xl tracking-tighter">
                      {formatCurrency(cust.balanceCents || 0)}
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all justify-end">
                        <button onClick={(e)=>{e.stopPropagation(); setEditingCustomer(cust); setIsCustomerModalOpen(true);}} className="p-2 text-blue-500 hover:bg-blue-50 rounded" title="Edit Customer"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button onClick={(e)=>{e.stopPropagation(); const { id, ...rest } = cust; onAddCustomer({ ...rest, name: `${cust.name} (Copy)` }); toast.success('Customer duplicated');}} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded" title="Duplicate Customer"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                        <button onClick={(e)=>{e.stopPropagation(); setEditingInvoice(null); onAddInvoice({ customerId: cust.id }); toast.info(`Opening inv creation for ${cust.name}`)}} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded" title="Create Invoice"><Plus size={14}/></button>
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
      
      <InvoiceModal 
        isOpen={isInvoiceModalOpen} 
        onClose={() => setIsInvoiceModalOpen(false)} 
        onSave={(data) => {
          onAddInvoice(data);
          setIsInvoiceModalOpen(false);
          toast.success(data.type === 'estimate' ? 'Estimate Saved' : 'Invoice Saved');
        }}
        initialData={editingInvoice || undefined}
        customers={customers}
        accounts={accounts}
      />
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSave={(data) => {
          onAddCustomer(data);
          setIsCustomerModalOpen(false);
          toast.success('Customer Saved');
        }}
        initialData={editingCustomer || undefined}
      />
    </div>
  );
}

