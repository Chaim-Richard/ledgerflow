import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { 
  Calendar, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  ShieldCheck,
  History,
  Settings2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO, addMonths, subMonths } from 'date-fns';
import { cn, formatCurrency, getLocalDateISO } from '../../lib/utils';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { LedgerPostService } from '../../services/LedgerPostService';
import { isPostable, calculateTransactionImpact } from '../../lib/txFilters';

export default function FiscalPeriodManager() {
  const { updateEntity } = useEntityOperations();
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const workspaces = useAuthStore(s => s.workspaces);
  const workspace = workspaces.find(w => w.id === currentWorkspaceId);
  
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const lockDate = useLedgerStore(s => s.lockDate);

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  // Derive periods for the last 12 months + current
  const periods = useMemo(() => {
    const list = [];
    let curr = startOfMonth(new Date());
    for (let i = 0; i < 18; i++) {
      const pId = format(curr, 'yyyy-MM');
      const isLocked = lockDate ? pId <= lockDate.substring(0, 7) : false;
      list.push({
        id: pId,
        label: format(curr, 'MMMM yyyy'),
        startDate: format(startOfMonth(curr), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(curr), 'yyyy-MM-dd'),
        isLocked
      });
      curr = subMonths(curr, 1);
    }
    return list;
  }, [lockDate]);

  const handleSetLockDate = async (date: string | null) => {
    if (!currentWorkspaceId) return;
    setIsProcessing(true);
    try {
      await updateEntity('workspaces', currentWorkspaceId, {
        lockDate: date,
        updatedAt: new Date().toISOString()
      }, `Period lock updated to ${date || 'Open'}`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const runPeriodAudit = (period: any) => {
    const periodTxs = transactions.filter(t => 
      isPostable(t) && 
      t.date >= period.startDate && 
      t.date <= period.endDate
    );

    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const totalImpact = periodTxs.reduce((sum, t) => sum + calculateTransactionImpact(t, accountMap), 0);
    
    // Check for unbalanced JEs in this period
    const unbalanced = periodTxs.filter(t => {
      const sum = (t.lines || []).reduce((s, l) => s + (l.amountCents || 0), 0);
      return Math.abs(sum) > 0;
    });

    return {
      txCount: periodTxs.length,
      netImpact: totalImpact,
      isBalanced: unbalanced.length === 0,
      unbalancedCount: unbalanced.length
    };
  };

  const handleClosePeriod = async (period: any) => {
    const audit = runPeriodAudit(period);
    
    if (!audit.isBalanced) {
      toast.error(`Cannot close period: Found ${audit.unbalancedCount} unbalanced transactions.`);
      return;
    }

    if (audit.txCount === 0) {
      toast.warning("Closing an empty period. No transactions found.");
    }

    await handleSetLockDate(period.endDate);
    setSelectedPeriod(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[var(--color-ledger-line)] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-indigo-600" />
            Fiscal Periods & Hard Close
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage accounting periods and enforce immutable record locking for finalized cycles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Active Lock Date:</span>
            <span className="text-xs font-mono font-bold text-slate-900">{lockDate || 'NONE'}</span>
          </div>
          {lockDate && (
            <button 
              onClick={() => handleSetLockDate(null)}
              disabled={isProcessing}
              className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
              title="Unlock All Periods"
            >
              <Unlock className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Period List */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 px-1">Accounting Cycles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {periods.map(p => (
              <div 
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                  p.isLocked 
                    ? "bg-slate-50 border-slate-200 opacity-80" 
                    : "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md",
                  selectedPeriod === p.id && "ring-2 ring-indigo-500 border-transparent shadow-lg"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "p-2 rounded-lg",
                      p.isLocked ? "bg-slate-200 text-slate-500" : "bg-indigo-50 text-indigo-600"
                    )}>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{p.label}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        {p.startDate} — {p.endDate}
                      </p>
                    </div>
                  </div>
                  {p.isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                    p.isLocked ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {p.isLocked ? 'Closed' : 'Open Cycle'}
                  </span>
                  
                  {!p.isLocked && (
                    <button className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Close Period <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit & Action Sidebar */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-[var(--color-ledger-line)] shadow-xs sticky top-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              Period Closing Audit
            </h3>

            {selectedPeriod ? (
              <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase">Target: {periods.find(p => p.id === selectedPeriod)?.label}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Total Transactions</span>
                      <span className="text-xs font-mono font-bold">{runPeriodAudit(periods.find(p => p.id === selectedPeriod)).txCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Net Period Impact</span>
                      <span className={cn(
                        "text-xs font-mono font-bold",
                        runPeriodAudit(periods.find(p => p.id === selectedPeriod)).netImpact >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {formatCurrency(runPeriodAudit(periods.find(p => p.id === selectedPeriod)).netImpact)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-xs font-bold text-slate-900">Integrity Check</span>
                      {runPeriodAudit(periods.find(p => p.id === selectedPeriod)).isBalanced ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase">Balanced</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-rose-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase">Unbalanced</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    disabled={isProcessing || periods.find(p => p.id === selectedPeriod)?.isLocked}
                    onClick={() => handleClosePeriod(periods.find(p => p.id === selectedPeriod))}
                    className="w-full py-3 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Hard Close Period
                  </button>
                  <p className="text-[10px] text-center text-slate-400 italic px-2">
                    Closing a period prevents any future modifications or deletions of transactions within this cycle.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium">Select a period to run audit and initiate closing.</p>
              </div>
            )}
          </div>

          <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <FileText className="w-24 h-24 rotate-12" />
            </div>
            <h4 className="text-sm font-bold mb-2 relative z-10">Year-End Close</h4>
            <p className="text-xs text-indigo-100 mb-4 relative z-10 leading-relaxed">
              Performing a year-end close resets temporary accounts (Revenue/Expense) and shifts net income to Retained Earnings.
            </p>
            <button className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg border border-white/20 transition-all cursor-pointer relative z-10">
              Run Year-End Wizard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
