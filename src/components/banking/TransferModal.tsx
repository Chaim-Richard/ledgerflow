import React, { useState, useMemo } from 'react';
import { ChartAccount, Transaction } from '../../types';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { createAccountTransfer, detectPotentialTransfers, TransferMatchCandidate } from '../../lib/transferEngine';
import { formatCurrency, formatDate, getLocalDateISO } from '../../lib/utils';
import { isCashAccount } from '../../lib/txFilters';
import { useTimeout } from '../../hooks/useTimeout';
import { 
  ArrowRightLeft, 
  Check, 
  X, 
  Sparkles, 
  AlertCircle, 
  HelpCircle,
  Building2,
  Calendar,
  DollarSign
} from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFromAccountId?: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  defaultFromAccountId
}) => {
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const setTransactions = useLedgerStore(s => s.setTransactions);
  const updateTransaction = useLedgerStore(s => s.updateTransaction);
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const user = useAuthStore(s => s.user);
  const currentWorkspace = getCurrentWorkspace();

  const [activeTab, setActiveTab] = useState<'create' | 'detect'>('create');

  // Form state
  const [fromAccountId, setFromAccountId] = useState<string>(defaultFromAccountId || '');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(getLocalDateISO());
  const [description, setDescription] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { setSafeTimeout } = useTimeout();

  // Cash / Bank accounts filter
  const cashAccounts = useMemo(() => {
    return accounts.filter(isCashAccount);
  }, [accounts]);

  // Detected candidates
  const candidates = useMemo(() => {
    return detectPotentialTransfers(transactions, accounts, 4);
  }, [transactions, accounts]);

  if (!isOpen) return null;

  const handleCreateTransfer = () => {
    if (!fromAccountId || !toAccountId || !amount || parseFloat(amount) <= 0) {
      return;
    }

    if (fromAccountId === toAccountId) {
      alert('Source and destination accounts must be different.');
      return;
    }

    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);

    if (!fromAcc || !toAcc) return;

    const amountCents = Math.round(parseFloat(amount) * 100);

    const transferTx = createAccountTransfer({
      workspaceId: currentWorkspace?.id || 'default',
      uid: user?.uid || 'system',
      fromAccountId,
      fromAccountName: fromAcc.name,
      toAccountId,
      toAccountName: toAcc.name,
      amountCents,
      date,
      description: description || undefined
    });

    const fullTx: Transaction = {
      ...transferTx as Transaction,
      id: `tx_transfer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    };

    setTransactions([...transactions, fullTx]);
    setSuccessMessage(`Transferred $${amount} from ${fromAcc.name} to ${toAcc.name}`);
    setSafeTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 1500);
  };

  const handleMergeCandidate = (candidate: TransferMatchCandidate) => {
    // Unify the two disparate transactions into a single clean inter-account transfer
    const updatedOutflow: Transaction = {
      ...candidate.outflowTx,
      isTransfer: true,
      transferDetails: {
        fromAccountId: candidate.fromAccount.id,
        toAccountId: candidate.toAccount.id
      }
    };
    const updatedInflow: Transaction = {
      ...candidate.inflowTx,
      isTransfer: true,
      transferDetails: {
        fromAccountId: candidate.fromAccount.id,
        toAccountId: candidate.toAccount.id
      }
    };

    updateTransaction(updatedOutflow.id, updatedOutflow);
    updateTransaction(updatedInflow.id, updatedInflow);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-neutral-200">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-neutral-800" />
            <h3 className="text-sm font-bold text-neutral-900">Inter-Account Transfer</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-neutral-200 bg-neutral-100/60 p-1">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'create' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Record Transfer
          </button>
          <button
            onClick={() => setActiveTab('detect')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'detect' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            Transfer Suggestions ({candidates.length})
          </button>
        </div>

        <div className="p-5">
          {successMessage ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-neutral-900">{successMessage}</p>
            </div>
          ) : activeTab === 'create' ? (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">From Account (Source)</label>
                <select
                  value={fromAccountId}
                  onChange={e => setFromAccountId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                >
                  <option value="">Select source bank/cash account...</option>
                  {cashAccounts.map(a => (
                    <option key={a.id} value={a.id} disabled={a.id === toAccountId}>
                      {a.name} ({a.code || a.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">To Account (Destination)</label>
                <select
                  value={toAccountId}
                  onChange={e => setToAccountId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                >
                  <option value="">Select destination bank/cash account...</option>
                  {cashAccounts.map(a => (
                    <option key={a.id} value={a.id} disabled={a.id === fromAccountId}>
                      {a.name} ({a.code || a.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Amount ($)</label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Transfer Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Reference / Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Sweep to high-yield savings"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <span>
                  Inter-account transfers are recorded as balanced double-entry journals without affecting your Profit & Loss income or operational expenses.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateTransfer}
                  disabled={!fromAccountId || !toAccountId || !amount || parseFloat(amount) <= 0}
                  className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Post Transfer
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">
                The smart transfer detector found these matched transactions between cash accounts that look like internal money movements:
              </p>

              {candidates.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs">
                  No unmatched inter-account transfer pairs detected in the current ledger.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {candidates.map((cand, idx) => (
                    <div key={idx} className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                          <span>{cand.fromAccount.name}</span>
                          <span className="text-neutral-400">&rarr;</span>
                          <span>{cand.toAccount.name}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          ${(cand.amountCents / 100).toFixed(2)} &bull; {cand.outflowTx.date}
                          {cand.dateDiffDays > 0 ? ` (+${cand.dateDiffDays}d)` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleMergeCandidate(cand)}
                        className="px-3 py-1.5 text-xs font-semibold bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 rounded-md transition-colors whitespace-nowrap"
                      >
                        Link as Transfer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
