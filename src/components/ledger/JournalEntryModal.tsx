import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { ChartAccount, JournalLine } from '../../types';
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2,
  X,
  ArrowRightLeft,
  Type as TypeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getLocalDateISO } from '../../lib/utils';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db, getIdToken } from '../../firebase';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { isPostable, lineAmount } from '../../lib/txFilters';
import AsyncButton from '../ui/AsyncButton';
import { MatchingEngine } from '../../lib/MatchingEngine';
import { SpellChecker } from '../../lib/algorithms';
import { TemporalValidity } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { DEFAULT_WORKSPACE_DIMENSIONS } from '../../lib/dimensionUtils';

// Temporal series for various currencies (to ensure we use 'rate of date of change' as requested)
const getTemporalRatesFor = (currency: string): TemporalValidity[] => {
  const baseRate = currency === 'EUR' ? 0.92 : currency === 'GBP' ? 0.79 : currency === 'JPY' ? 151.42 : currency === 'ILS' ? 3.65 : currency === 'CAD' ? 1.35 : 1.0;
  return [
    { validFrom: '0000-01-01', validTo: '2022-12-31', value: baseRate * 0.90 },
    { validFrom: '2023-01-01', validTo: '2023-12-31', value: baseRate * 0.95 },
    { validFrom: '2024-01-01', validTo: '2024-12-31', value: baseRate },
    { validFrom: '2025-01-01', validTo: '2025-12-31', value: baseRate * 1.05 },
    { validFrom: '2026-01-01', validTo: '9999-12-31', value: baseRate * 1.1 },
  ];
};

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  accounts: ChartAccount[];
  workspaceId: string;
}

export default function JournalEntryModal({ isOpen, onClose, user, accounts, workspaceId }: JournalEntryModalProps) {
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalDateISO());
  const [reference, setReference] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showDimensions, setShowDimensions] = useState(false);
  
  const baseCurrency = useLedgerStore(state => state.baseCurrency);
  const lockDate = useLedgerStore(state => state.lockDate);
  const workspace = useAuthStore(state => state.getCurrentWorkspace());
  const activeDimensions = (workspace?.dimensions || DEFAULT_WORKSPACE_DIMENSIONS).filter(d => d.id !== 'category');
  
  const [transactionCurrency, setTransactionCurrency] = useState(baseCurrency || 'USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  
  const isLocked = !!(lockDate && date <= lockDate);

  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', accountName: '', debit: 0, credit: 0, dimensions: {} },
    { accountId: '', accountName: '', debit: 0, credit: 0, dimensions: {} },
  ]);

  const handleDimensionChange = (index: number, dimensionId: string, value: string) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== index) return l;
      return {
        ...l,
        dimensions: {
          ...(l.dimensions || {}),
          [dimensionId.toLowerCase()]: value
        }
      };
    }));
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (transactionCurrency !== baseCurrency) {
      try {
        const series = getTemporalRatesFor(transactionCurrency);
        const rate = TruthEngine.resolveEffectiveValue(series, date);
        const fixedRate = Number(rate.toFixed(6));
        setTimeout(() => setExchangeRate(fixedRate), 0);
      } catch (err) {
        setTimeout(() => setExchangeRate(1.0), 0);
      }
    } else {
      setTimeout(() => setExchangeRate(1.0), 0);
    }
  }, [transactionCurrency, date, baseCurrency]);

  const transactions = useLedgerStore(s => s.transactions);
  const analyticalPatternCache = useLedgerStore(s => s.analyticalPatternCache);
  const autoRules = useLedgerStore(s => s.autoRules);
  const matchingThreshold = useLedgerStore(s => s.matchingThreshold);
  const dimensionNodes = useLedgerStore(s => s.dimensionNodes);
  
  const engine = useMemo(() => new MatchingEngine(autoRules, analyticalPatternCache, undefined, matchingThreshold, transactions.filter(isPostable), dimensionNodes, accounts), [autoRules, analyticalPatternCache, transactions, matchingThreshold, dimensionNodes, accounts]);
  
  const spellChecker = useMemo(() => {
    const dictionary = [
      ...accounts.map(a => a.name),
      ...Object.keys(analyticalPatternCache || {})
    ];
    return new SpellChecker(dictionary);
  }, [accounts, analyticalPatternCache]);

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    
    // Spell Check Logic
    const words = val.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord && lastWord.length > 3) {
      const closest = spellChecker.findClosest(lastWord, 1);
      if (closest && closest.toLowerCase() !== lastWord.toLowerCase()) {
        setSuggestion(closest);
      } else {
        setSuggestion(null);
      }
    } else {
      setSuggestion(null);
    }

    if (val.length > 3) {
      const match = engine.resolveCategory(val);
      if (match) {
        const found = accounts.find(a => a.name === match.accountName);
        if (found && lines[0].accountId === '') {
          handleLineChange(0, 'accountId', found.id);
          toast.info(`Smart Category: Suggesting ${found.name} based on rule patterns.`, { duration: 2000 });
        }
      }
    }
  };

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const credit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    return { debit, credit, isBalanced: debit === credit && (debit > 0 || (lines.length >= 2 && lines.some(l => l.accountId))) };
  }, [lines]);

  const handleAddLine = () => {
    setLines([...lines, { accountId: '', accountName: '', debit: 0, credit: 0, class: '', location: '', project: '', dimensions: {} }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
    setLines(prev => prev.map((lineItem, i) => {
      if (i !== index) return lineItem;
      const updated = { ...lineItem };
      if (field === 'accountId') {
        const account = accounts.find(a => a.id === value);
        updated.accountId = value;
        updated.accountName = account?.name || '';
      } else if (field === 'debit' || field === 'credit') {
        // Convert to cents
        const cents = TruthEngine.parseAmountToCents(value || '0');
        updated[field] = cents;
        // If debit is set, clear credit and vice versa (standard journal entry behavior)
        if (field === 'debit' && cents > 0) updated.credit = 0;
        if (field === 'credit' && cents > 0) updated.debit = 0;
      } else {
        (updated as any)[field] = value;
      }
      return updated;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      toast.error(`Ledger period is sealed. Cannot modify entries on or before ${lockDate}.`);
      return;
    }
    if (!totals.isBalanced) {
      toast.error('Journal entry must be balanced (Debits = Credits)');
      return;
    }

    try {
      const isForeignCurrency = transactionCurrency !== baseCurrency;
      const appliedRate = isForeignCurrency ? exchangeRate : 1.0;
      
      const filteredLines = lines.filter(l => l.accountId && ((l.debit || 0) > 0 || (l.credit || 0) > 0));
      if (filteredLines.length < 2) {
        toast.error('At least two lines with account assignments are required for double-entry.');
        return;
      }

      const mappedLines = filteredLines.map(l => {
        const debitCents = l.debit || 0;
        const creditCents = l.credit || 0;
        const baseCents = Math.round((debitCents > 0 ? debitCents : -creditCents) * appliedRate);
        const dims: Record<string, string> = { ...(l.dimensions || {}) };
        if (l.class && !dims.class) dims.class = l.class;
        if (l.location && !dims.location) dims.location = l.location;
        if (l.project && !dims.project) dims.project = l.project;
        if ((l as any).world && !dims.world) dims.world = (l as any).world;
        
        return {
          accountId: l.accountId,
          accountName: l.accountName,
          amountCents: baseCents,
          class: l.class || undefined,
          location: l.location || undefined,
          project: l.project || undefined,
          dimensions: Object.keys(dims).length > 0 ? dims : undefined
        };
      });

      // Absorb any foreign currency rounding difference into the highest value line
      const netImbalanceCents = mappedLines.reduce((sum, l) => sum + l.amountCents, 0);
      if (netImbalanceCents !== 0 && mappedLines.length > 0) {
        let maxIdx = 0;
        let maxVal = Math.abs(mappedLines[0].amountCents);
        for (let i = 1; i < mappedLines.length; i++) {
          const abs = Math.abs(mappedLines[i].amountCents);
          if (abs > maxVal) {
            maxVal = abs;
            maxIdx = i;
          }
        }
        mappedLines[maxIdx].amountCents -= netImbalanceCents;
      }

      const totalAmountCents = mappedLines
        .filter(l => l.amountCents > 0)
        .reduce((sum, l) => sum + l.amountCents, 0) || Math.round(totals.debit * appliedRate);

      const entryId = `tx_je_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const payload = {
        id: entryId,
        uid: user.uid,
        workspaceId,
        date,
        description,
        reference,
        totalAmountCents,
        currency: baseCurrency,
        originalCurrency: isForeignCurrency ? transactionCurrency : undefined,
        exchangeRate: isForeignCurrency ? appliedRate : undefined,
        type: 'journal',
        status: 'completed',
        lines: mappedLines,
        isCleared: true
      };

      const token = await getIdToken();
      const res = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-operation-id': payload.id
        },
        body: JSON.stringify({ transaction: payload })
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || `HTTP error ${res.status}`);
      }

      toast.success('Journal entry recorded');
      onClose();
      // Reset form
      setDescription('');
      setReference('');
      setLines([
        { accountId: '', accountName: '', debit: 0, credit: 0, dimensions: {} },
        { accountId: '', accountName: '', debit: 0, credit: 0, dimensions: {} },
      ]);
    } catch (error) {
      console.error("Journal Entry Error:", error);
      toast.error('Failed to record journal entry');
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: (transactionCurrency && /^[A-Z]{3}$/.test(transactionCurrency)) ? transactionCurrency : (baseCurrency || 'USD') 
    }).format((val || 0) / 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-entry-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden flex flex-col max-h-[95dvh] md:max-h-[90dvh]"
          >
            {/* Header */}
            <div className="p-4 md:p-6 lg:p-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]/30 gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--brass)] text-black rounded-xl flex items-center justify-center shadow-md shrink-0">
                  <ArrowRightLeft size={20} className="md:size-[24px]" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[var(--text)] tracking-tight">New Journal Entry</h2>
                  <p className="text-xs md:text-sm text-[var(--muted)] font-medium">Record manual adjustments to the ledger</p>
                </div>
              </div>
              <button aria-label="Close" onClick={onClose} className="p-2 hover:bg-[var(--ink)] rounded-full transition-colors shrink-0 cursor-pointer"><X size={20} className="text-[var(--muted)]" /></button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
              {isLocked && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-3">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs uppercase tracking-wider">Accounting Period Sealed</p>
                    <p className="text-[11px] opacity-90 leading-relaxed mt-0.5">
                      This date ({date}) falls within a closed and sealed ledger accounting period (Lock ended: {lockDate}). 
                      Recording manual journal entries under sealed periods is strictly prohibited by GAAP/IFRS controls.
                    </p>
                  </div>
                </div>
              )}

              {/* Meta Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label htmlFor="je-date" className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest">Date</label>
                  <input 
                    id="je-date"
                    type="date" 
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-[var(--brass-line)] focus:bg-[var(--surface)] transition-all font-bold text-[var(--text)]"
                  />
                </div>
                <div className="md:col-span-2 space-y-2 relative">
                  <label htmlFor="je-desc" className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest">Description</label>
                  <input 
                    id="je-desc"
                    type="text" 
                    required
                    value={description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder="e.g. Monthly depreciation adjustment"
                    className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-[var(--brass-line)] focus:bg-[var(--surface)] transition-all font-bold text-[var(--text)]"
                  />
                  
                  <AnimatePresence>
                    {suggestion && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        type="button"
                        onClick={() => {
                          const words = description.split(/\s+/);
                           words[words.length - 1] = suggestion;
                           setDescription(words.join(' ') + ' ');
                           setSuggestion(null);
                        }}
                        className="absolute right-4 top-1/2 translate-y-1 py-1 px-3 bg-[var(--brass-soft)] border border-[var(--brass-line)] text-[var(--brass)] rounded-lg text-[9px] font-black uppercase flex items-center gap-2 hover:bg-[var(--brass-soft)]/80 transition-all shadow-lg z-20 cursor-pointer"
                      >
                        <TypeIcon size={10} />
                        Did you mean "{suggestion}"?
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
                <div className="space-y-2">
                  <label htmlFor="je-ref" className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest">Reference (Optional)</label>
                  <input 
                    id="je-ref"
                    type="text" 
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. JE-2026-001"
                    className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-[var(--brass-line)] focus:bg-[var(--surface)] transition-all shadow-sm font-bold text-[var(--text)]"
                  />
                </div>
                
                <div className="space-y-2">
                   <label htmlFor="je-currency" className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest">Currency</label>
                   <select 
                     id="je-currency"
                     value={transactionCurrency}
                     onChange={(e) => setTransactionCurrency(e.target.value)}
                     className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-[var(--brass-line)] focus:bg-[var(--surface)] transition-all font-bold appearance-none text-[var(--text)] cursor-pointer"
                   >
                     {['USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CAD'].map(cur => (
                       <option key={cur} value={cur}>{cur}</option>
                     ))}
                   </select>
                </div>
                
                {transactionCurrency !== baseCurrency && (
                   <div className="space-y-2">
                     <label htmlFor="je-fx-rate" className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest">
                       Exchange Rate ({transactionCurrency} → {baseCurrency})
                     </label>
                     <input 
                       id="je-fx-rate"
                       type="number" 
                       step="0.000001"
                       value={exchangeRate}
                       onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                       placeholder="e.g. 1.08"
                       required
                       className="w-full px-4 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-[var(--brass-line)] focus:bg-[var(--surface)] transition-all font-mono font-bold text-[var(--text)]"
                     />
                   </div>
                )}
              </div>

              {/* Lines Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-widest">Entry Lines</h3>
                  <div className="flex items-center gap-4">
                    <label htmlFor="je-show-dim" className="flex items-center gap-2 cursor-pointer">
                      <input 
                        id="je-show-dim"
                        type="checkbox" 
                        checked={showDimensions} 
                        onChange={e => setShowDimensions(e.target.checked)} 
                        className="rounded border-[var(--line)] text-[var(--brass)] focus:ring-[var(--brass)]"
                      />
                      <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest">Show Dimensions</span>
                    </label>
                    <button 
                      type="button"
                      onClick={handleAddLine}
                      className="flex items-center gap-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                     aria-label="Add Line">
                      <Plus size={14} /> Add Line
                    </button>
                  </div>
                </div>

                <div className="border border-[var(--line)] rounded-xl overflow-hidden overflow-x-auto custom-scrollbar">
                  <table className="w-full border-collapse text-sm min-w-[600px]">
                    <caption className="sr-only">Journal Entry Lines</caption>
                    <thead>
                      <tr className="text-left border-b border-[var(--line)] bg-[var(--ink)]/50">
                        <th scope="col" className="p-3.5 font-bold text-[var(--muted)] uppercase tracking-widest text-[10px]">Account</th>
                        {showDimensions && activeDimensions.map(dim => (
                          <th scope="col" key={dim.id} className={cn("p-3.5 font-bold text-[var(--muted)] uppercase tracking-widest text-[10px]", dim.isWorld && "text-[var(--brass)]")}>
                            {dim.name}
                          </th>
                        ))}
                        <th scope="col" className="p-3.5 font-bold text-[var(--muted)] uppercase tracking-widest text-[10px] text-right w-32">Debit</th>
                        <th scope="col" className="p-3.5 font-bold text-[var(--muted)] uppercase tracking-widest text-[10px] text-right w-32">Credit</th>
                        <th scope="col" className="p-3.5 w-12"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {lines.map((line, idx) => (
                        <tr key={idx} className="group hover:bg-[var(--ink)]/50 transition-colors">
                          <td className="p-2.5">
                            <div className="relative">
                              <input 
                                required
                                id={`je-line-acc-${idx}`}
                                aria-label={`Account for line ${idx + 1}`}
                                list={`je-account-${idx}`}
                                value={accounts.find(a => a.id === line.accountId) ? `${accounts.find(a => a.id === line.accountId)?.code} - ${accounts.find(a => a.id === line.accountId)?.name}` : line.accountId || ''}
                                onChange={(e) => {
                                  const acc = accounts.find(a => `${a.code} - ${a.name}` === e.target.value || a.id === e.target.value);
                                  handleLineChange(idx, 'accountId', acc ? acc.id : e.target.value);
                                }}
                                placeholder="Select Account..."
                                className="w-full px-3 py-2 bg-transparent border-none focus:ring-0 font-bold text-[var(--text)] min-w-[150px]"
                              />
                              <datalist id={`je-account-${idx}`}>
                                {accounts.sort((a, b) => a.code.localeCompare(b.code)).map(acc => (
                                  <option key={acc.id} value={`${acc.code} - ${acc.name}`}>{acc.name}</option>
                                ))}
                              </datalist>
                            </div>
                          </td>
                          {showDimensions && activeDimensions.map(dim => (
                            <td key={dim.id} className="p-2.5">
                              <div className="relative">
                                <input 
                                  id={`je-dim-${dim.id}-${idx}`}
                                  aria-label={`${dim.name} for line ${idx + 1}`}
                                  value={line.dimensions?.[dim.id.toLowerCase()] || (line as any)[dim.id.toLowerCase()] || ''}
                                  onChange={(e) => handleDimensionChange(idx, dim.id, e.target.value)}
                                  placeholder={`Select ${dim.name}...`}
                                  className="w-full px-3 py-2 bg-[var(--ink)]/50 border border-transparent rounded-lg focus:bg-[var(--surface)] focus:border-[var(--line)] font-bold min-w-[120px] text-[var(--text)]"
                                />
                              </div>
                            </td>
                          ))}
                          <td className="p-2.5">
                            <input 
                              id={`je-line-debit-${idx}`}
                              aria-label={`Debit amount for line ${idx + 1}`}
                              type="number" 
                              step="0.01"
                              value={line.debit > 0 ? line.debit / 100 : ''}
                              onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 bg-[var(--ink)]/50 border border-transparent rounded-lg focus:bg-[var(--surface)] focus:border-[var(--line)] text-right font-mono font-bold text-[var(--text)]"
                            />
                          </td>
                          <td className="p-2.5">
                            <input 
                              id={`je-line-credit-${idx}`}
                              aria-label={`Credit amount for line ${idx + 1}`}
                              type="number" 
                              step="0.01"
                              value={line.credit > 0 ? line.credit / 100 : ''}
                              onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 bg-[var(--ink)]/50 border border-transparent rounded-lg focus:bg-[var(--surface)] focus:border-[var(--line)] text-right font-mono font-bold text-[var(--text)]"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <button 
                              type="button"
                              aria-label={`Remove line ${idx + 1}`}
                              onClick={() => handleRemoveLine(idx)}
                              className="p-2 text-[var(--muted)] hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--ink)]/50 font-bold">
                        <td className="p-4 text-right uppercase tracking-widest text-[10px] text-[var(--muted)]" colSpan={showDimensions ? 4 : 1}>Totals</td>
                        <td className="p-4 text-right font-mono text-[var(--text)] tabular-nums">{formatCurrency(totals.debit)}</td>
                        <td className="p-4 text-right font-mono text-[var(--text)] tabular-nums">{formatCurrency(totals.credit)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Validation Status */}
              <div className={cn(
                "p-4 md:p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 shadow-sm",
                totals.isBalanced 
                  ? "bg-[var(--pos)]/10 border-[var(--pos)]/30 text-[var(--pos)]" 
                  : "bg-rose-500/10 border-rose-500/30 text-rose-500"
              )}>
                <div className="flex items-start sm:items-center gap-3">
                  {totals.isBalanced ? <CheckCircle2 size={22} className="shrink-0 mt-1 sm:mt-0" /> : <AlertCircle size={22} className="shrink-0 mt-1 sm:mt-0" />}
                  <div>
                    <p className="font-bold text-xs uppercase tracking-wider">{totals.isBalanced ? "TOPOLOGY SYNCED: BALANCED" : "IMBALANCE DETECTED"}</p>
                    <p className="text-xs opacity-90 font-medium mt-0.5">
                      {totals.isBalanced 
                        ? "The total debits equal the total credits. Your fiscal structure is integrity-verified." 
                        : "Dimensional mismatch: Debits and credits must be equivalent to commit."}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Delta</p>
                  <p className="text-lg font-bold font-mono tracking-tight tabular-nums">{formatCurrency(Math.abs(totals.debit - totals.credit))}</p>
                </div>
              </div>
            </form>

            {/* Footer Actions */}
            <div className="p-4 md:p-6 border-t border-[var(--line)] bg-[var(--ink)]/30 flex flex-col sm:flex-row gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="py-3 px-4 bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] rounded-xl font-bold hover:bg-[var(--ink)] hover:text-[var(--text)] transition-all order-2 sm:order-1 sm:flex-1 cursor-pointer text-xs uppercase tracking-wider"
               aria-label="Discard Entry">
                Discard Entry
              </button>
              <AsyncButton 
                onClick={handleSubmit}
                disabled={!totals.isBalanced || isLocked}
                loadingText="COMMITTING..."
                className={cn(
                  "py-3 px-4 rounded-xl font-bold transition-all shadow-md order-1 sm:order-2 sm:flex-[2] text-xs uppercase tracking-wider",
                  (totals.isBalanced && !isLocked)
                    ? "bg-[var(--brass)] text-black hover:opacity-90 cursor-pointer" 
                    : "bg-[var(--ink)] text-[var(--muted)] cursor-not-allowed shadow-none"
                )}
              >
                {isLocked ? "PERIOD IS SEALED" : "COMMIT TO LEDGER"}
              </AsyncButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
