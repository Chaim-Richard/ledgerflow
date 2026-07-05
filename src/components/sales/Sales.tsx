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
  Trash2,
  Check
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';

import InvoiceModal from './InvoiceModal';
import CustomerModal from './CustomerModal';
import SalesPipeline from './SalesPipeline';

interface SalesProps {
  user: User;
  invoices: Invoice[];
  customers: Customer[];
  accounts: ChartAccount[];
  onAddInvoice: (invoice: Partial<Invoice>) => void;
  onAddCustomer: (customer: Partial<Customer>) => void;
}

export default function Sales({ 
  user, 
  invoices = [], 
  customers = [], 
  accounts = [], 
  onAddInvoice, 
  onAddCustomer 
}: SalesProps) {
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'customers' | 'pipeline'>('pipeline');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const agingBuckets = useMemo(() => {
    const now = new Date();
    return {
      overdue: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.totalCents || 0), 0),
      dueSoon: invoices.filter(i => {
        const dueDate = new Date(i.dueDate);
        const diff = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return (i.status === 'sent' || i.status === 'pending') && diff >= 0 && diff <= 30;
      }).reduce((sum, i) => sum + (i.totalCents || 0), 0),
      total: invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.totalCents || 0), 0)
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i: Invoice) => 
      (i.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) || 
      (i.number?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    );
  }, [invoices, searchTerm]);

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'sent': 
      case 'pending':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-zinc-50 text-zinc-650 border-zinc-200';
    }
  };

  return (
    <div className="space-y-12">
      {/* Neural Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate mb-4">
            <TrendingUp size={14} />
            Revenue Capture Pipeline
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Inflow Matrix</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">Real-time resolution of accounts receivable and customer lifecycle value.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           <div className="flex flex-wrap bg-slate-50 p-1.5 rounded-[32px] border border-slate-200">
            <button 
              onClick={() => setActiveSubTab('pipeline')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all flex items-center gap-2",
                activeSubTab === 'pipeline' ? "bg-indigo-600 text-white shadow-lg shadow-ledger-accent/20" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Kanban size={14} />
              CRM Pipeline
            </button>
            <button 
              onClick={() => setActiveSubTab('invoices')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
                activeSubTab === 'invoices' ? "bg-indigo-600 text-white shadow-lg shadow-ledger-accent/20" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Instruments
            </button>
            <button 
              onClick={() => setActiveSubTab('customers')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
                activeSubTab === 'customers' ? "bg-indigo-600 text-white shadow-lg shadow-ledger-accent/20" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Custodians
            </button>
          </div>
          <button 
            onClick={() => activeSubTab === 'invoices' ? setIsInvoiceModalOpen(true) : setIsCustomerModalOpen(true)}
            className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-[32px] text-xs font-medium uppercase tracking-wider hover:bg-slate-900/90 transition-all shadow-2xl"
          >
            <Plus size={18} />
            {activeSubTab === 'invoices' ? 'Issue Instrument' : 'Register Custodian'}
          </button>
        </div>
      </div>

      {/* Psychological Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 md:p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-4 relative z-10 flex items-center gap-2">
            <AlertCircle size={12} />
            Delinquent Nodes
          </p>
          <p className="text-2xl md:text-4xl font-black text-rose-600 font-mono tracking-tighter relative z-10">{formatCurrency(agingBuckets.overdue)}</p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-40">
             <Clock size={10} />
             Critical Resolution Required
          </div>
        </div>
        
        <div className="p-4 md:p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-4 relative z-10 flex items-center gap-2">
            <Activity size={12} />
            Proximal Velocity (30d)
          </p>
          <p className="text-2xl md:text-4xl font-black text-amber-600 font-mono tracking-tighter relative z-10">{formatCurrency(agingBuckets.dueSoon)}</p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-40">
             <RefreshCw size={10} className="hidden" />
             Anticipated Liquidity Event
          </div>
        </div>

        <div className="p-4 md:p-8 bg-slate-900 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-10 pointer-events-none" />
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4 relative z-10">Total Aggregate Exposure</p>
          <p className="text-2xl md:text-4xl font-black text-indigo-600 font-mono tracking-tighter relative z-10">{formatCurrency(agingBuckets.total)}</p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-white/20 uppercase tracking-widest">
             <ShieldCheck size={10} />
             Verified Asset Cluster
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="relative group max-w-md w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-600 transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Query matrix by identity or index..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:bg-white transition-all text-sm font-bold text-slate-900 placeholder:text-slate-500/40 shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-4 bg-white border border-slate-200 rounded-[32px] text-slate-500 hover:text-slate-900 hover:bg-white transition-all">
            <Filter size={20} />
          </button>
          <button className="p-4 bg-white border border-slate-200 rounded-[32px] text-slate-500 hover:text-slate-900 hover:bg-white transition-all">
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Modals */}
      <InvoiceModal 
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onSave={(inv) => {
          onAddInvoice(inv);
          setIsInvoiceModalOpen(false);
        }}
        customers={customers}
        accounts={accounts}
      />
      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSave={(cust) => {
          onAddCustomer(cust);
          setIsCustomerModalOpen(false);
        }}
      />

      {activeSubTab === 'pipeline' && (
        <div className="pt-4">
          <SalesPipeline customers={customers} user={user} />
        </div>
      )}

      {activeSubTab === 'invoices' && (
        <div className="ledger-card p-1 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-200/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Node ID</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Custodian</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Timestamp</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap text-right">Magnitude</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">State</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="group hover:bg-slate-50/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8 font-mono font-bold text-slate-500 group-hover:text-slate-900 transition-colors">{inv.number}</td>
                    <td className="p-4 md:p-8">
                       <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-base tracking-tight">{inv.customerName}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">Identity Verified</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8">
                       <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{inv.date ? format(new Date(inv.date), 'MMM dd, yyyy') : 'N/A'}</span>
                          <span className="text-[10px] font-bold text-rose-500/60 uppercase tracking-widest mt-1">Due {inv.dueDate ? format(new Date(inv.dueDate), 'MMM dd') : 'N/A'}</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-slate-900 text-lg tracking-tighter">
                      {formatCurrency(inv.totalCents || 0)}
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
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={(e) => { e.stopPropagation(); onAddInvoice({...inv, id: '', number: `INV-${Date.now().toString().slice(-6)}`, date: format(new Date(), 'yyyy-MM-dd')}); toast.success('Duplicated invoice successfully.') }}
                           className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex items-center justify-center transition-all"
                           title="Duplicate Instrument"
                         >
                           <Plus size={14} />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onAddInvoice({...inv, status: 'paid' as any}); toast.success('Payment applied successfully.') }}
                           className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 flex items-center justify-center transition-all"
                           title="Record Payment"
                         >
                           <Check size={14} />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onAddInvoice({...inv, status: 'void' as any}); toast.success('Instrument strictly voided.') }}
                           className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 flex items-center justify-center transition-all"
                           title="Void Instrument"
                         >
                           <Trash2 size={14} />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); toast.success(`Sent late-payment reminder for invoice ${inv.number}`); }}
                           className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                           title="Email / Send Late-Payment Reminder"
                         >
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8Z"></path><polyline points="15,9 18,9 18,11"></polyline><path d="M5.5 15h.01"></path><path d="M12 15h.01"></path></svg>
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setTimeout(()=>window.print(), 200); }}
                           className="w-8 h-8 rounded-lg bg-zinc-500/10 text-zinc-600 hover:bg-zinc-500/20 flex items-center justify-center transition-all"
                           title="Print / PDF Invoice"
                         >
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onAddInvoice({...inv, status: 'void' as any}); toast.success('Written off as Bad Debt.'); }}
                           className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 flex items-center justify-center transition-all"
                           title="Write-off Bad Debt / Hold"
                         >
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/><path d="M12 9v13"/></svg>
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-20 text-center relative overflow-hidden">
                       <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
                       <div className="relative z-10 flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-slate-200/20 rounded-[32px] flex items-center justify-center text-slate-500/30">
                             <Package size={32} />
                          </div>
                          <p className="text-sm font-black text-slate-500/40 uppercase tracking-widest truncate">Zero Instrument Records Detected</p>
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
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-200/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Custodian Identity</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Communication Node</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap text-right">Aggregated Exposure</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {customers.map((cust) => (
                  <tr key={cust.id} className="group hover:bg-slate-50/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-900 rounded-[32px] flex items-center justify-center text-white font-black text-lg">
                             {(cust.name || 'CU').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 text-base tracking-tight">{cust.name}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">LTV Optimized</span>
                          </div>
                       </div>
                    </td>
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-2 group/email">
                          <Mail size={14} className="text-slate-500 opacity-40" />
                          <span className="font-bold text-slate-900 group-hover/email:text-indigo-600 transition-colors">{cust.email}</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-slate-900 text-lg tracking-tighter">
                      {formatCurrency(cust.balanceCents || 0)}
                    </td>
                    <td className="p-4 md:p-8">
                      <button className="p-3 text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 rounded-xl transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-20 text-center relative overflow-hidden">
                       <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
                       <div className="relative z-10 flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-slate-200/20 rounded-[32px] flex items-center justify-center text-slate-500/30">
                             <Users size={32} />
                          </div>
                          <p className="text-sm font-black text-slate-500/40 uppercase tracking-widest truncate">Custodian Registry Empty</p>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

