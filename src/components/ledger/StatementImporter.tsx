import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Check, 
  AlertCircle, 
  Loader2,
  ArrowRight,
  Activity,
  Upload,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../../types';
import { aiService } from '../../services/aiService';
import { IntentResolver } from '../../lib/intentResolver';
import { cn, getLocalDateISO } from '../../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { BloomFilter, MinHash, AnalyticalMatcher } from '../../lib/algorithms';

interface StatementImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (transactions: any[]) => void;
  existingTransactions: Transaction[];
  businessContext: string;
  accounts: any[];
  autoRules?: any[];
  patternCache?: Record<string, any>;
}

interface ParsedTx {
  date: string;
  description: string;
  amountCents: number;
  isDuplicate?: boolean;
  selected: boolean;
  hasResolvedEntity?: boolean;
  resolutionScore?: number;
  suggestedAccount?: string;
  suggestedProjectId?: string;
  suggestedProject?: string;
  isLearned?: boolean;
  lines?: Array<{
    description: string;
    amountCents: number;
    quantity?: number;
    unitPriceCents?: number;
    category?: string;
    tags?: string[];
  }>;
}

export default function StatementImporter({ 
  isOpen, 
  onClose, 
  onImport, 
  existingTransactions,
  businessContext,
  accounts,
  autoRules,
  patternCache
}: StatementImporterProps) {
  const user = useAuthStore(s => s.user);
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedTxs, setParsedTxs] = useState<ParsedTx[]>([]);
  const [step, setStep] = useState<'input' | 'mapping' | 'review'>('input');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState({ date: -1, description: -1, amount: -1 });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const loader = toast.loading(`Analytical engine analyzing ${file.name}...`);
    
    try {
      const labels = accounts.map(a => a.name);
      let results: any[] = [];
      
      const fileType = file.type;
      
      if (fileType.startsWith('image/')) {
        const result = await aiService.parseReceipt(file, undefined, patternCache, labels);
        if (result) {
          results = [{
            date: result.date || getLocalDateISO(),
            description: result.vendorName,
            amountCents: result.totalAmountCents,
            categorySuggestion: result.categorySuggestion,
            lines: result.lines || []
          }];
        }
      } else {
        results = await aiService.parseStatement(file, businessContext, undefined, patternCache, labels);
      }
      
      if (results && results.length > 0) {
        processResults(results);
        toast.success(`Analytical Intelligence extracted ${results.length} nodes from ${file.name}`, { id: loader });
      } else {
        toast.error('AI was unable to identify fiscal nodes in this file.', { id: loader });
      }
    } catch (error) {
      toast.error('Parsing failure', { id: loader });
      console.error(error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleMapColumns = () => {
    if (mapping.date === -1 || mapping.description === -1 || mapping.amount === -1) {
      toast.error("Please map all required columns (Date, Description, Amount)");
      return;
    }

    const dataRows = csvData.slice(1); // Assume first row is header
    const results = dataRows.map(row => {
      const amountStr = row[mapping.amount]?.replace(/[$,]/g, '');
      const amountCents = TruthEngine.parseAmountToCents(amountStr || '0');
      return {
        date: row[mapping.date],
        description: row[mapping.description],
        amountCents
      };
    }).filter(tx => tx.date && tx.description && !isNaN(tx.amountCents));

    processResults(results);
  };

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const labels = accounts.map(a => a.name);
      const results = IntentResolver.resolveEntry(rawText, { accounts: accounts.map(a => ({ id: a.id, name: a.name })), ruleCache: patternCache });
      if (results && results.length > 0) {
        processResults(results);
      } else {
        const fallbackResults = await aiService.parseStatement(rawText, businessContext, undefined, patternCache, labels);
        processResults(fallbackResults);
      }
    } catch (error) {
      console.error("Parsing error:", error);
    } finally {
      setIsParsing(false);
    }
  };

  const processResults = (results: any[]) => {
    // THE HARD WORK: Layer 2 - Entity Resolution
    // Using Bloom for exact match and MinHash for structural similarity
    const bloom = new BloomFilter(Math.max(1000, existingTransactions.length * 10), 7);
    const minHash = new MinHash(128, user?.uid || ''); // 128 hashes per signature
    
    const existingSignatures = existingTransactions.map(et => ({
      id: et.id,
      sig: minHash.createSignature(et.description)
    }));
    
    // Warm up the filter
    existingTransactions.forEach(et => {
      bloom.add(`${et.date}-${et.totalAmountCents}-${et.description.toLowerCase()}`);
    });

    const processed = results.map((tx: any) => {
      const txKey = `${tx.date}-${Math.abs(tx.amountCents)}-${tx.description.toLowerCase()}`;
      
      // Fast bitwise lookup (Deduplication)
      let isDuplicate = bloom.has(txKey);
      
      // Verification of potential collisions
      if (isDuplicate) {
         isDuplicate = existingTransactions.some(et => 
            et.date === tx.date && 
            Math.abs(et.totalAmountCents - Math.abs(tx.amountCents)) < 1
         );
      }

      // 1. Check Analytical Memory/Cache for learned patterns (Project + Account)
      const learned = AnalyticalMatcher.predict(tx.description, patternCache as any);
      
      const suggestedAccount = learned?.accountName || tx.categorySuggestion || learned?.accountId;
      const suggestedProjectId = learned?.projectId;
      const suggestedProject = learned?.projectName;
      const isLearned = !!learned;

      // Pattern Recognition (Near Duplicate Detection for UI feedback)
      const currentSig = minHash.createSignature(tx.description);
      const similarity = existingSignatures.reduce((max, prev) => {
        const sim = minHash.compare(currentSig, prev.sig);
        return Math.max(max, sim);
      }, 0);

      return {
        ...tx,
        isDuplicate,
        hasResolvedEntity: isLearned || similarity > 0.85,
        isLearned,
        suggestedAccount,
        suggestedProjectId,
        suggestedProject,
        resolutionScore: isLearned ? (learned?.confidence || 1.0) : similarity,
        selected: !isDuplicate
      };
    });
    
    setParsedTxs(processed);
    setStep('review');
  };

  const handleImport = () => {
    const toImport = parsedTxs.filter(t => t.selected);
    onImport(toImport);
    onClose();
    setStep('input');
    setRawText('');
    setParsedTxs([]);
  };

  const toggleSelect = (index: number) => {
    setParsedTxs(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  };

  const toggleAll = () => {
    const allSelected = parsedTxs.every(t => t.selected);
    setParsedTxs(prev => prev.map(t => ({ ...t, selected: !allSelected })));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden flex flex-col max-h-[90dvh]"
      >
        {/* Header */}
        <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--surface)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--brass-soft)] border border-[var(--brass-line)] rounded-xl flex items-center justify-center text-[var(--brass)]">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[var(--text)] tracking-tight">Statement Intelligence</h2>
              <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-wider">Rule Parsing & Causal Deduplication</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--ink)] rounded-full transition-all text-[var(--muted)] cursor-pointer">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {step === 'input' ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="micro-label">Paste Statement Text or Upload CSV</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        id="csv-upload" 
                        accept=".csv,.txt"
                        className="hidden" 
                        onChange={handleFileUpload}
                      />
                      <label 
                        htmlFor="csv-upload"
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-medium uppercase tracking-wider hover:bg-zinc-200 transition-all cursor-pointer"
                      >
                        <Upload size={14} />
                        Upload CSV / Excel
                      </label>
                    </div>
                  </div>
                  <textarea 
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste raw text from your bank statement, CSV, or PDF export here..."
                    className="w-full h-64 p-6 bg-[var(--surface)] border border-[var(--line)] rounded-2xl font-mono text-sm text-[var(--text)] focus:border-[var(--brass-line)] outline-none transition-all resize-none"
                  />
                </div>
              </motion.div>
            ) : step === 'mapping' ? (
              <motion.div 
                key="mapping"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="p-6 bg-[var(--ink)] border border-[var(--line)] rounded-2xl text-[var(--text)]">
                  <h3 className="text-xl font-black mb-1 uppercase tracking-tight">Configure Deterministic Mapping</h3>
                  <p className="text-xs text-[var(--muted)] font-medium">Match your file columns to the LedgerFlow protocol fields.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['date', 'description', 'amount'] as const).map(field => (
                    <div key={field} className="space-y-3">
                      <label className="micro-label !text-[var(--text)] capitalize">{field} Column</label>
                      <select 
                        value={mapping[field]}
                        onChange={(e) => setMapping({...mapping, [field]: parseInt(e.target.value, 10)})}
                        className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl font-bold text-sm text-[var(--text)] outline-none focus:border-[var(--brass-line)] cursor-pointer"
                      >
                        <option value={-1}>Select Column</option>
                        {csvData[0]?.map((col, idx) => (
                          <option key={idx} value={idx}>{col || `Column ${idx + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="border border-[var(--line)] rounded-2xl overflow-hidden">
                  <div className="p-4 bg-[var(--surface)] border-b border-[var(--line)]">
                    <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Data Preview (First 5 Rows)</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[600px]">
                      <thead>
                        <tr className="bg-[var(--ink)] border-b border-[var(--line)]">
                          {csvData[0]?.map((col, idx) => (
                            <th key={idx} className="p-4 font-black text-[var(--text)] truncate max-w-[150px]">{col || `Col ${idx + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(1, 6).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-[var(--line)]/50">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-4 text-slate-500 font-medium truncate max-w-[150px]">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={toggleAll}
                      className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline"
                    >
                      {parsedTxs.every(t => t.selected) ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                      {parsedTxs.filter(t => t.selected).length} Selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                    <AlertCircle size={12} />
                    {parsedTxs.filter(t => t.isDuplicate).length} Potential Duplicates
                  </div>
                </div>

                <div className="space-y-2">
                  {parsedTxs.map((tx, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "p-4 rounded-xl border transition-all flex flex-col gap-3 group bg-[var(--surface)]",
                        tx.selected 
                          ? "border-[var(--brass-line)] shadow-sm" 
                          : "border-[var(--line)] opacity-60 grayscale bg-[var(--surface)]",
                        tx.isDuplicate && tx.selected && "border-rose-300 bg-rose-500/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div 
                            onClick={(e) => { e.stopPropagation(); toggleSelect(idx); }}
                            className={cn(
                              "w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer",
                              tx.selected ? "bg-[var(--brass)] border-[var(--brass-line)] text-black" : "bg-[var(--surface)] border-[var(--line)]"
                            )}
                          >
                            {tx.selected && <Check size={14} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[10px] font-mono text-[var(--muted)]">{format(new Date(tx.date), 'MMM dd, yyyy')}</p>
                              {tx.hasResolvedEntity && (
                                <span className={cn(
                                  "flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter",
                                  tx.isLearned ? "text-[var(--brass)] bg-[var(--brass-soft)] border-[var(--brass-line)]" : "text-[var(--pos)] bg-[var(--pos)]/10 border-[var(--pos)]/20"
                                )}>
                                  {tx.isLearned ? <Zap size={8} /> : <Activity size={8} />}
                                  {tx.isLearned ? "Rule Memory" : `Pattern Resolved (${Math.round((tx.resolutionScore || 0) * 100)}%)`}
                                  {tx.suggestedAccount && ` → ${tx.suggestedAccount}`}
                                  {tx.suggestedProject && ` [Proj: ${tx.suggestedProject}]`}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-[var(--text)]">{tx.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-sm font-black mono-value",
                            tx.amountCents > 0 ? "text-[var(--pos)]" : "text-[var(--text)]"
                          )}>
                            {tx.amountCents > 0 ? '+' : ''}{(tx.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </p>
                          {tx.isDuplicate && (
                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">Duplicate Detected</span>
                          )}
                        </div>
                      </div>

                      {/* Sub-item Drilldown */}
                      {tx.lines && tx.lines.length > 1 && (
                        <div className="mt-2 pt-2 border-t border-[var(--line)] space-y-1.5 pl-10">
                          {tx.lines.map((item, i) => (
                            <div key={i} className="flex items-center justify-between group/item">
                              <div className="flex flex-col">
                                <p className="text-[11px] font-medium text-[var(--muted)] group-hover/item:text-[var(--text)] transition-colors">
                                  {item.description}
                                  {item.quantity && item.quantity > 1 && (
                                    <span className="ml-2 text-[9px] text-[var(--muted)] font-bold px-1 py-0.5 bg-[var(--surface)] rounded border border-[var(--line)]">
                                      {item.quantity} units @ {( (item.unitPriceCents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </span>
                                  )}
                                </p>
                                {item.category && item.category !== tx.suggestedAccount && (
                                  <span className="text-[8px] text-[var(--brass)] font-medium uppercase tracking-wider">{item.category}</span>
                                )}
                              </div>
                              <p className="text-[10px] font-mono font-bold text-[var(--muted)]">
                                {((item.amountCents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-[var(--line)] bg-[var(--ink)] flex items-center justify-between">
          {step !== 'input' ? (
            <button 
              onClick={() => setStep('input')}
              className="px-5 py-2.5 text-[var(--muted)] font-bold hover:text-[var(--text)] transition-all cursor-pointer text-xs uppercase tracking-wider"
            >
              Back to Input
            </button>
          ) : (
            <div />
          )}
          
          <div className="flex items-center gap-4">
            {step === 'input' ? (
              <button 
                onClick={handleParse}
                disabled={isParsing || !rawText.trim()}
                className="px-8 py-3 bg-[var(--brass)] text-black rounded-xl font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-xs uppercase tracking-wider cursor-pointer"
              >
                {isParsing ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                {isParsing ? 'Rule Analysis...' : 'Unstructured Parse'}
              </button>
            ) : step === 'mapping' ? (
              <button 
                onClick={handleMapColumns}
                className="px-8 py-3 bg-[var(--brass)] text-black rounded-xl font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-md text-xs uppercase tracking-wider cursor-pointer"
              >
                <ArrowRight size={16} />
                Process Deterministic Mapping
              </button>
            ) : (
              <button 
                onClick={handleImport}
                className="px-8 py-3 bg-[var(--brass)] text-black rounded-xl font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-md text-xs uppercase tracking-wider cursor-pointer"
              >
                <Check size={16} />
                Import {parsedTxs.filter(t => t.selected).length} Entries
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
