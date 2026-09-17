import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { 
  Users, 
  Mail, 
  Phone, 
  DollarSign, 
  FileText, 
  RotateCcw, 
  ArrowUpRight, 
  Calendar,
  Clock,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { isPostable, lineAmount } from '../../lib/txFilters';
import { format } from 'date-fns';
import { motion } from 'motion/react';

interface CustomerDetailViewProps {
  customerId: string;
  onBack: () => void;
}

export default function CustomerDetailView({ customerId, onBack }: CustomerDetailViewProps) {
  const customers = useLedgerStore(s => s.customers);
  const invoices = useLedgerStore(s => s.invoices);
  const payments = useLedgerStore(s => s.payments);
  const creditNotes = useLedgerStore(s => s.creditNotes);
  const transactions = useLedgerStore(s => s.transactions);
  
  const customer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);

  const activity = useMemo(() => {
    if (!customer) return [];
    
    const customerInvoices = invoices.filter(i => i.customerId === customerId).map(i => ({
      id: i.id,
      date: i.date || '',
      type: 'invoice',
      number: i.number,
      amountCents: i.amountCents,
      status: i.status,
      original: i
    }));

    const customerPayments = payments.filter(p => p.contactId === customerId).map(p => ({
      id: p.id,
      date: p.date,
      type: 'payment',
      number: p.number || p.id.substring(0, 8),
      amountCents: -p.amountCents,
      status: 'posted',
      original: p
    }));

    const customerCreditNotes = creditNotes.filter(cn => cn.customerId === customerId).map(cn => ({
      id: cn.id,
      date: cn.date,
      type: 'credit_note',
      number: cn.number,
      amountCents: -cn.amountCents,
      status: cn.status,
      original: cn
    }));

    return [...customerInvoices, ...customerPayments, ...customerCreditNotes]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customer, invoices, payments, creditNotes, customerId]);

  const stats = useMemo(() => {
    if (!customer) return { balance: 0, totalInvoiced: 0, totalPaid: 0 };
    
    const totalInvoiced = invoices
      .filter(i => i.customerId === customerId && i.status !== 'void')
      .reduce((sum, i) => sum + i.amountCents, 0);
      
    const totalPaid = payments
      .filter(p => p.contactId === customerId && p.status !== 'void')
      .reduce((sum, p) => sum + p.amountCents, 0);

    const balance = totalInvoiced - totalPaid;

    return { balance, totalInvoiced, totalPaid };
  }, [customer, invoices, payments, customerId]);

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Users className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">Customer not found</p>
        <button onClick={onBack} className="text-indigo-600 hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-[var(--text)] tracking-tighter">{customer.name}</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
                {customer.pipelineStage || 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><Mail size={14} />{customer.email || 'No email'}</span>
              <span className="flex items-center gap-1.5"><Phone size={14} />{customer.phone || 'No phone'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md">
            Create Invoice
          </button>
          <button className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            Receive Payment
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Outstanding Balance</p>
          <p className={cn(
            "text-3xl font-black tabular-nums tracking-tighter",
            stats.balance > 0 ? "text-rose-600" : "text-emerald-600"
          )}>
            {formatCurrency(stats.balance)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <Clock size={12} />
            Updated just now
          </div>
        </div>

        <div className="p-6 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Total Invoiced (LTD)</p>
          <p className="text-3xl font-black text-[var(--text)] tabular-nums tracking-tighter">
            {formatCurrency(stats.totalInvoiced)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600">
            <ArrowUpRight size={12} />
            Life-time value
          </div>
        </div>

        <div className="p-6 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Total Paid (LTD)</p>
          <p className="text-3xl font-black text-[var(--text)] tabular-nums tracking-tighter">
            {formatCurrency(stats.totalPaid)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle2 size={12} className="text-emerald-500" />
            Reliable payer
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[var(--text)] tracking-tight px-2">Activity Timeline</h3>
        <div className="bg-[var(--surface)] rounded-[32px] border border-[var(--line)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Reference</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {activity.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          item.type === 'invoice' ? "bg-blue-100 text-blue-600" :
                          item.type === 'payment' ? "bg-emerald-100 text-emerald-600" :
                          "bg-amber-100 text-amber-600"
                        )}>
                          {item.type === 'invoice' ? <FileText size={14} /> :
                           item.type === 'payment' ? <DollarSign size={14} /> :
                           <RotateCcw size={14} />}
                        </div>
                        <span className="text-xs font-bold text-[var(--text)] capitalize">
                          {item.type.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-600">
                      {item.number}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-600">
                      {item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right font-black font-mono text-sm tracking-tighter tabular-nums",
                      item.amountCents < 0 ? "text-emerald-600" : "text-[var(--text)]"
                    )}>
                      {formatCurrency(Math.abs(item.amountCents))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                        item.status === 'paid' || item.status === 'posted' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        item.status === 'overdue' ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-zinc-50 text-zinc-600 border-zinc-200"
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))}
                {activity.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic text-sm">
                      No activity recorded for this customer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
