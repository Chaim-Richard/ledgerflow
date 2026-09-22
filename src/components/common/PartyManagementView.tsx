import React, { useState, useMemo } from 'react';
import { PartySide, PARTY_SIDE_CONFIGS } from '../../config/partySides';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { 
  Plus, 
  Search, 
  Users, 
  Building2,
  Filter, 
  Download, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Activity, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  DollarSign 
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { parseLocalDate, cn, formatCurrency } from '../../lib/utils';
import { resolveAccountRole } from '../../lib/accountUtils';
import { isPostable, lineAmount, isOpenInvoice, isOpenBill } from '../../lib/txFilters';
import { format, differenceInDays, addDays, startOfDay } from 'date-fns';

import PartyModal from './PartyModal';
import PartyDetailView from './PartyDetailView';
import ReceivePaymentModal from '../sales/ReceivePaymentModal';
import InvoiceModal from '../sales/InvoiceModal';
import BillModal from '../purchases/BillModal';
import { EmptyState } from '../ui/EmptyState';

interface PartyManagementViewProps {
  side: PartySide;
}

export default function PartyManagementView({ side }: PartyManagementViewProps) {
  const config = PARTY_SIDE_CONFIGS[side];
  const invoices = useLedgerStore(s => s.invoices);
  const bills = useLedgerStore(s => s.bills);
  const customers = useLedgerStore(s => s.customers);
  const vendors = useLedgerStore(s => s.vendors);
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const { addEntity, updateEntity } = useEntityOperations();

  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'docs' | 'parties' | 'pipeline'>('pipeline');
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [paymentDocumentId, setPaymentDocumentId] = useState<string | null>(null);
  const [paymentContactId, setPaymentContactId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const documents = side === 'customer' ? invoices : bills;
  const parties = side === 'customer' ? customers : vendors;

  const partyBalances = useMemo(() => {
    const map: Record<string, number> = {};
    if (side === 'customer') {
      (invoices || []).forEach(inv => {
        if (inv.customerId && isOpenInvoice(inv)) {
          map[inv.customerId] = (map[inv.customerId] || 0) + lineAmount(inv as any);
        }
      });
      if (transactions) {
        transactions.filter(isPostable).forEach(tx => {
          let arAmount = 0;
          tx.lines?.forEach(l => {
            const acc = accounts?.find(a => a.id === l.accountId);
            if (acc && (resolveAccountRole(acc) === 'ar' || (acc.type === 'asset' && acc.name.toLowerCase().includes('receivable')))) {
              arAmount += lineAmount(l, tx);
            }
          });
          if (arAmount > 0) {
            const matchedCust = customers?.find(c => tx.payee?.toLowerCase() === c.name.toLowerCase() || tx.description?.toLowerCase().includes(c.name.toLowerCase()));
            if (matchedCust) {
              map[matchedCust.id] = (map[matchedCust.id] || 0) + arAmount;
            }
          }
        });
      }
    } else {
      (bills || []).forEach(b => {
        if (b.vendorId && isOpenBill(b)) {
          map[b.vendorId] = (map[b.vendorId] || 0) + lineAmount(b as any);
        }
      });
      if (transactions) {
        transactions.filter(isPostable).forEach(tx => {
          let apAmount = 0;
          tx.lines?.forEach(l => {
            const acc = accounts?.find(a => a.id === l.accountId);
            if (acc && (resolveAccountRole(acc) === 'ap' || (acc.type === 'liability' && acc.name.toLowerCase().includes('payable')))) {
              apAmount += Math.abs(lineAmount(l, tx));
            }
          });
          if (apAmount > 0) {
            const matchedVend = vendors?.find(v => tx.payee?.toLowerCase() === v.name.toLowerCase() || tx.description?.toLowerCase().includes(v.name.toLowerCase()));
            if (matchedVend) {
              map[matchedVend.id] = (map[matchedVend.id] || 0) + apAmount;
            }
          }
        });
      }
    }
    return map;
  }, [side, invoices, bills, transactions, customers, vendors, accounts]);

  const onAddDoc = (data: any) => {
    const entityKey = config.storeDocKey;
    if (data.id) {
      const { id, ...updates } = data;
      return updateEntity(entityKey, id, updates);
    }
    return addEntity(entityKey, data);
  };

  const onUpdateDoc = (id: string, updates: any) => updateEntity(config.storeDocKey, id, updates);
  const onAddParty = (data: any) => {
    const entityKey = config.storeEntityKey;
    if (data.id) {
      const { id, ...updates } = data;
      return updateEntity(entityKey, id, updates);
    }
    return addEntity(entityKey, data);
  };

  const agingBuckets = useMemo(() => {
    const today = startOfDay(new Date());
    const buckets = { current: 0, overdue: 0, due30: 0, due60: 0, due90: 0 };

    documents.forEach((doc: any) => {
      const isOpen = side === 'customer' ? isOpenInvoice(doc) : isOpenBill(doc);
      if (!isOpen) return;

      const dueDate = parseLocalDate(doc.dueDate);
      const daysDiff = differenceInDays(dueDate, today);
      const amt = lineAmount(doc);

      if (daysDiff < 0) buckets.overdue += amt;
      else if (daysDiff <= 30) buckets.due30 += amt;
      else if (daysDiff <= 60) buckets.due60 += amt;
      else buckets.due90 += amt;

      buckets.current += amt;
    });

    return buckets;
  }, [side, documents]);

  const timelineData = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, i));

    return days.map(day => {
      const dayDocs = documents.filter((d: any) => {
        const isOpen = side === 'customer' ? isOpenInvoice(d) : isOpenBill(d);
        return isOpen && format(parseLocalDate(d.dueDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      return {
        date: day,
        amountCents: dayDocs.reduce((sum, d) => sum + lineAmount(d as any), 0),
        count: dayDocs.length
      };
    });
  }, [side, documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter((d: any) => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      const partyName = side === 'customer' ? (d.customerName || '') : (d.vendorName || '');
      const partyId = side === 'customer' ? d.customerId : d.vendorId;
      const pObj = parties?.find((p: any) => p.id === partyId);
      const searchStr = `${partyName} ${d.number || ''} ${d.tags?.join(' ') || ''} ${d.metadata ? JSON.stringify(d.metadata) : ''} ${pObj?.tags?.join(' ') || ''} ${pObj?.metadata ? JSON.stringify(pObj.metadata) : ''}`.toLowerCase();
      return searchStr.includes(term);
    }).sort((a: any, b: any) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
  }, [side, documents, parties, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'unpaid': 
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-[var(--ink)] text-zinc-650 border-[var(--line)]';
    }
  };

  if (selectedPartyId) {
    return <PartyDetailView side={side} partyId={selectedPartyId} onBack={() => setSelectedPartyId(null)} />;
  }

  const HeaderIcon = side === 'customer' ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--line)] shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-mono text-indigo-700 font-semibold mb-2 shadow-xs">
              <HeaderIcon size={12} />
              {config.badgeLabel}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">{config.title}</h1>
            <p className="text-xs text-[var(--muted)] font-medium mt-1">{config.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center bg-[var(--surface)]/80 p-1 rounded-xl border border-[var(--line)] shadow-inner backdrop-blur-sm">
              <button 
                onClick={() => setActiveSubTab('docs')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeSubTab === 'docs' 
                    ? "bg-slate-900 text-white font-bold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                {config.subTabDocLabel}
              </button>
              <button 
                onClick={() => setActiveSubTab('parties')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeSubTab === 'parties' 
                    ? "bg-slate-900 text-white font-bold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                {config.subTabPartyLabel}
              </button>
            </div>
            <button 
              onClick={() => activeSubTab === 'docs' ? setIsDocModalOpen(true) : setIsPartyModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              {activeSubTab === 'docs' ? `Add ${config.documentSingular}` : `Add ${config.partySingular}`}
            </button>
          </div>
        </div>
      </div>

      {/* Aging KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-widest text-rose-500 font-semibold mb-3">Critical Overdue</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-rose-600 tracking-tight tabular-nums">{formatCurrency(agingBuckets.overdue)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
             <AlertCircle size={12} /> Priority Focus
          </div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-semibold mb-3">Short-Term (30d)</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-amber-600 tracking-tight tabular-nums">{formatCurrency(agingBuckets.due30)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
             <Activity size={12} /> Expected Cashflow
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-semibold mb-3">Mid-Term (30-60d)</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text)] tracking-tight tabular-nums">{formatCurrency(agingBuckets.due60)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
             <Clock size={12} /> Forecast Horizon
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-semibold mb-3">Total Aggregate</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text)] tracking-tight tabular-nums">{formatCurrency(agingBuckets.current)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
             <ShieldCheck size={12} className="text-indigo-600" /> Active System Balance
          </div>
        </motion.div>
      </div>

      {/* Timeline Map */}
      <div className="p-6 bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--surface)] border border-[var(--line)] rounded-xl flex items-center justify-center text-indigo-600 shadow-xs">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text)] tracking-tight">30-Day Predictive Cashflow Horizon</h3>
              <p className="text-xs text-[var(--muted)]">Scheduled maturity timeline</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
          {timelineData.map((day, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -2 }}
              className={cn(
                "flex-shrink-0 w-20 flex flex-col items-center gap-2 p-3 rounded-xl transition-all relative overflow-hidden",
                day.amountCents > 0 
                  ? "bg-indigo-50/50 border border-indigo-200 text-[var(--text)] shadow-xs" 
                  : "bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] opacity-60"
              )}
            >
              <span className="text-[10px] font-mono uppercase font-semibold text-indigo-600">{format(day.date, 'EEE')}</span>
              <span className="text-base font-mono font-bold">{format(day.date, 'dd')}</span>
              {day.amountCents > 0 ? (
                <div className="flex flex-col items-center pt-1 border-t border-indigo-200 w-full mt-1">
                  <span className="text-[10px] font-mono font-bold text-[var(--text)] tabular-nums">
                    ${(day.amountCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ) : (
                <div className="w-full pt-4 mt-2 border-t border-[var(--line)] flex justify-center">
                   <div className="w-1 h-1 bg-slate-200 rounded-full" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
        <div className="relative group max-w-md w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder={`Search ${config.documentPlural.toLowerCase()} or ${config.partyPlural.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600/20 text-sm font-bold text-[var(--text)] shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const csvLines = [
                `ID,Party,Date,DueDate,AmountCents,Status`,
                ...(documents || []).map((d: any) => `${d.id},"${d.customerName || d.vendorName || ''}",${d.date || ''},${d.dueDate || ''},${d.amountCents},${d.status}`)
              ];
              const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${config.side}_documents_export_${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${config.documentPlural} CSV`);
            }}
            className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-slate-500 hover:text-[var(--text)] transition-all cursor-pointer" 
            aria-label="Download action"
            title="Download CSV"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Modals */}
      {side === 'customer' ? (
        <InvoiceModal 
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          onSave={(inv) => { onAddDoc(inv); setIsDocModalOpen(false); }}
          customers={customers}
          accounts={accounts}
        />
      ) : (
        <BillModal 
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          onSave={(bill) => { onAddDoc(bill); setIsDocModalOpen(false); }}
          vendors={vendors}
          accounts={accounts}
        />
      )}

      <PartyModal 
        side={side}
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        onSave={(party) => { onAddParty(party); setIsPartyModalOpen(false); }}
      />

      {isPaymentModalOpen && paymentDocumentId && paymentContactId && (
        <ReceivePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          defaultDirection={config.paymentDirection}
          defaultDocumentId={paymentDocumentId}
          defaultContactId={paymentContactId}
        />
      )}

      {/* Documents Table */}
      {activeSubTab === 'docs' && (
        <div className="ledger-card p-1 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-[var(--line)]/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Number</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">{config.partySingular}</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Date</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Due Date</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Amount</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Status</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {filteredDocs.map((doc: any) => (
                  <tr key={doc.id} className="group hover:bg-[var(--ink)]/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8 font-mono font-bold text-slate-500 group-hover:text-[var(--text)]">{doc.number}</td>
                    <td className="p-4 md:p-8">
                       <span className="font-black text-[var(--text)] text-base tracking-tight">{doc.customerName || doc.vendorName}</span>
                    </td>
                    <td className="p-4 md:p-8">
                       <span className="font-bold text-[var(--text)]">{doc.date ? format(parseLocalDate(doc.date), 'MMM dd, yyyy') : 'N/A'}</span>
                    </td>
                    <td className="p-4 md:p-8">
                      <span className={cn("font-bold text-[var(--text)]", doc.status === 'overdue' && "text-rose-600")}>
                        {doc.dueDate ? format(parseLocalDate(doc.dueDate), 'MMM dd, yyyy') : 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-[var(--text)] text-lg tabular-nums">
                      {formatCurrency(doc.amountCents || 0)}
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex justify-center">
                        <span className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm", getStatusColor(doc.status))}>
                          {doc.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex items-center gap-3">
                        {doc.status !== 'paid' && (
                          <button 
                            onClick={() => {
                              const pId = doc.customerId || doc.vendorId;
                              if (pId) {
                                setPaymentContactId(pId);
                                setPaymentDocumentId(doc.id);
                                setIsPaymentModalOpen(true);
                              } else {
                                toast.error(`${config.documentSingular} is missing a ${config.partySingular.toLowerCase()}.`);
                              }
                            }}
                            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                            title="Process Payment"
                          >
                            <DollarSign size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => onUpdateDoc(doc.id, { status: 'void' })} 
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-rose-500 transition-all"
                          title="Void Document"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12">
                      <EmptyState 
                        title={`No ${config.documentPlural} Detected`}
                        description={`There are currently no ${config.documentPlural.toLowerCase()} in this view.`}
                        actionLabel={`RECORD ${config.documentSingular.toUpperCase()}`}
                        onAction={() => setIsDocModalOpen(true)}
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

      {/* Parties Table */}
      {activeSubTab === 'parties' && (
        <div className="ledger-card p-1 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-[var(--line)]/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">{config.partySingular} Profile</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Contact</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap text-right">Net Balance</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {parties.map((p: any) => (
                  <tr key={p.id} onClick={() => setSelectedPartyId(p.id)} className="group hover:bg-[var(--ink)]/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-900 rounded-[32px] flex items-center justify-center text-white font-black text-xl border border-white/10 shadow-2xl">
                             {(p.name || 'PT').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-[var(--text)] text-lg tracking-tight">{p.name}</span>
                          </div>
                       </div>
                    </td>
                    <td className="p-4 md:p-8">
                       <span className="font-bold text-[var(--text)]">{p.email || 'No email'}</span>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-[var(--text)] text-xl tabular-nums">
                      {formatCurrency(partyBalances[p.id] ?? p.balanceCents ?? 0)}
                    </td>
                    <td className="p-4 md:p-8 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setIsDocModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"><Plus size={14} /></button>
                    </td>
                  </tr>
                ))}
                {parties.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-500">
                      No {config.partyPlural.toLowerCase()} registered yet.
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
