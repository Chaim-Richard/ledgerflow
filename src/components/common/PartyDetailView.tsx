import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { 
  Users, 
  Building2,
  Mail, 
  Phone, 
  DollarSign, 
  FileText, 
  RotateCcw, 
  ArrowUpRight, 
  Clock, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { format } from 'date-fns';
import { PartySide, PARTY_SIDE_CONFIGS } from '../../config/partySides';

interface PartyDetailViewProps {
  side: PartySide;
  partyId: string;
  onBack: () => void;
}

export default function PartyDetailView({ side, partyId, onBack }: PartyDetailViewProps) {
  const config = PARTY_SIDE_CONFIGS[side];
  const customers = useLedgerStore(s => s.customers);
  const vendors = useLedgerStore(s => s.vendors);
  const invoices = useLedgerStore(s => s.invoices);
  const bills = useLedgerStore(s => s.bills);
  const payments = useLedgerStore(s => s.payments);
  const creditNotes = useLedgerStore(s => s.creditNotes || []);
  const vendorCredits = useLedgerStore(s => s.vendorCredits || []);

  const party = useMemo(() => {
    if (side === 'customer') {
      return customers.find(c => c.id === partyId);
    }
    return vendors.find(v => v.id === partyId);
  }, [side, partyId, customers, vendors]);

  const activity = useMemo(() => {
    if (!party) return [];

    if (side === 'customer') {
      const custInvoices = invoices.filter(i => i.customerId === partyId).map(i => ({
        id: i.id,
        date: i.date || '',
        type: 'invoice',
        number: i.number,
        amountCents: i.amountCents,
        status: i.status
      }));

      const custPayments = payments.filter(p => p.contactId === partyId).map(p => ({
        id: p.id,
        date: p.date,
        type: 'payment',
        number: p.number || p.id.substring(0, 8),
        amountCents: -p.amountCents,
        status: 'posted'
      }));

      const custCreditNotes = creditNotes.filter(cn => cn.customerId === partyId).map(cn => ({
        id: cn.id,
        date: cn.date,
        type: 'credit_note',
        number: cn.number,
        amountCents: -cn.amountCents,
        status: cn.status
      }));

      return [...custInvoices, ...custPayments, ...custCreditNotes]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      const vendBills = bills.filter(b => b.vendorId === partyId).map(b => ({
        id: b.id,
        date: b.date || '',
        type: 'bill',
        number: b.number,
        amountCents: b.amountCents,
        status: b.status
      }));

      const vendPayments = payments.filter(p => p.contactId === partyId).map(p => ({
        id: p.id,
        date: p.date,
        type: 'payment_made',
        number: p.number || p.id.substring(0, 8),
        amountCents: -p.amountCents,
        status: 'posted'
      }));

      const vendCredits = vendorCredits.filter(vc => vc.vendorId === partyId).map(vc => ({
        id: vc.id,
        date: vc.date,
        type: 'vendor_credit',
        number: vc.number,
        amountCents: -vc.amountCents,
        status: vc.status
      }));

      return [...vendBills, ...vendPayments, ...vendCredits]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }, [side, party, partyId, invoices, bills, payments, creditNotes, vendorCredits]);

  const stats = useMemo(() => {
    if (!party) return { balance: 0, totalDoc: 0, totalPaid: 0 };

    if (side === 'customer') {
      const totalDoc = invoices
        .filter(i => i.customerId === partyId && i.status !== 'void')
        .reduce((sum, i) => sum + i.amountCents, 0);

      const totalPaid = payments
        .filter(p => p.contactId === partyId && p.status !== 'void')
        .reduce((sum, p) => sum + p.amountCents, 0);

      const balance = totalDoc - totalPaid;

      return { balance, totalDoc, totalPaid };
    } else {
      const totalDoc = bills
        .filter(b => b.vendorId === partyId && b.status !== 'void')
        .reduce((sum, b) => sum + b.amountCents, 0);

      const totalPaid = payments
        .filter(p => p.contactId === partyId && p.status !== 'void')
        .reduce((sum, p) => sum + p.amountCents, 0);

      const balance = totalDoc - totalPaid;

      return { balance, totalDoc, totalPaid };
    }
  }, [side, party, partyId, invoices, bills, payments]);

  if (!party) {
    const Icon = side === 'customer' ? Users : Building2;
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Icon className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">{config.partySingular} not found</p>
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
              <h2 className="text-3xl font-black text-[var(--text)] tracking-tighter">{party.name}</h2>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                party.status === 'active' || party.pipelineStage === 'Active' || !party.status ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
              )}>
                {party.pipelineStage || party.status || 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><Mail size={14} />{party.email || 'No email'}</span>
              <span className="flex items-center gap-1.5"><Phone size={14} />{party.phone || 'No phone'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{config.statBalanceTitle}</p>
          <p className={cn(
            "text-3xl font-black tabular-nums tracking-tighter",
            stats.balance > 0 ? (side === 'customer' ? "text-rose-600" : "text-amber-600") : "text-emerald-600"
          )}>
            {formatCurrency(stats.balance)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <Clock size={12} />
            Updated just now
          </div>
        </div>

        <div className="p-6 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{config.statTotalDocTitle}</p>
          <p className="text-3xl font-black text-[var(--text)] tabular-nums tracking-tighter">
            {formatCurrency(stats.totalDoc)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-indigo-600">
            <ArrowUpRight size={12} />
            Life-time volume
          </div>
        </div>

        <div className="p-6 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Total Paid (LTD)</p>
          <p className="text-3xl font-black text-[var(--text)] tabular-nums tracking-tighter">
            {formatCurrency(stats.totalPaid)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck size={12} className="text-emerald-500" />
            Verified transactions
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
                          item.type === 'invoice' || item.type === 'bill' ? "bg-amber-100 text-amber-600" :
                          item.type.includes('payment') ? "bg-emerald-100 text-emerald-600" :
                          "bg-blue-100 text-blue-600"
                        )}>
                          {item.type === 'invoice' || item.type === 'bill' ? <FileText size={14} /> :
                           item.type.includes('payment') ? <DollarSign size={14} /> :
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
                      No activity recorded for this {config.partySingular.toLowerCase()}.
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
