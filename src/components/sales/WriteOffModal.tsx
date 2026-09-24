import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { doc, updateDoc } from '../../lib/db/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { Invoice } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { LedgerPostService } from '../../services/LedgerPostService';
import { toast } from 'sonner';

interface WriteOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export default function WriteOffModal({ isOpen, onClose, invoice }: WriteOffModalProps) {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const accounts = useLedgerStore(s => s.accounts) || [];
  const expenseAccounts = accounts.filter(a => a.type === 'expense');
  const defaultBadDebt = expenseAccounts.find(a => a.name.toLowerCase().includes('bad debt') || a.code === '6800') || expenseAccounts[0];

  const [badDebtAccountId, setBadDebtAccountId] = useState<string>(defaultBadDebt?.id || '');
  const [reason, setReason] = useState('Uncollectible bad debt');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !invoice) return null;

  const total = invoice.amountCents || 0;
  const paid = invoice.amountPaidCents || 0;
  const remainingCents = Math.max(0, total - paid);

  const handleWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspaceId || !user || !invoice.id) return;
    if (remainingCents <= 0) {
      toast.error('Invoice has no remaining balance to write off');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update invoice status in Firestore
      const invRef = doc(db, 'invoices', invoice.id);
      await updateDoc(invRef, {
        status: 'void',
        isWrittenOff: true,
        writeOffReason: reason,
        updatedAt: new Date().toISOString()
      });

      // 2. Post Bad Debt journal entry via LedgerPostService
      await LedgerPostService.postWriteOffLedger(
        invoice.id,
        invoice,
        remainingCents,
        currentWorkspaceId,
        user.uid,
        reason,
        undefined,
        undefined,
        badDebtAccountId || undefined
      );

      toast.success(`Written off ${formatCurrency(remainingCents)} as Bad Debt`);
      onClose();
    } catch (err: any) {
      console.error('Write-off failed:', err);
      toast.error(err.message || 'Failed to write off bad debt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Bad Debt Write-off
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Invoice #{invoice.number || invoice.id}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleWriteOff} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Customer:</span>
              <strong className="text-slate-900 dark:text-white">{invoice.customerName || 'Customer'}</strong>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Outstanding Balance:</span>
              <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                {formatCurrency(remainingCents)}
              </strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Bad Debt Expense Account
            </label>
            <select
              value={badDebtAccountId}
              onChange={e => setBadDebtAccountId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              {expenseAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.code ? `${acc.code} - ` : ''}{acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Write-off Reason / Notes
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            This will debit the selected Bad Debt Expense account and credit Accounts Receivable (1100), clearing the customer's open balance.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Writing off...' : 'Confirm Bad Debt Write-off'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
