import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isWithinInterval, parseISO } from 'date-fns';
import { Lock, Unlock, ShieldCheck, AlertCircle, Calendar, Plus, Trash2, History } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { db } from '../../firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc } from '../../lib/db/firestore';
import { toast } from 'sonner';
import { cn, getLocalDateISO, safeConfirm } from '../../lib/utils';
import AsyncButton from '../ui/AsyncButton';
import { motion, AnimatePresence } from 'motion/react';

export default function PeriodsView() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const periods = useLedgerStore(s => s.periods || []);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    status: 'open' as 'open' | 'closed'
  });

  const handleAddPeriod = async () => {
    if (!currentWorkspaceId) return;
    try {
      await addDoc(collection(db, 'periods'), {
        ...newPeriod,
        workspaceId: currentWorkspaceId,
        uid: user?.uid,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      toast.success('Fiscal period established');
    } catch (err) {
      toast.error('Failed to create period');
    }
  };

  const togglePeriodStatus = async (periodId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    if (newStatus === 'closed' && !(await safeConfirm('Hard closing this period will lock all postings within its date range. Proceed?'))) return;
    
    try {
      await updateDoc(doc(db, 'periods', periodId), {
        status: newStatus,
        closedAt: newStatus === 'closed' ? new Date().toISOString() : null,
        closedBy: newStatus === 'closed' ? user?.email : null,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Period ${newStatus === 'closed' ? 'Closed & Locked' : 'Re-opened'}`);
    } catch (err) {
      toast.error('Failed to update period status');
    }
  };

  const deletePeriod = async (id: string) => {
    if (!(await safeConfirm('Permanently delete this period record?'))) return;
    try {
      await deleteDoc(doc(db, 'periods', id));
      toast.success('Period removed');
    } catch (err) {
      toast.error('Failed to delete period');
    }
  };

  const handleCloseYear = async () => {
    if (!currentWorkspaceId) return;
    const closingDate = prompt('Enter the closing date (YYYY-MM-DD):', format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
    if (!closingDate) return;

    if (!(await safeConfirm(`This will generate a closing journal entry for all revenue and expense accounts as of ${closingDate}. This action is permanent. Continue?`))) return;

    try {
      const user = useAuthStore.getState().user;
      const token = user ? await user.getIdToken() : '';
      const response = await fetch('/api/v1/transactions/close-year', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: currentWorkspaceId,
          closingDate,
          lockPeriod: true
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Closing failed');
      toast.success(data.message || 'Fiscal year closed successfully');
    } catch (err: any) {
      toast.error('Closing failed: ' + err.message);
    }
  };

  const handleRunRevaluation = async () => {
    if (!currentWorkspaceId) return;
    try {
      const user = useAuthStore.getState().user;
      const token = user ? await user.getIdToken() : '';
      const response = await fetch('/api/v1/transactions/revaluation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: currentWorkspaceId
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Revaluation failed');
      toast.success(data.message || 'Revaluation completed');
    } catch (err: any) {
      toast.error('Revaluation failed: ' + err.message);
    }
  };

  const sortedPeriods = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-[var(--text)] tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-[#0047AB]" size={32} />
            Fiscal Control Center
          </h2>
          <p className="text-[var(--muted)] font-medium mt-1">Manage hard-close boundaries, FX revaluation, and year-end procedures.</p>
        </div>
        <div className="flex gap-3">
           <button 
            onClick={handleRunRevaluation}
            className="h-10 px-4 bg-white border-2 border-[var(--line)] text-slate-700 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
          >
            <History size={16} />
            Run Revaluation
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="h-10 px-4 bg-[var(--brass)] hover:opacity-90 text-black rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md"
          >
            <Plus size={16} />
            Define Period
          </button>
        </div>
      </div>

      {/* Advanced Closing Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[32px] text-white shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10">
             <Lock size={80} />
           </div>
           <h3 className="text-xl font-bold mb-2">Fiscal Year Closing</h3>
           <p className="text-indigo-200 text-xs mb-6 max-w-xs leading-relaxed">
             Transfer net income to retained earnings and lock all transactions before the closing date. This operation satisfies GAAP requirements for period permanence.
           </p>
           <button 
            onClick={handleCloseYear}
            className="px-6 py-2.5 bg-white text-indigo-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors shadow-lg"
           >
             Trigger Year-End Close
           </button>
        </div>

        <div className="p-8 bg-white dark:bg-slate-900 rounded-[32px] border-2 border-[var(--line)] shadow-sm flex flex-col justify-between">
           <div>
             <h3 className="text-xl font-bold text-[var(--text)] mb-2">Audit Verification</h3>
             <p className="text-[var(--muted)] text-xs mb-6 leading-relaxed">
               Validate ledger integrity and ensure all sub-ledgers are synchronized before locking the period.
             </p>
           </div>
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck size={12} />
                Ledger Balanced
              </span>
              <button className="text-[var(--muted)] hover:text-[var(--text)] text-xs font-bold underline decoration-[var(--brass)] decoration-2 underline-offset-4">
                View Integrity Report
              </button>
           </div>
        </div>
      </div>

      {/* Periods List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[var(--text)] tracking-tight px-2">Managed Periods</h3>
        {sortedPeriods.length === 0 ? (
          <div className="text-center py-20 bg-[var(--surface)] rounded-3xl border-2 border-dashed border-[var(--line)]">
            <Calendar className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-bold">No fiscal periods defined.</p>
            <p className="text-xs text-slate-400 mt-1">Establish your first period to start locking historical data.</p>
          </div>
        ) : (
          sortedPeriods.map(period => (
            <div key={period.id} className={cn(
              "group bg-[var(--surface)] rounded-3xl border-2 p-6 transition-all shadow-sm flex items-center justify-between",
              period.status === 'closed' ? "border-slate-200 bg-slate-50/50" : "border-[#0047AB]/20 hover:border-[#0047AB]/40"
            )}>
              <div className="flex items-center gap-5">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                  period.status === 'closed' ? "bg-slate-200 text-slate-500" : "bg-blue-50 text-[#0047AB]"
                )}>
                  {period.status === 'closed' ? <Lock size={24} /> : <Unlock size={24} />}
                </div>
                <div>
                  <h3 className="font-black text-[var(--text)] text-lg">
                    {format(parseISO(period.startDate), 'MMMM yyyy')}
                  </h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {format(parseISO(period.startDate), 'MMM d')} — {format(parseISO(period.endDate), 'MMM d, yyyy')}
                  </p>
                  {period.status === 'closed' && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-slate-400 uppercase">
                      <History size={12} />
                      Closed by {period.closedBy || 'System'} on {period.closedAt ? format(parseISO(period.closedAt), 'MMM d, h:mm a') : 'N/A'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border",
                  period.status === 'closed' 
                    ? "bg-slate-100 text-slate-500 border-slate-200" 
                    : "bg-emerald-50 text-emerald-600 border-emerald-100"
                )}>
                  {period.status === 'closed' ? 'Locked' : 'Open'}
                </div>
                
                <div className="h-8 w-px bg-slate-200 mx-2" />

                <button 
                  onClick={() => togglePeriodStatus(period.id, period.status)}
                  className={cn(
                    "h-10 px-5 rounded-xl font-bold text-xs transition-all flex items-center gap-2",
                    period.status === 'closed'
                      ? "bg-white border-2 border-slate-200 text-slate-600 hover:border-[#0047AB] hover:text-[#0047AB]"
                      : "bg-[#0047AB] text-white hover:bg-blue-800"
                  )}
                >
                  {period.status === 'closed' ? 'Re-open Period' : 'Hard Close Period'}
                </button>

                <button 
                  onClick={() => deletePeriod(period.id)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-[var(--surface)] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[var(--line)]"
            >
              <h3 className="text-xl font-black text-[var(--text)] mb-6 flex items-center gap-2">
                <Calendar className="text-[#0047AB]" />
                Define Fiscal Boundary
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Start Date</label>
                    <input 
                      type="date"
                      value={newPeriod.startDate}
                      onChange={e => setNewPeriod({...newPeriod, startDate: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--line)] text-sm font-bold focus:border-[#0047AB] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">End Date</label>
                    <input 
                      type="date"
                      value={newPeriod.endDate}
                      onChange={e => setNewPeriod({...newPeriod, endDate: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--line)] text-sm font-bold focus:border-[#0047AB] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-[var(--line)] text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <AsyncButton 
                  onClick={handleAddPeriod}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#0047AB] hover:bg-blue-800 text-white font-bold text-sm shadow-md transition-colors"
                >
                  Establish Period
                </AsyncButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
