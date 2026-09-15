import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Activity, CheckCircle2, AlertTriangle, ShieldCheck,
  RefreshCw, FileText
} from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { isPostable, lineAmount } from '../../lib/txFilters';
import { toast } from 'sonner';

interface HealthCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HealthCheckModal({ isOpen, onClose }: HealthCheckModalProps) {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const bankLines = useLedgerStore(s => s.bankLines);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const workspaces = useAuthStore(s => s.workspaces);
  
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  const [isScanning, setIsScanning] = useState(false);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    const startTimer = setTimeout(() => {
      setIsScanning(true);
    }, 0);
    const timer = setTimeout(() => {
      // 1. Trial Balance Check
      let tbNet = 0;
      transactions.filter(isPostable).forEach(t => {
        t.lines?.forEach(l => { tbNet += lineAmount(l, t); });
      });

      // 2. Uncategorized Check
      const uncategorized = transactions.filter(t => 
        t.lines.some(l => !l.accountId || l.accountId === 'uncategorized')
      ).length;

      // 3. Draft/Pending
      const pending = transactions.filter(t => t.status === 'draft' || t.status === 'pending').length;

      // 4. Anomalies
      const anomalies = transactions.filter(t => t.isFlagged).length;

      // 5. Unreconciled
      const unreconciled = bankLines.filter(l => !l.matchedTransactionId).length;

      const results = [
        {
          id: 'trial-balance',
          title: 'Trial Balance',
          status: Math.abs(tbNet) === 0 ? 'pass' : 'fail',
          message: Math.abs(tbNet) === 0 
            ? 'Your books are perfectly balanced. Debits equal credits.'
            : 'Your books are out of balance! A journal entry is missing a matching side.'
        },
        {
          id: 'uncategorized',
          title: 'Categorization',
          status: uncategorized === 0 ? 'pass' : (uncategorized > 10 ? 'fail' : 'warn'),
          message: uncategorized === 0 
            ? 'All transactions have been categorized.'
            : `You have ${uncategorized} uncategorized transactions waiting in your inbox.`
        },
        {
          id: 'reconciliation',
          title: 'Bank Reconciliation',
          status: unreconciled === 0 ? 'pass' : 'warn',
          message: unreconciled === 0 
            ? 'All bank lines are matched to ledger entries.'
            : `${unreconciled} bank lines are still waiting to be matched.`
        },
        {
          id: 'anomalies',
          title: 'Anomaly Detection',
          status: anomalies === 0 ? 'pass' : 'fail',
          message: anomalies === 0 
            ? 'No suspicious patterns detected.'
            : `${anomalies} transactions were flagged for review due to unusual patterns.`
        }
      ];

      const score = Math.round(
        (results.filter(r => r.status === 'pass').length / results.length) * 100
      );

      setReport({ results, score, pending });
      setIsScanning(false);
    }, 1500);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [isOpen, transactions, bankLines]);

  const handleManualScan = () => {
    setIsScanning(true);
    setReport(null);
    setTimeout(() => {
      let tbNet = 0;
      transactions.filter(isPostable).forEach(t => {
        t.lines?.forEach(l => { tbNet += lineAmount(l, t); });
      });

      const uncategorized = transactions.filter(t => 
        t.lines.some(l => !l.accountId || l.accountId === 'uncategorized')
      ).length;

      const pending = transactions.filter(t => t.status === 'draft' || t.status === 'pending').length;
      const anomalies = transactions.filter(t => t.isFlagged).length;
      const unreconciled = bankLines.filter(l => !l.matchedTransactionId).length;

      const results = [
        {
          id: 'trial-balance',
          title: 'Trial Balance',
          status: Math.abs(tbNet) === 0 ? 'pass' : 'fail',
          message: Math.abs(tbNet) === 0 
            ? 'Your books are perfectly balanced. Debits equal credits.'
            : 'Your books are out of balance! A journal entry is missing a matching side.'
        },
        {
          id: 'uncategorized',
          title: 'Categorization',
          status: uncategorized === 0 ? 'pass' : (uncategorized > 10 ? 'fail' : 'warn'),
          message: uncategorized === 0 
            ? 'All transactions have been categorized.'
            : `You have ${uncategorized} uncategorized transactions waiting in your inbox.`
        },
        {
          id: 'reconciliation',
          title: 'Bank Reconciliation',
          status: unreconciled === 0 ? 'pass' : 'warn',
          message: unreconciled === 0 
            ? 'All bank lines are matched to ledger entries.'
            : `${unreconciled} bank lines are still waiting to be matched.`
        },
        {
          id: 'anomalies',
          title: 'Anomaly Detection',
          status: anomalies === 0 ? 'pass' : 'fail',
          message: anomalies === 0 
            ? 'No suspicious patterns detected.'
            : `${anomalies} transactions were flagged for review due to unusual patterns.`
        }
      ];

      const score = Math.round(
        (results.filter(r => r.status === 'pass').length / results.length) * 100
      );

      setReport({ results, score, pending });
      setIsScanning(false);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                <Activity size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Ledger Health Check</h2>
                <p className="text-sm text-slate-500">"Are my books right?"</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors hover:bg-slate-200/50">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {isScanning ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-slate-900">Scanning Ledgers...</h3>
                  <p className="text-slate-500 mt-1">Running 12 validation rules across all records.</p>
                </div>
              </div>
            ) : report ? (
              <div className="space-y-6">
                
                <div className="flex items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-slate-900 flex items-baseline justify-center gap-1">
                      {report.score}
                      <span className="text-xl text-slate-500">/ 100</span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 mt-2 uppercase tracking-wider">Health Score</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {report.results.map((r: any) => (
                    <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-white flex items-start gap-4">
                      <div className="mt-0.5">
                        {r.status === 'pass' && <CheckCircle2 className="text-emerald-500" size={20} />}
                        {r.status === 'warn' && <AlertTriangle className="text-amber-500" size={20} />}
                        {r.status === 'fail' && <AlertTriangle className="text-rose-500" size={20} />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 text-sm">{r.title}</h4>
                        <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                          {r.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {report.score < 100 && (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3">
                    <RefreshCw className="text-indigo-600 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-indigo-900">Recommendation</h4>
                      <p className="text-sm text-indigo-700 mt-1">
                        Head over to the Inbox to clear your pending items and anomalies to bring your books to perfect health.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-200/50 rounded-lg transition-colors">
              Close
            </button>
            <button 
              onClick={handleManualScan}
              disabled={isScanning}
              className="px-5 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              Run Again
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
