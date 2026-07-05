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
import { cn, formatCurrency } from '../../lib/utils';
import { format, differenceInDays, addDays, startOfDay } from 'date-fns';

import BillModal from './BillModal';
import VendorModal from './VendorModal';
import PurchasePipeline from './PurchasePipeline';

interface PurchasesProps {
  user: User;
  bills: Bill[];
  vendors: Vendor[];
  accounts: ChartAccount[];
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
  onAddBill: (bill: Partial<Bill>) => void;
  onAddVendor: (vendor: Partial<Vendor>) => void;
}

export default function Purchases({ 
  user, 
  bills = [], 
  vendors = [], 
  accounts = [], 
  onUpdateBill, 
  onAddBill, 
  onAddVendor 
}: PurchasesProps) {
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
      if (bill.status === 'paid') return;
      
      const dueDate = new Date(bill.dueDate);
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
        format(new Date(b.dueDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );
      return {
        date: day,
        amountCents: dayBills.reduce((sum, b) => sum + b.amountCents, 0),
        count: dayBills.length
      };
    });
  }, [bills]);

  const filteredBills = useMemo(() => {
    return bills.filter(b => 
      (b.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (b.number?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [bills, searchTerm]);

  const getStatusColor = (status: Bill['status']) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'unpaid': 
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-zinc-50 text-zinc-650 border-zinc-200';
    }
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Neural Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate mb-4">
            <TrendingDown size={14} />
            Liability Management System
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Outflow Matrix</h2>
          <p className="text-slate-500 font-medium text-lg mt-2 italic opacity-60">Strategic optimization of accounts payable and vendor liquidity chains.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           <div className="flex flex-wrap bg-slate-50 p-1.5 rounded-[32px] border border-slate-200">
            <button 
              onClick={() => setActiveSubTab('pipeline')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
                activeSubTab === 'pipeline' ? "bg-indigo-600 text-white shadow-lg shadow-ledger-accent/20" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Procurement Board
            </button>
            <button 
              onClick={() => setActiveSubTab('bills')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
                activeSubTab === 'bills' ? "bg-indigo-600 text-white shadow-lg shadow-ledger-accent/20" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Liabilities
            </button>
            <button 
              onClick={() => setActiveSubTab('vendors')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
                activeSubTab === 'vendors' ? "bg-indigo-600 text-white shadow-lg shadow-ledger-accent/20" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Suppliers
            </button>
          </div>
          <button 
            onClick={() => activeSubTab === 'bills' ? setIsBillModalOpen(true) : setIsVendorModalOpen(true)}
            className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-[32px] text-xs font-medium uppercase tracking-wider hover:bg-slate-900/90 transition-all shadow-2xl"
          >
            <Plus size={18} />
            {activeSubTab === 'bills' ? 'Capture Bill' : 'Onboard Supplier'}
          </button>
        </div>
      </div>

      {/* Psychological Header: Aging Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 md:p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-4 relative z-10">Critical Overdue</p>
          <p className="text-2xl md:text-4xl font-black text-rose-600 font-mono tracking-tighter relative z-10">{formatCurrency(agingBuckets.overdue)}</p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-40">
             <AlertCircle size={10} />
             Immediate Disbursement Priority
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 md:p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-4 relative z-10">Short-Term (30d)</p>
          <p className="text-2xl md:text-4xl font-black text-amber-600 font-mono tracking-tighter relative z-10">{formatCurrency(agingBuckets.due30)}</p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-40">
             <Activity size={10} />
             Operational Outflow Expected
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 md:p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute technical-grid inset-0 opacity-5 pointer-events-none" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 relative z-10">Mid-Term (30-60d)</p>
          <p className="text-2xl md:text-4xl font-black text-slate-900 font-mono tracking-tighter relative z-10">{formatCurrency(agingBuckets.due60)}</p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-40">
             <Clock size={10} />
             Liquidity Forecast Cluster
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 md:p-8 bg-slate-900 text-white rounded-[32px] shadow-2xl relative overflow-hidden group border border-white/5"
        >
          <div className="absolute technical-grid inset-0 opacity-10 pointer-events-none" />
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4 relative z-10">Total Aggregate Payable</p>
          <p className="text-2xl md:text-4xl font-black text-indigo-600 font-mono tracking-tighter relative z-10">{formatCurrency(agingBuckets.current)}</p>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-white/20 uppercase tracking-widest">
             <ShieldCheck size={10} />
             Verified System Liability
          </div>
        </motion.div>
      </div>

      {/* Timeline Visualization */}
      <div className="ledger-card p-4 md:p-10 rounded-[32px] relative overflow-hidden group">
        <div className="absolute technical-grid inset-0 opacity-[0.02] pointer-events-none" />
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-[32px] flex items-center justify-center text-indigo-600 border border-white/5 shadow-2xl">
              <Calendar size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Disbursement Horizon</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 opacity-50">30-Day Predictive Cash Outflow Map</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar px-2">
          {timelineData.map((day, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5, scale: 1.02 }}
              className={cn(
                "flex-shrink-0 w-24 flex flex-col items-center gap-3 p-5 rounded-[32px] transition-all relative overflow-hidden",
                day.amountCents > 0 
                  ? "bg-slate-900 text-white border border-white/10 shadow-2xl" 
                  : "bg-white border border-slate-200 opacity-60"
              )}
            >
              <span className={cn(
                "text-[10px] font-medium uppercase tracking-wider",
                day.amountCents > 0 ? "text-indigo-600" : "text-slate-500"
              )}>{format(day.date, 'EEE')}</span>
              <span className="text-xl font-black italic">{format(day.date, 'dd')}</span>
              {day.amountCents > 0 ? (
                <div className="flex flex-col items-center pt-2 border-t border-white/10 w-full mt-2">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse shadow-[0_0_10px_#10b981] mb-2" />
                  <span className="text-[11px] font-black font-mono tracking-tighter text-white">
                    ${(day.amountCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ) : (
                <div className="w-full pt-4 mt-2 border-t border-slate-200 flex justify-center">
                   <div className="w-1 h-1 bg-slate-200 rounded-full" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="relative group max-w-md w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-600 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search payables by node or vendor..." 
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

      {activeSubTab === 'pipeline' && (
        <div className="pt-4">
          <PurchasePipeline bills={bills} onUpdateBill={onUpdateBill} />
        </div>
      )}

      {activeSubTab === 'bills' && (
        <div className="ledger-card p-1 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-200/50">
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
                  <tr key={bill.id} className="group hover:bg-slate-50/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8 font-mono font-bold text-slate-500 group-hover:text-slate-900 transition-colors">{bill.number}</td>
                    <td className="p-4 md:p-8">
                       <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-base tracking-tight">{bill.vendorName}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">KYB Verified</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8">
                       <span className="font-bold text-slate-900">{bill.date ? format(new Date(bill.date), 'MMM dd, yyyy') : 'N/A'}</span>
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex flex-col">
                        <span className={cn(
                          "font-bold text-slate-900",
                          bill.status === 'overdue' && "text-rose-600"
                        )}>
                          {bill.dueDate ? format(new Date(bill.dueDate), 'MMM dd, yyyy') : 'N/A'}
                        </span>
                        {bill.status === 'unpaid' && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">
                            {differenceInDays(new Date(bill.dueDate), new Date())} T-Days Left
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-slate-900 text-lg tracking-tighter">
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
                      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
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
                            const newBill = { ...bill, id: `bill-${Date.now()}`, number: `${bill.number}-COPY`, status: 'unpaid' as any };
                            onAddBill(newBill);
                            toast.success('Liability Copied');
                          }}
                          className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-all"
                          title="Duplicate Instrument"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button 
                          onClick={() => onUpdateBill(bill.id, { status: 'void' })} 
                          className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-rose-500 transition-all"
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
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-200/50">
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Supplier Profile</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Infrastructure</th>
                  <th className="p-4 md:p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap text-right">Net Liability</th>
                  <th className="p-4 md:p-8 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-line/30">
                {vendors.map((vend) => (
                  <tr key={vend.id} className="group hover:bg-slate-50/30 transition-all cursor-pointer">
                    <td className="p-4 md:p-8">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-900 rounded-[32px] flex items-center justify-center text-white font-black text-xl border border-white/10 shadow-2xl">
                             {(vend.name || 'VE').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 text-lg tracking-tight">{vend.name}</span>
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
                          <span className="font-bold text-slate-900 group-hover/email:text-indigo-600 transition-colors">{vend.email}</span>
                       </div>
                    </td>
                    <td className="p-4 md:p-8 text-right font-black font-mono text-slate-900 text-xl tracking-tighter">
                      {formatCurrency(vend.balanceCents || 0)}
                    </td>
                    <td className="p-4 md:p-8">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all justify-end">
                        <button onClick={(e)=>{e.stopPropagation(); alert('Creating vendor payment...')}} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded" title="Make Payment"><Zap size={14}/></button>
                        <button onClick={(e)=>{e.stopPropagation(); alert('Entering new bill...')}} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded" title="Enter Bill"><Plus size={14}/></button>
                        <button onClick={(e)=>{e.stopPropagation(); alert('Blocked vendor.')}} className="p-2 text-rose-500 hover:bg-rose-50 rounded" title="Block/Deactivate"><Trash2 size={14}/></button>
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

