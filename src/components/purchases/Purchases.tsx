import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Bill, Vendor, ChartAccount } from '../../types';
import { 
  Plus, 
  Search, 
  Users,
  Filter,
  Download,
  Clock,
  AlertCircle,
  Calendar,
  Zap,
  Activity,
  ShieldCheck,
  Package,
  TrendingDown,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { parseLocalDate, cn, formatCurrency } from '../../lib/utils';
import { resolveAccountRole } from '../../lib/accountUtils';
import { format, differenceInDays, addDays, startOfDay } from 'date-fns';

import BillModal from './BillModal';
import VendorModal from './VendorModal';



import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';

export default function Purchases() {
  const user = useAuthStore(s => s.user);
  const bills = useLedgerStore(s => s.bills);
  const vendors = useLedgerStore(s => s.vendors);
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const { addEntity, updateEntity } = useEntityOperations();

  const vendorBalances = useMemo(() => {
    const map: Record<string, number> = {};
    (bills || []).forEach(b => {
      if (b.vendorId && b.status !== 'paid' && b.status !== 'void') {
        map[b.vendorId] = (map[b.vendorId] || 0) + (b.amountCents || 0);
      }
    });

    // Transaction-based AP matching
    if (transactions) {
      transactions.forEach(tx => {
        if (tx.status === 'void') return;

        let apAmount = 0;
        tx.lines.forEach(l => {
          const acc = accounts?.find(a => a.id === l.accountId);
          if (acc && (resolveAccountRole(acc) === 'ap' || (acc.type === 'liability' && acc.name.toLowerCase().includes('payable')))) {
            apAmount += Math.abs(l.amountCents);
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

    return map;
  }, [bills, transactions, vendors, accounts]);
  const onAddBill = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity('bills', id, updates); } return addEntity('bills', data); };
  const onUpdateBill = (id: string, updates: any) => updateEntity('bills', id, updates);
  const onAddVendor = (data: any) => { if (data.id) { const { id, ...updates } = data; return updateEntity('vendors', id, updates); } return addEntity('vendors', data); };
  const [activeSubTab, setActiveSubTab] = useState<'bills' | 'vendors' | 'pipeline'>('pipeline');
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const agingBuckets = useMemo(() => {
    const today = startOfDay(new Date());
    const buckets = {
      current: 0,
      overdue: 0,
      due30: 0,
      due60: 0,
      due90: 0
    };

    bills.forEach(bill => {
      if (bill.status === 'paid' || bill.status === 'void') return;
      
      const dueDate = parseLocalDate(bill.dueDate);
      const daysDiff = differenceInDays(dueDate, today);

      if (daysDiff < 0) buckets.overdue += bill.amountCents;
      else if (daysDiff <= 30) buckets.due30 += bill.amountCents;
      else if (daysDiff <= 60) buckets.due60 += bill.amountCents;
      else buckets.due90 += bill.amountCents;
      
      buckets.current += bill.amountCents;
    });

    return buckets;
  }, [bills]);

  const timelineData = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, i));
    
    return days.map(day => {
      const dayBills = bills.filter(b => 
        b.status !== 'paid' && 
        format(parseLocalDate(b.dueDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );
      return {
        date: day,
        amountCents: dayBills.reduce((sum, b) => sum + b.amountCents, 0),
        count: dayBills.length
      };
    });
  }, [bills]);

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      const vendor = vendors?.find(v => v.id === b.vendorId);
      const searchStr = `${b.vendorName || ''} ${b.number || ''} ${b.tags?.join(' ') || ''} ${b.metadata ? JSON.stringify(b.metadata) : ''} ${vendor?.tags?.join(' ') || ''} ${vendor?.metadata ? JSON.stringify(vendor.metadata) : ''}`.toLowerCase();
      return searchStr.includes(term);
    }).sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
  }, [bills, vendors, searchTerm]);

  const getStatusColor = (status: Bill['status']) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'unpaid': 
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-[var(--ink)] text-zinc-650 border-[var(--line)]';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Rule Header with brand gold backdrop */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-[var(--brass)] opacity-10 rounded-full blur-3xl hidden md:block pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 text-[10px] font-mono text-[var(--brass)] font-semibold mb-2 shadow-xs">
              <TrendingDown size={12} />
              ACCOUNTS PAYABLE & EXPENSES
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">Bills & Vendor Liabilities</h1>
            <p className="text-xs text-[var(--muted)] font-medium mt-1">Manage supplier bills, expense accruals, and cash outflow schedules.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center bg-[var(--surface)]/80 p-1 rounded-xl border border-[var(--line)] shadow-inner backdrop-blur-sm">
              <button 
                onClick={() => setActiveSubTab('bills')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeSubTab === 'bills' 
                    ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Bills & AP
              </button>
              <button 
                onClick={() => setActiveSubTab('vendors')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeSubTab === 'vendors' 
                    ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Vendors & Suppliers
              </button>
            </div>
            <button 
              onClick={() => activeSubTab === 'bills' ? setIsBillModalOpen(true) : setIsVendorModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black rounded-xl text-xs font-bold hover:opacity-95 transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              {activeSubTab === 'bills' ? 'Add Bill' : 'Add Vendor'}
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
          <p className="text-2xl sm:text-3xl font-mono font-bold text-amber-600 tracking-tight relative z-10">{formatCurrency(agingBuckets.due30)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)] relative z-10">
             <Activity size={12} />
             Operational Outflow Expected
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
          <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text)] tracking-tight relative z-10">{formatCurrency(agingBuckets.due60)}</p>
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
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-semibold mb-3 relative z-10">Total Aggregate Payable</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text)] tracking-tight relative z-10">{formatCurrency(agingBuckets.current)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)] relative z-10">
             <ShieldCheck size={12} className="text-[var(--brass)]" />
             Verified System Liability
          </div>
        </motion.div>
      </div>

      {/* Timeline Visualization */}
      <div className="p-6 bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-sm relative overflow-hidden group">
        <div className="absolute technical-grid inset-0 opacity-[0.02] pointer-events-none" />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--surface)] border border-[var(--line)] rounded-xl flex items-center justify-center text-[var(--brass)] shadow-xs">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text)] tracking-tight">Disbursement Horizon</h3>
              <p className="text-xs text-[var(--muted)]">30-Day Predictive Cash Outflow Map</p>
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
                  ? "bg-[var(--brass-soft)] border border-[var(--brass-line)] text-[var(--text)] shadow-xs" 
                  : "bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] opacity-60"
              )}
            >
              <span className={cn(
                "text-[10px] font-mono uppercase font-semibold",
                day.amountCents > 0 ? "text-[var(--brass)]" : "text-[var(--muted)]"
              )}>{format(day.date, 'EEE')}</span>
              <span className="text-base font-mono font-bold">{format(day.date, 'dd')}</span>
              {day.amountCents > 0 ? (
                <div className="flex flex-col items-center pt-1 border-t border-[var(--brass-line)]/40 w-full mt-1">
                  <span className="text-[10px] font-mono font-bold text-[var(--text)]">
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

      <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
        <div className="relative group max-w-md w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-600 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search bills by vendor, number, tags, or metadata..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:bg-[var(--surface)] transition-all text-sm font-bold text-[var(--text)] placeholder:text-slate-500/40 shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              toast.info("Filter applied: Showing all active bills");
            }}
            className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-slate-500 hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all cursor-pointer" 
            aria-label="Filter action"
            title="Filter Bills"
          >
            <Filter size={20} />
          </button>
          <button 
            onClick={() => {
              const csvLines = [
                'Bill ID,Vendor,Issue Date,Due Date,Amount Cents,Status',
                ...(bills || []).map(b => `${b.id},"${b.vendorId || ''}",${b.issueDate},${b.dueDate},${b.amountCents},${b.status}`)
              ];
              const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `bills_export_${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Exported bills CSV");
            }}
            className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-slate-500 hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all cursor-pointer" 
            aria-label="Download action"
            title="Download CSV"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Modals */}
      <BillModal 
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        onSave={(bill) => {
          onAddBill(bill);
          setIsBillModalOpen(false);
        }}
        vendors={vendors}
        accounts={accounts}
      />
      <VendorModal 
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        onSave={(vend) => {
          onAddVendor(vend);
          setIsVendorModalOpen(false);
        }}
      />

      

      {activeSubTab === 'bills' && (
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
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="group hover:bg-[var(--ink)]/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8 font-mono font-bold text-slate-500 group-hover:text-[var(--text)] transition-colors">{bill.number}</td>
                    <td className="p-4 md:p-8">
                       <div className="flex flex-col">
                          <span className="font-black text-[var(--text)] text-base tracking-tight">{bill.vendorName}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">KYB Verified</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8">
                       <span className="font-bold text-[var(--text)]">{bill.date ? format(parseLocalDate(bill.date), 'MMM dd, yyyy') : 'N/A'}</span>
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex flex-col">
                        <span className={cn(
                          "font-bold text-[var(--text)]",
                          bill.status === 'overdue' && "text-rose-600"
                        )}>
                          {bill.dueDate ? format(parseLocalDate(bill.dueDate), 'MMM dd, yyyy') : 'N/A'}
                        </span>
                        {bill.status === 'unpaid' && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">
                            {differenceInDays(parseLocalDate(bill.dueDate), new Date())} T-Days Left
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-[var(--text)] text-lg tracking-tighter">
                      {formatCurrency(bill.amountCents || 0)}
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex justify-center">
                        <span className={cn(
                          "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm",
                          getStatusColor(bill.status)
                        )}>
                          {bill.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex items-center gap-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        {bill.status !== 'paid' && (
                          <button 
                            onClick={() => onUpdateBill(bill.id, { status: 'paid' })}
                            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                            title="Execute Settlement"
                          >
                            <Zap size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            const newBill = { ...bill, id: `bill-${crypto.randomUUID()}`, number: `${bill.number}-COPY`, status: 'unpaid' as any };
                            onAddBill(newBill);
                            toast.success('Liability Copied');
                          }}
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
                          title="Duplicate Instrument"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button 
                          onClick={() => onUpdateBill(bill.id, { status: 'void' })} 
                          className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-slate-500 hover:text-rose-500 transition-all"
                          title="Void Liability"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBills.length === 0 && (
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
      
      {activeSubTab === 'vendors' && (
        <div className="ledger-card p-1 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-[var(--line)]/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Supplier Profile</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Infrastructure</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap text-right">Net Liability</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {vendors.map((vend) => (
                  <tr key={vend.id} className="group hover:bg-[var(--ink)]/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-900 rounded-[32px] flex items-center justify-center text-white font-black text-xl border border-white/10 shadow-2xl">
                             {(vend.name || 'VE').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-[var(--text)] text-lg tracking-tight">{vend.name}</span>
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
                          <span className="font-bold text-[var(--text)] group-hover/email:text-indigo-600 transition-colors">{vend.email}</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-[var(--text)] text-xl tracking-tighter">
                      {formatCurrency(vendorBalances[vend.id] ?? vend.balanceCents ?? 0)}
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all justify-end">
                        
                        <button onClick={(e)=> {e.stopPropagation(); onAddBill({ vendorId: vend.id }); toast.info(`Opening bill creation for ${vend.name}`)}} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded" title="Enter Bill"><Plus size={14}/></button>
                        
                      </div>
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 && (
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
    </div>
  );
}

