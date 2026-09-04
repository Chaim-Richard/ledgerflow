import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { CheckCircle2, Circle, AlertTriangle, ArrowRight, BookOpen, Lock, ShieldCheck, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency } from '../../lib/utils';
import { Transaction } from '../../types';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import AsyncButton from '../ui/AsyncButton';

export default function MonthEndCloseView() {
  const transactions = useLedgerStore(s => s.transactions) || [];
  const accounts = useLedgerStore(s => s.accounts) || [];
  const bankLines = useLedgerStore(s => s.bankLines) || [];
  const invoices = useLedgerStore(s => s.invoices) || [];
  const bills = useLedgerStore(s => s.bills) || [];
  const workspaces = useAuthStore(s => s.workspaces) || [];
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const currency = currentWorkspace?.currency || 'USD';

  // State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isClosing, setIsClosing] = useState(false);
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]); // In reality, fetch from backend

  const stats = useMemo(() => {
    const periodStart = new Date(`${selectedMonth}-01T00:00:00`);
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59);

    const periodTx = transactions.filter(t => {
      const td = new Date(t.date);
      return td >= periodStart && td <= periodEnd;
    });

    const periodBankLines = bankLines.filter(l => {
      const td = new Date(l.date);
      return td >= periodStart && td <= periodEnd;
    });

    const uncategorizedCount = periodTx.filter(t => 
      t.lines.some(l => !l.accountId || l.accountId === 'uncategorized')
    ).length;

    const unreconciledBankLines = periodBankLines.filter(l => !l.matchedTransactionId).length;
    const isReconciled = periodBankLines.length > 0 && unreconciledBankLines === 0;

    // Trial balance nets to zero
    let tbNet = 0;
    periodTx.forEach(t => {
      t.lines.forEach(l => {
        tbNet += l.amountCents;
      });
    });
    const tbIsZero = Math.abs(tbNet) === 0;

    // Anomalies
    const flaggedTx = periodTx.filter(t => t.status === 'flagged').length;

    // Invoices/Bills over 60 days
    const oldUnpaid = periodTx.filter(t => 
      t.type === 'actual' && 
      (t.status === 'pending' || t.status === 'overdue') &&
      t.dueDate && new Date(t.dueDate) < new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    ).length;

    return {
      uncategorizedCount,
      unreconciledBankLines,
      isReconciled,
      tbIsZero,
      flaggedTx,
      oldUnpaid,
      periodBankLinesCount: periodBankLines.length
    };
  }, [transactions, bankLines, selectedMonth]);

  const checklist = [
    {
      id: 'import',
      title: 'Bank Accounts Imported',
      desc: stats.periodBankLinesCount > 0 ? `Imported ${stats.periodBankLinesCount} lines this period.` : 'No bank activity imported.',
      status: stats.periodBankLinesCount > 0 ? 'done' : 'pending'
    },
    {
      id: 'uncategorized',
      title: 'Categorize Transactions',
      desc: stats.uncategorizedCount === 0 ? 'All transactions categorized.' : `${stats.uncategorizedCount} transactions missing category.`,
      status: stats.uncategorizedCount === 0 ? 'done' : 'pending'
    },
    {
      id: 'reconcile',
      title: 'Bank Reconciliation',
      desc: stats.isReconciled ? 'All accounts reconciled.' : `${stats.unreconciledBankLines} lines pending match.`,
      status: stats.isReconciled ? 'done' : 'pending'
    },
    {
      id: 'trial-balance',
      title: 'Trial Balance Verification',
      desc: stats.tbIsZero ? 'Debits equal credits (nets to zero).' : 'Trial balance is out of balance!',
      status: stats.tbIsZero ? 'done' : 'error'
    },
    {
      id: 'anomalies',
      title: 'Anomaly Resolution',
      desc: stats.flaggedTx === 0 ? 'No unresolved anomalies.' : `${stats.flaggedTx} anomalies need review.`,
      status: stats.flaggedTx === 0 ? 'done' : 'warning'
    },
    {
      id: 'ar-ap',
      title: 'Aging Review',
      desc: stats.oldUnpaid === 0 ? 'No severely aged receivables/payables.' : `${stats.oldUnpaid} items > 60 days old.`,
      status: stats.oldUnpaid === 0 ? 'done' : 'warning'
    }
  ];

  const totalSteps = checklist.length;
  const completedSteps = checklist.filter(c => c.status === 'done').length;
  const isReady = completedSteps === totalSteps;

  const handleExportAccountantPackage = () => {
    try {
      const toastId = toast.loading('Compiling accountant package workbook...');
      
      const periodStart = new Date(`${selectedMonth}-01T00:00:00`);
      const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59);

      const periodTx = transactions.filter(t => {
        const td = new Date(t.date);
        return td >= periodStart && td <= periodEnd;
      });

      const wb = XLSX.utils.book_new();

      // 1. Trial Balance Sheet
      const accountMap: Record<string, { code: string; name: string; type: string; debitCents: number; creditCents: number }> = {};
      accounts.forEach(a => {
        accountMap[a.id] = {
          code: a.code || '',
          name: a.name,
          type: a.type,
          debitCents: 0,
          creditCents: 0
        };
      });

      periodTx.forEach(t => {
        t.lines.forEach(l => {
          const acc = accountMap[l.accountId] || {
            code: '',
            name: l.accountName || l.accountId || 'Unassigned',
            type: 'expense',
            debitCents: 0,
            creditCents: 0
          };
          if (l.amountCents > 0) {
            acc.debitCents += l.amountCents;
          } else {
            acc.creditCents += Math.abs(l.amountCents);
          }
          accountMap[l.accountId] = acc;
        });
      });

      const tbHeaders = ['Account Code', 'Account Name', 'Type', 'Period Debits ($)', 'Period Credits ($)', 'Net ($)'];
      const tbRows = Object.values(accountMap).map(a => [
        a.code,
        a.name,
        a.type.toUpperCase(),
        (a.debitCents / 100).toFixed(2),
        (a.creditCents / 100).toFixed(2),
        ((a.debitCents - a.creditCents) / 100).toFixed(2)
      ]);
      const wsTB = XLSX.utils.aoa_to_sheet([tbHeaders, ...tbRows]);
      XLSX.utils.book_append_sheet(wb, wsTB, "Trial Balance");

      // 2. General Ledger / Transactions
      const glHeaders = ['Date', 'Transaction ID', 'Description', 'Account Name', 'Type', 'Status', 'Amount ($)'];
      const glRows = periodTx.flatMap(t => 
        (t.lines && t.lines.length > 0 ? t.lines : [{ accountName: 'General', accountId: '', amountCents: t.totalAmountCents }]).map(l => [
          t.date,
          t.id,
          t.description,
          l.accountName || l.accountId || 'General',
          t.type || 'actual',
          t.status,
          ((l.amountCents || t.totalAmountCents || 0) / 100).toFixed(2)
        ])
      );
      const wsGL = XLSX.utils.aoa_to_sheet([glHeaders, ...glRows]);
      XLSX.utils.book_append_sheet(wb, wsGL, "General Ledger");

      // 3. Open Invoices (A/R)
      const invHeaders = ['Invoice #', 'Customer Name', 'Issue Date', 'Due Date', 'Status', 'Total ($)'];
      const invRows = invoices.map(i => [
        i.number,
        i.customerName,
        i.date,
        i.dueDate,
        i.status,
        ((i.totalCents || i.amountCents || 0) / 100).toFixed(2)
      ]);
      const wsInv = XLSX.utils.aoa_to_sheet([invHeaders, ...invRows]);
      XLSX.utils.book_append_sheet(wb, wsInv, "Invoices (AR)");

      // 4. Open Bills (A/P)
      const billHeaders = ['Bill #', 'Vendor Name', 'Issue Date', 'Due Date', 'Status', 'Amount ($)'];
      const billRows = bills.map(b => [
        b.number,
        b.vendorName,
        b.date,
        b.dueDate,
        b.status,
        ((b.amountCents || 0) / 100).toFixed(2)
      ]);
      const wsBills = XLSX.utils.aoa_to_sheet([billHeaders, ...billRows]);
      XLSX.utils.book_append_sheet(wb, wsBills, "Bills (AP)");

      // Write file
      const fileName = `Accountant_Package_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Accountant Package exported: ${fileName}`, { id: toastId });
    } catch (err: any) {
      console.error('Failed to export accountant package:', err);
      toast.error('Failed to export accountant package workbook.');
    }
  };

  const handleClosePeriod = () => {
    setIsClosing(true);
    setTimeout(() => {
      setClosedPeriods([...closedPeriods, selectedMonth]);
      setIsClosing(false);
      toast.success(`Period ${selectedMonth} locked.`);
    }, 1200);
  };

  const isClosed = closedPeriods.includes(selectedMonth);

  return (
    <div className="h-full flex flex-col bg-[var(--color-ledger-bg)]">
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-ledger-ink)] font-display tracking-tight flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                Month-End Close
              </h1>
              <p className="text-sm text-[var(--color-ledger-muted)] mt-1">
                Verify ledgers, snapshot balances, and lock the period.
              </p>
            </div>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-[var(--color-ledger-line)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
            />
          </div>

          <div className="bg-white rounded-2xl border border-[var(--color-ledger-line)] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[var(--color-ledger-line)] flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-ledger-ink)]">
                  Close Checklist — {new Date(`${selectedMonth}-01`).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    {completedSteps} of {totalSteps} complete
                  </span>
                </div>
              </div>
              {isClosed ? (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExportAccountantPackage}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg flex items-center gap-2 font-medium hover:bg-slate-50 transition-colors shadow-sm text-sm cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-600" /> Export to Accountant (.xlsx)
                  </button>
                  <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-2 font-medium">
                    <Lock className="w-4 h-4" /> Period Locked
                  </div>
                </div>
              ) : (
                <AsyncButton
                  disabled={!isReady || isClosing}
                  onClick={handleClosePeriod}
                  loadingText="Locking Period..."
                  className={`px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm flex items-center gap-2 ${
                    isReady 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Close Month
                  {!isClosing && <ArrowRight className="w-4 h-4" />}
                </AsyncButton>
              )}
            </div>

            <div className="divide-y divide-[var(--color-ledger-line)]">
              {checklist.map((item, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={item.id} 
                  className="p-5 flex items-start gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="mt-0.5">
                    {item.status === 'done' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                    {item.status === 'pending' && <Circle className="w-6 h-6 text-slate-300" />}
                    {item.status === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-500" />}
                    {item.status === 'error' && <AlertTriangle className="w-6 h-6 text-rose-500" />}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-medium ${item.status === 'done' ? 'text-slate-600' : 'text-slate-900'}`}>
                      {item.title}
                    </h3>
                    <p className={`text-sm mt-1 ${item.status === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>
                      {item.desc}
                    </p>
                  </div>
                  {item.status !== 'done' && (
                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                      Review
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
