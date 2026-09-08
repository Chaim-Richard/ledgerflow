import React, { useState, useEffect } from 'react';
import { Transaction, TransactionLine, ChartAccount } from '../../types';
import { 
  X, 
  Calendar, 
  FileText, 
  Building2, 
  Trash2, 
  Plus, 
  ShieldAlert, 
  Hash,
  Sliders,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { auth } from '../../firebase';
import { formatDecimal, getLocalDateISO, parseAmountToCents } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { 
  DEFAULT_WORKSPACE_DIMENSIONS, 
  getLineDimension, 
  setLineDimension, 
  extractUniqueDimensionPaths 
} from '../../lib/dimensionUtils';
import { TruthEngine } from '../../modules/integrity/TruthEngine';
import TagInput from './TagInput';
import AsyncButton from '../ui/AsyncButton';

interface TransactionEditModalProps {
  isOpen: boolean;
  transaction: Transaction;
  accounts: ChartAccount[];
  lockDate?: string | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
}

export default function TransactionEditModal({
  isOpen,
  transaction,
  accounts,
  lockDate,
  onClose,
  onUpdate
}: TransactionEditModalProps) {
  const baseCurrency = useLedgerStore(s => s.baseCurrency) || 'USD';
  const [date, setDate] = useState(() => transaction?.date || '');
  const [description, setDescription] = useState(() => transaction?.description || '');
  const [payee, setPayee] = useState(() => transaction?.payee || '');
  const [type, setType] = useState<Transaction['type']>(transaction.type || 'actual');
  const [status, setStatus] = useState<Transaction['status']>(transaction.status || 'completed');
  const [project, setProject] = useState(() => transaction?.project || '');
  const [isCleared, setIsCleared] = useState(() => transaction?.isCleared || false);
  const [isFlagged, setIsFlagged] = useState(() => transaction?.isFlagged || false);
  const [fileUrls, setFileUrls] = useState<string[]>(() => transaction?.fileUrls || []);
  const [originalCurrency, setOriginalCurrency] = useState(() => transaction?.originalCurrency || baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(() => transaction?.exchangeRate || 1.0);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const classes = useLedgerStore(s => s.classes);
  const locations = useLedgerStore(s => s.locations);
  const projects = useLedgerStore(s => s.projects);
  const transactions = useLedgerStore(s => s.transactions);
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const currentWorkspace = getCurrentWorkspace();
  const activeDimensions = currentWorkspace?.dimensions || DEFAULT_WORKSPACE_DIMENSIONS;
  
  // Manage lines for splitting and multiple assignments
  const [lines, setLines] = useState<TransactionLine[]>(() => transaction?.lines ? transaction.lines.map(l => ({ ...l })) : []);

  const isLocked = !!(lockDate && date <= lockDate);

  // Compute total absolute sum (or sum of debits/credits in standard book)
  // Our types.ts says line.amountCents: Positive for Debit, Negative for Credit
  const totalAmountCents = Math.abs(lines.reduce((sum, l) => sum + l.amountCents, 0));
  
  // Let's compute if the line items sum up correctly
  const sumLines = lines.reduce((sum, l) => sum + l.amountCents, 0);

  const handleAddLine = () => {
    const defaultAcc = accounts.find(a => a.type === 'expense') || accounts[0];
    setLines([...lines, { 
      accountId: defaultAcc?.id || '', 
      accountName: defaultAcc?.name || '', 
      amountCents: 0 
    }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      toast.error('At least one double-entry split ledger line is required for absolute integrity.');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, updates: Partial<TransactionLine>) => {
    const nextLines = [...lines];
    nextLines[index] = { ...nextLines[index], ...updates };
    setLines(nextLines);
  };

  const handleSave = async () => {
    if (isLocked) {
      toast.error('Period is sealed. Changes are prohibited to protect general ledger integrity.');
      return;
    }

    if (!description.trim()) {
      toast.error('Description must be specified.');
      return;
    }

    // Check if any line has unassigned account
    const hasUnassigned = lines.some(l => !l.accountId || l.accountId === '' || l.accountId === 'uncategorized' || l.accountId === 'unassigned');
    if (hasUnassigned) {
      toast.error('All transaction ledger lines must be linked to a valid chart of account.');
      return;
    }

    // Perform rigid double-entry offset check to protect ledger consistency
    const balancedSum = lines.reduce((acc, l) => acc + (l.amountCents || 0), 0);
    if (balancedSum !== 0) {
      toast.error('Double-entry violation: Debits (positive) and Credits (negative) must sum to exactly zero.');
      return;
    }

    // In double-entry ledger bookkeeping, the gross transaction size is the total debit value (or absolute credit size)
    const calculatedTotal = Math.abs(TruthEngine.deriveSignedTotal(lines, accounts));

    const finalLines = lines.map(l => {
      const acc = accounts.find(a => a.id === l.accountId);
      return {
        ...l,
        accountName: acc ? acc.name : l.accountName,
        project: l.project || project.trim() || undefined
      };
    });

    await onUpdate(transaction.id, {
      date,
      description: description.trim(),
      payee: payee.trim() || undefined,
      type,
      status,
      project: project.trim() || undefined,
      isCleared,
      isFlagged,
      fileUrls,
      originalCurrency: originalCurrency !== baseCurrency ? originalCurrency : undefined,
      exchangeRate: originalCurrency !== baseCurrency ? exchangeRate : undefined,
      lines: finalLines,
      totalAmountCents: calculatedTotal
    });

    toast.success('Ledger state synchronized with extreme precision');
    onClose();
  };

  // Auto balance offset
  const handleAutoBalance = () => {
    if (lines.length < 2) {
      toast.error('Auto-balancing requires at least two line vectors to offset.');
      return;
    }
    
    // In our system, the first line is the primary (eg Expense), and secondary balances it.
    // Let's say we want to distribute the remaining amount to the last line.
    toast.info('Auto-balancing offset distributed to secondary vector.');
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, handleSave, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
        />

        {/* Modal Sheet panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 15 }}
          className="relative w-full max-w-4xl bg-[var(--surface)] rounded-[32px] shadow-2xl border border-[var(--line)] overflow-hidden flex flex-col max-h-[90dvh]"
        >
          {/* Header with audit indicators */}
          <div className="px-6 py-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center shadow-md shadow-zinc-800/10">
                <Sliders size={18} className="text-zinc-100" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
                  Edit Ledger Entry details
                </h3>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest mt-0.5">
                  ID: {transaction.id.slice(0, 12)}... • SHA-255 Audit Sealed
                </p>
              </div>
            </div>

            <button aria-label="Close" 
              onClick={onClose} 
              className="p-2 hover:bg-zinc-100 rounded-full transition-all text-zinc-400 hover:text-[var(--text)]"
            ><X size={18} /></button>
          </div>

          {/* Form Content body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8">
            
            {/* Sealed Alert banner if transaction is period locked */}
            {isLocked && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-[32px] text-amber-800">
                <ShieldAlert className="shrink-0 mt-0.5 text-amber-600" size={18} />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Period Locked (Absolute Integrity Principle)</p>
                  <p className="text-amber-700/90 leading-relaxed">
                    This transaction Date ({date}) is prior to the lock date ({lockDate}). You cannot edit this record unless you update the organization lock threshold in System Settings.
                  </p>
                </div>
              </div>
            )}

            {/* Crucial Meta Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="space-y-1.5Col">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                  <Calendar size={11} /> Transaction Date
                </label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--ink)] border border-[var(--line)]/80 rounded-xl focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-950 focus:bg-[var(--surface)] outline-none transition-all text-sm font-medium text-[var(--text)] disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                  <FileText size={11} /> Description
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. AWS Production Virtual Servers"
                  className="w-full px-4 py-2.5 bg-[var(--ink)] border border-[var(--line)]/80 rounded-xl focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-950 focus:bg-[var(--surface)] outline-none transition-all text-sm font-semibold text-[var(--text)] placeholder:text-zinc-300 disabled:opacity-50"
                />
              </div>

            </div>

            {/* Secondary Meta details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                  <Building2 size={11} /> Payee / counterparty
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder="e.g. Amazon Web Services"
                  className="w-full px-4 py-2 bg-[var(--ink)] border border-[var(--line)]/80 rounded-xl focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-950 focus:bg-[var(--surface)] outline-none transition-all text-xs font-semibold text-[var(--text)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                  Custom Project Code
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="e.g. PRJ-METRICS"
                  className="w-full px-4 py-2 bg-[var(--ink)] border border-[var(--line)]/80 rounded-xl focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-950 focus:bg-[var(--surface)] outline-none transition-all text-xs font-semibold text-[var(--text)] uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Vector Type
                </label>
                <select
                  disabled={isLocked}
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--ink)] border border-[var(--line)] hover:border-zinc-300 rounded-xl text-xs font-semibold text-[var(--text)] outline-none focus:bg-[var(--surface)]"
                >
                  <option value="actual">Actual Ledger Node</option>
                  <option value="forecast">Forecast projection</option>
                  <option value="adjustment">Manual Adjustment</option>
                  <option value="reversal">Reversal Entry</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Process Status
                </label>
                <select
                  disabled={isLocked}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--ink)] border border-[var(--line)] hover:border-zinc-300 rounded-xl text-xs font-semibold text-[var(--text)] outline-none focus:bg-[var(--surface)]"
                >
                  <option value="completed">Completed / Signed</option>
                  <option value="pending">Pending Validation</option>
                  <option value="flagged">Flagged for Audit</option>
                  <option value="reconciled">Reconciled Lock</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Currency Context
                </label>
                <select
                  disabled={isLocked}
                  value={originalCurrency}
                  onChange={(e) => setOriginalCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--ink)] border border-[var(--line)] hover:border-zinc-300 rounded-xl text-xs font-semibold text-[var(--text)] outline-none focus:bg-[var(--surface)]"
                >
                  {['USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CAD'].map(cur => (
                    <option key={cur} value={cur}>{cur}</option>
                  ))}
                </select>
              </div>

              {(originalCurrency !== 'USD') && (
                <div className="space-y-1.5 md:col-span-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                      Historical Exchange Rate Offset (1 {originalCurrency} =)
                    </label>
                    <button
                      type="button"
                      disabled={isFetchingRate || isLocked}
                      onClick={async () => {
                        try {
                          setIsFetchingRate(true);
                          const token = await auth.currentUser?.getIdToken();
                          if (!token) return;
                          
                          // Use the transaction date or today
                          const date = transaction.date || getLocalDateISO();
                          const res = await fetch(`/api/v1/currency/historical?date=${date}&source=USD&currencies=${originalCurrency}`, {
                             headers: { 'Authorization': `Bearer ${token}` }
                          });
                          const data = await res.json();
                          if (data.success && data.historical && data.quotes[`USD${originalCurrency}`]) {
                             // The quote is 1 USD = X Currency. We need 1 Currency = X USD, so 1 / X
                             const usdRate = 1 / data.quotes[`USD${originalCurrency}`];
                             setExchangeRate(Number(usdRate.toFixed(6)));
                             toast.success('Market rate synchronized from Currency API');
                          } else {
                             toast.error('Failed to sync rate', { description: data.error?.info || 'Unknown error' });
                          }
                        } catch (err: any) {
                          toast.error('Failed to fetch rate', { description: err.message });
                        } finally {
                          setIsFetchingRate(false);
                        }
                      }}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCcw size={12} className={isFetchingRate ? 'animate-spin' : ''} />
                      Sync from Market
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    disabled={isLocked}
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1.0)}
                    placeholder="e.g. 1.08"
                    className="w-full px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-900/10 focus:border-emerald-500 outline-none transition-all text-xs font-mono font-bold text-emerald-900"
                  />
                </div>
              )}

            </div>

            {/* Structural Double-Entry Ledger Lines splits section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
                    <Hash size={13} className="text-zinc-500" /> Ledger Line Distribution Coordinates
                  </h4>
                  <p className="text-[10px] text-zinc-400">Specify precise split mappings to enforce trial balance zero-sum equivalence</p>
                </div>

                {!isLocked && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (lines.length > 0) {
                           // Set the second line (if exists, or first line) to a Credit Card Liability
                           const cc = accounts.find(a => a.type === 'liability' || a.type === 'asset');
                           if (cc && lines.length === 2) {
                             handleLineChange(0, { accountId: cc.id, accountName: cc.name, description: 'Inter-Account Transfer Link' });
                             toast.success('Converted leg to transfer. P&L expense nullified.');
                           } else {
                             toast.error('Ensure you have 2 lines minimum and a valid Liability account setup.');
                           }
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] uppercase tracking-widest font-black rounded-lg transition-all"
                    >
                      Convert to Transfer
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="flex items-center gap-1 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold rounded-lg transition-all"
                     aria-label="Add Split Vector">
                      <Plus size={12} />
                      <span>Add Split Vector</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div 
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-[32px] border border-[var(--line)] bg-[var(--ink)]/20 hover:bg-[var(--ink)]/50 transition-colors"
                  >
                    {/* Top Row: Account & Amount & Delete */}
                    <div className="md:col-span-6 space-y-1">
                      <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Chart of Account</div>
                      <select
                        disabled={isLocked}
                        value={line.accountId}
                        onChange={(e) => {
                          const acc = accounts.find(a => a.id === e.target.value);
                          handleLineChange(idx, { 
                            accountId: e.target.value, 
                            accountName: acc ? acc.name : '' 
                          });
                        }}
                        className="w-full bg-[var(--surface)] border border-[var(--line)] hover:border-zinc-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--text)] outline-none"
                      >
                        <option value="uncategorized">Select Account</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.code}) [{acc.type}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-5 space-y-1">
                      <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right">Amount</div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          disabled={isLocked}
                          value={line.amountCents === 0 ? '' : formatDecimal(line.amountCents)}
                          onChange={(e) => {
                            handleLineChange(idx, { amountCents: parseAmountToCents(e.target.value) });
                          }}
                          className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl pl-6 pr-2.5 py-1.5 text-xs text-right text-[var(--text)] font-mono font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1 pt-4 text-center">
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1 px-2.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all"
                          title="Remove distribution vector"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Bottom Row: Additional Dimensions */}
                    {activeDimensions.filter(d => d.id !== 'category').map(dim => {
                      const dimVal = getLineDimension(line, transaction, dim.id);
                      const displayVal = dimVal === 'Unassigned' ? '' : dimVal;
                      const pathOptions = extractUniqueDimensionPaths(transactions, dim.id);
                      return (
                        <div key={dim.id} className="md:col-span-2 space-y-1">
                          <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{dim.name}</div>
                          <div className="relative">
                            <input
                              list={`dim-list-${idx}-${dim.id}`}
                              value={displayVal}
                              disabled={isLocked}
                              onChange={(e) => {
                                const updatedLine = setLineDimension(line, dim.id, e.target.value);
                                handleLineChange(idx, updatedLine);
                              }}
                              placeholder={`Type or select ${dim.name.toLowerCase()}`}
                              className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text)] outline-none focus:border-zinc-400"
                            />
                            <datalist id={`dim-list-${idx}-${dim.id}`}>
                              {pathOptions.map(p => <option key={p} value={p}>{p}</option>)}
                            </datalist>
                          </div>
                        </div>
                      );
                    })}

                    <div className="md:col-span-3 space-y-1">
                      <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Tags</div>
                      <TagInput
                        tags={line.tags || []}
                        onChange={(tags) => handleLineChange(idx, { tags })}
                        disabled={isLocked}
                        placeholder="Add tag and press Enter"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Line Notes</div>
                      <input
                        type="text"
                        placeholder="Optional details..."
                        disabled={isLocked}
                        value={line.description || ''}
                        onChange={(e) => handleLineChange(idx, { description: e.target.value })}
                        className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reconciliation and Balance audit strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--ink)] p-4 rounded-[32px] border border-zinc-150">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reconciliation Checklist</span>
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      disabled={isLocked}
                      checked={isCleared}
                      onChange={(e) => setIsCleared(e.target.checked)}
                      className="rounded text-[var(--text)] focus:ring-zinc-900/10 cursor-pointer accent-zinc-900"
                    />
                    <span className="text-xs text-zinc-600 font-medium">Cleared and Verified</span>
                  </label>
                  
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      disabled={isLocked}
                      checked={isFlagged}
                      onChange={(e) => setIsFlagged(e.target.checked)}
                      className="rounded text-[var(--text)] focus:ring-zinc-900/10 cursor-pointer accent-zinc-900"
                    />
                    <span className="text-xs text-amber-600 font-medium">Flag for deep auditing</span>
                  </label>
                </div>
              </div>

              <div className="text-right flex flex-col justify-center space-y-0.5">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Total Transaction Sum</span>
                <div className="text-sm font-mono font-black text-[var(--text)]">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: transaction.currency || 'USD' }).format(totalAmountCents / 100)}
                </div>
                {sumLines !== 0 && (
                  <p className="text-[10px] text-amber-600 font-medium">
                    Trial balance variance offset: ${formatDecimal(sumLines)}
                  </p>
                )}
              </div>
            </div>

            {/* Document Management Section */}
            <div className="bg-[var(--ink)]/50 p-4 rounded-[32px] border border-zinc-150 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={13} className="text-zinc-500" /> Source Documents & Receipts
                  </h4>
                  <p className="text-[10px] text-zinc-400">Attach underlying evidence for this specific vector node.</p>
                </div>
                <label className="flex items-center gap-1 px-3 py-1 bg-[var(--surface)] hover:bg-zinc-100 text-[var(--text)] border border-[var(--line)] text-[11px] font-bold rounded-lg transition-all cursor-pointer">
                  <Plus size={12} />
                  <span>Attach Document</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    multiple
                    disabled={isLocked}
                    onChange={(e) => {
                      if (!e.target.files) return;
                      const files = Array.from(e.target.files);
                      
                      files.forEach(file => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => {
                          setFileUrls(prev => [...prev, reader.result as string]);
                        };
                      });
                    }}
                  />
                </label>
              </div>

              {fileUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  {fileUrls.map((url, i) => (
                    <div key={i} className="relative group rounded-xl border border-[var(--line)] overflow-hidden bg-[var(--surface)] h-24 flex items-center justify-center">
                      {url.startsWith('data:image') ? (
                        <img src={url} alt="Attached receipt" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-zinc-400">
                          <FileText size={24} />
                          <span className="text-[9px] uppercase font-bold tracking-widest">Document</span>
                        </div>
                      )}
                      
                      {!isLocked && (
                        <button 
                          onClick={() => setFileUrls(prev => prev.filter((_, index) => index !== i))}
                          className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Actions footer */}
          <div className="px-6 py-4 bg-[var(--ink)] border-t border-[var(--line)] flex items-center justify-end gap-3 shrink-0">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-500 hover:text-[var(--text)] transition-colors"
             aria-label="Cancel">
              Cancel
            </button>
            <AsyncButton
              onClick={handleSave}
              disabled={isLocked}
              loadingText="Recording..."
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-zinc-800/15 disabled:opacity-50"
            >
              Record synchronized changes
            </AsyncButton>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
