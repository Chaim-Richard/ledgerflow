import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useUIStore } from '../../stores/useUIStore';
import { isPostable, lineAmount } from '../../lib/txFilters';
import { formatDecimal } from '../../lib/utils';
import { calculateDepreciationSchedule } from '../../lib/depreciationEngine';
import { getFiscalPeriodLabel } from '../../lib/fiscalCalendar';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, Wrench, RefreshCw, 
  FileWarning, Database, Scale, ArrowRight, Activity
} from 'lucide-react';
import { toast } from 'sonner';

export interface HealthIssue {
  id: string;
  category: 'unbalanced' | 'orphaned_account' | 'overpaid_invoice' | 'recurring_error' | 'missing_dimension' | 'trial_balance';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  fixAction?: () => void;
  fixLabel?: string;
}

export default function DataHealthView() {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const invoices = useLedgerStore(s => s.invoices);
  const recurring = useLedgerStore(s => s.recurring);
  const setActiveTab = useUIStore(s => s.setActiveTab);

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute all health issues
  const healthAnalysis = useMemo(() => {
    const issues: HealthIssue[] = [];
    const activeAccountIds = new Set(accounts.map(a => a.id));

    // 1. Check Unbalanced Transactions
    transactions.forEach(tx => {
      if (!isPostable(tx)) return;
      const lines = tx.lines || [];
      if (lines.length === 0) return;

      const lineSum = lines.reduce((sum, l) => sum + lineAmount(l), 0);
      
      if (Math.abs(lineSum) > 0.01) {
        issues.push({
          id: `unbalanced-${tx.id}`,
          category: 'unbalanced',
          severity: 'high',
          title: `Unbalanced Transaction ${tx.id}`,
          description: `Transaction line sum equals ${formatDecimal(lineSum / 100)} (expected 0.00).`,
          entityId: tx.id,
          entityType: 'transaction',
          fixLabel: 'Edit Transaction',
          fixAction: () => setActiveTab('transactions')
        });
      }
    });

    // 2. Check Orphaned Account References in Transactions
    transactions.forEach(tx => {
      (tx.lines || []).forEach(l => {
        if (l.accountId && !activeAccountIds.has(l.accountId)) {
          issues.push({
            id: `orphaned-${tx.id}-${l.accountId}`,
            category: 'orphaned_account',
            severity: 'high',
            title: `Orphaned Account Reference`,
            description: `Transaction ${tx.id} references non-existent account ID "${l.accountId}".`,
            entityId: tx.id,
            entityType: 'transaction',
            fixLabel: 'Review Accounts',
            fixAction: () => setActiveTab('ledger')
          });
        }
      });
    });

    // 3. Overpaid Invoices Check
    (invoices || []).forEach(inv => {
      const invTotal = inv.totalCents ?? inv.amountCents ?? 0;
      if (inv.amountPaidCents && inv.amountPaidCents > invTotal) {
        issues.push({
          id: `overpaid-inv-${inv.id}`,
          category: 'overpaid_invoice',
          severity: 'medium',
          title: `Overpaid Invoice ${inv.number}`,
          description: `Invoice paid amount (${formatDecimal(inv.amountPaidCents / 100)}) exceeds invoice total (${formatDecimal(invTotal / 100)}).`,
          entityId: inv.id,
          entityType: 'invoice',
          fixLabel: 'View Sales',
          fixAction: () => setActiveTab('sales')
        });
      }
    });

    // 4. Recurring Engine Failures
    (recurring || []).forEach((rule: any) => {
      if (rule.lastErrorCode || rule.status === 'failed') {
        issues.push({
          id: `recurring-err-${rule.id}`,
          category: 'recurring_error',
          severity: 'medium',
          title: `Recurring Rule Error: ${rule.name || rule.id}`,
          description: `Rule encountered an execution error: "${rule.lastErrorCode || 'Execution failure'}".`,
          entityId: rule.id,
          entityType: 'recurring',
          fixLabel: 'View Recurring',
          fixAction: () => setActiveTab('transactions')
        });
      }
    });

    // 5. Missing Required Project/Dimension Tags
    transactions.forEach(tx => {
      if (isPostable(tx) && tx.lines?.some(l => (l.amountCents || 0) > 100000 && !l.project && !tx.projectId)) {
        issues.push({
          id: `missing-dim-${tx.id}`,
          category: 'missing_dimension',
          severity: 'low',
          title: `Large Transaction Untagged`,
          description: `Transaction ${tx.id} exceeds $1,000 without a Project or Cost Center tag.`,
          entityId: tx.id,
          entityType: 'transaction',
          fixLabel: 'Tag Transaction',
          fixAction: () => setActiveTab('transactions')
        });
      }
    });

    // Health Score calculation
    const totalChecks = Math.max(1, transactions.length + accounts.length + (invoices?.length || 0));
    const penalty = issues.reduce((acc, issue) => {
      if (issue.severity === 'high') return acc + 10;
      if (issue.severity === 'medium') return acc + 5;
      return acc + 2;
    }, 0);

    const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / totalChecks) * 100)));

    return { issues, score, totalChecks };
  }, [transactions, accounts, invoices, recurring, setActiveTab]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Data Health Diagnostic Complete', {
        description: `Scanned ${healthAnalysis.totalChecks} records. Health Score: ${healthAnalysis.score}%`
      });
    }, 600);
  };

  const filteredIssues = useMemo(() => {
    if (filterCategory === 'all') return healthAnalysis.issues;
    return healthAnalysis.issues.filter(i => i.category === filterCategory);
  }, [healthAnalysis.issues, filterCategory]);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Data Health & Ledger Integrity</h1>
            <p className="text-xs text-slate-500 font-medium">Real-time diagnostic monitor for accounting balance, orphaned records, and recurring rule failures</p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Run Integrity Audit</span>
        </button>
      </div>

      {/* Health Score Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl ${
            healthAnalysis.score >= 90 ? 'bg-emerald-100 text-emerald-700' : healthAnalysis.score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
          }`}>
            {healthAnalysis.score}%
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Health Score</h3>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {healthAnalysis.score >= 90 ? 'Pristine Ledger' : healthAnalysis.score >= 70 ? 'Requires Attention' : 'Critical Issues Found'}
            </p>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">High Severity</span>
            <AlertTriangle size={16} className="text-rose-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {healthAnalysis.issues.filter(i => i.severity === 'high').length}
          </p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Medium Severity</span>
            <FileWarning size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {healthAnalysis.issues.filter(i => i.severity === 'medium').length}
          </p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Passed Checks</span>
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {Math.max(0, healthAnalysis.totalChecks - healthAnalysis.issues.length)}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {[
          { id: 'all', label: `All Issues (${healthAnalysis.issues.length})` },
          { id: 'unbalanced', label: 'Unbalanced Entries' },
          { id: 'orphaned_account', label: 'Orphaned Accounts' },
          { id: 'overpaid_invoice', label: 'Invoice Anomalies' },
          { id: 'recurring_error', label: 'Recurring Engine' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterCategory(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              filterCategory === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Integrity Anomalies Detected</h3>
          <p className="text-xs text-slate-500 mt-1">Your double-entry ledger is balanced, all account links are valid, and rules are executing smoothly.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map(issue => (
            <div
              key={issue.id}
              className={`p-5 bg-white border rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                issue.severity === 'high' ? 'border-rose-200 bg-rose-50/20' : issue.severity === 'medium' ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  issue.severity === 'high' ? 'bg-rose-100 text-rose-600' : issue.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <AlertTriangle size={18} />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{issue.title}</h4>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      issue.severity === 'high' ? 'bg-rose-100 text-rose-700' : issue.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{issue.description}</p>
                </div>
              </div>

              {issue.fixAction && (
                <button
                  onClick={issue.fixAction}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Wrench size={13} />
                  <span>{issue.fixLabel || 'Fix Issue'}</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
