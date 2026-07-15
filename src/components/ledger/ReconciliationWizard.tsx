import { useLedgerStore } from '../../stores/useLedgerStore';
import { TruthEngine } from '../../modules/truth/TruthEngine';
import React,
 { useState, useMemo } from 'react';
import { Transaction, ChartAccount } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  CheckSquare,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ReconciliationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  
  accounts: ChartAccount[];
  onComplete: (data: any) => void;
  formatCurrency: (val: number) => string;
}

export default function ReconciliationWizard({ isOpen, onClose, accounts, onComplete, formatCurrency }: ReconciliationWizardProps) {
  const transactions = useLedgerStore(state => state.transactions || []);
  
  const [step, setStep] = useState(1);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [statementDate, setStatementDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endingBalance, setEndingBalance] = useState<string>('0');
  const [reconciledIds, setReconciledIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const account = useMemo(() => accounts.find(a => a.name === selectedAccount), [accounts, selectedAccount]);
  
  const filteredTransactions = useMemo(() => {
    if (!selectedAccount) return [];
    return (transactions || []).filter(t => 
      t.lines?.some(l => l.accountName === selectedAccount) && 
      !t.clearedAt &&
      (t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.totalAmountCents.toString().includes(searchTerm))
    ).map(t => ({
      ...t,
      // For reconciliation, we care about the amount specifically for the selected account
      relevantAmountCents: t.lines?.find(l => l.accountName === selectedAccount)?.amountCents || 0
    }));
  }, [selectedAccount, searchTerm]);

  const stats = useMemo(() => {
    const cleared = filteredTransactions
      .filter(t => reconciledIds.includes(t.id))
      .reduce((sum, t) => sum + t.relevantAmountCents, 0);
    
    const beginningBalance = account?.balanceCents || 0;
    const targetBalance = TruthEngine.parseAmountToCents(endingBalance);
    const currentBalance = beginningBalance + cleared;
    const difference = targetBalance - currentBalance;

    return { cleared, beginningBalance, targetBalance, currentBalance, difference };
  }, [filteredTransactions, reconciledIds, account, endingBalance]);

  const handleToggle = (id: string) => {
    setReconciledIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAutoMatch = () => {
    const targetAmountCents = TruthEngine.parseAmountToCents(endingBalance);
    const currentTotal = account?.balanceCents || 0;
    const needed = targetAmountCents - currentTotal;

    // Greedy matching algorithm for exact amounts
    const matches: string[] = [];
    let matchedSum = 0;

    // Sort by amount to try and find combinations (simplified for now)
    const sorted = [...filteredTransactions].sort((a, b) => Math.abs(b.relevantAmountCents) - Math.abs(a.relevantAmountCents));

    sorted.forEach(t => {
      if (Math.abs(matchedSum + t.relevantAmountCents) <= Math.abs(needed) || Math.abs(t.relevantAmountCents - needed) < 100) {
        matches.push(t.id);
        matchedSum += t.relevantAmountCents;
      }
    });

    setReconciledIds(matches);
    toast.success(`Auto-matched ${matches.length} transactions based on statement balance.`);
  };

  const handleFinalize = () => {
    if (Math.abs(stats.difference) > 0.01) {
      toast.error('Difference must be zero to finalize reconciliation.');
      return;
    }

    onComplete({
      accountId: account?.id,
      accountName: selectedAccount,
      statementDate,
      statementBalanceCents: stats.targetBalance,
      reconciledIds,
      timestamp: new Date().toISOString()
    });
    
    toast.success('Reconciliation finalized successfully');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
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
        className="relative w-full max-w-5xl bg-slate-50 rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh]"
      >
        {/* Header */}
        <div className="p-4 md:p-10 border-b border-slate-200 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-[32px] flex items-center justify-center border border-indigo-600/20 shadow-lg shadow-ledger-accent/10">
              <RefreshCw size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Reconciliation Wizard</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 opacity-40">Step {step} of 2 // {step === 1 ? 'Statement Target Definition' : 'Neural Transaction Alignment'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-slate-50 hover:bg-slate-200 rounded-[32px] flex items-center justify-center text-slate-500 transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-10 bg-slate-50">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="max-w-lg mx-auto space-y-10"
              >
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic ml-2">Select Target Topology</label>
                    <select 
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-black text-slate-900 uppercase italic tracking-tight"
                    >
                      <option value="" className="bg-slate-50">Protocol pending selection...</option>
                      {accounts.filter(a => a.type === 'asset' || a.type === 'liability').map(acc => (
                        <option key={acc.id} value={acc.name} className="bg-slate-50 uppercase">{acc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic ml-2">Statement Horizon</label>
                      <input 
                        type="date"
                        value={statementDate}
                        onChange={(e) => setStatementDate(e.target.value)}
                        className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-black text-slate-900 uppercase italic tracking-tight"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic ml-2">Terminal Quantum Balance ($)</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={endingBalance}
                        onChange={(e) => setEndingBalance(e.target.value)}
                        className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-mono font-black text-slate-900 text-lg italic"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 md:p-8 bg-slate-50/40 border border-slate-200 rounded-[32px] flex gap-5 shadow-inner">
                  <AlertCircle className="text-indigo-600 shrink-0" size={24} />
                  <p className="text-[11px] text-slate-500 leading-relaxed font-bold italic opacity-70">
                    Precision is mandatory. Enter terminal statement values exactly as specified by the regulatory entity. This defines the target resonance for the neural alignment phase.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                {/* Summary Bar */}
                <div className="grid grid-cols-4 gap-6">
                  <div className="p-7 bg-slate-50 rounded-[32px] border border-slate-200 shadow-inner">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 italic">Statement Horizon</p>
                    <p className="text-xl font-black text-slate-900 font-mono italic tracking-tight">{formatCurrency(stats.targetBalance)}</p>
                  </div>
                  <div className="p-7 bg-slate-50 rounded-[32px] border border-slate-200 shadow-inner">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 italic">Aligned Quanta</p>
                    <p className="text-xl font-black text-slate-900 font-mono italic tracking-tight">{formatCurrency(stats.cleared)}</p>
                  </div>
                  <div className="p-7 bg-slate-50 rounded-[32px] border border-slate-200 shadow-inner">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 italic">Current Registry</p>
                    <p className="text-xl font-black text-slate-900 font-mono italic tracking-tight">{formatCurrency(stats.currentBalance)}</p>
                  </div>
                  <div className={cn(
                    "p-7 rounded-[32px] border transition-all shadow-lg",
                    Math.abs(stats.difference) < 1 ? "bg-slate-900/10 border-indigo-600/30" : "bg-rose-500/10 border-rose-500/30"
                  )}>
                    <p className={cn(
                      "text-[9px] font-black uppercase tracking-[0.2em] mb-2 italic",
                      Math.abs(stats.difference) < 1 ? "text-indigo-600" : "text-rose-500"
                    )}>Topology Drift</p>
                    <p className={cn(
                      "text-xl font-black font-mono italic",
                      Math.abs(stats.difference) < 1 ? "text-indigo-600" : "text-rose-500"
                    )}>{formatCurrency(stats.difference)}</p>
                  </div>
                </div>

                {/* Matching Interface */}
                <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-200 bg-slate-50/30 flex justify-between items-center">
                    <div>
                        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] italic">Orphaned Nodes</h3>
                        <p className="text-[8px] font-black text-slate-500 uppercase mt-1 opacity-40">Awaiting registry alignment</p>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input 
                        type="text" 
                        placeholder="Search Registry..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase italic tracking-tight focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-900 w-64 transition-all"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-ledger-line/50 max-h-[400px] overflow-auto scrollbar-thin scrollbar-thumb-ledger-line">
                    {filteredTransactions.map(t => (
                      <div 
                        key={t.id}
                        onClick={() => handleToggle(t.id)}
                        className={cn(
                          "p-6 flex items-center justify-between hover:bg-slate-50/40 transition-all cursor-pointer group",
                          reconciledIds.includes(t.id) && "bg-indigo-600/[0.03]"
                        )}
                      >
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all transform",
                            reconciledIds.includes(t.id) ? "bg-indigo-600 border-indigo-600 text-white scale-105" : "border-slate-200 bg-slate-50 group-hover:bg-slate-200/50"
                          )}>
                            {reconciledIds.includes(t.id) && <CheckSquare size={16} />}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase italic tracking-tight">{t.description}</p>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 opacity-50">{format(new Date(t.date), 'MMM dd, yyyy')} // NODE_ID: {t.id.substring(0,8)}</p>
                          </div>
                        </div>
                        <p className="text-sm font-black font-mono text-slate-900 italic tracking-tight">
                          {formatCurrency(t.relevantAmountCents)}
                        </p>
                      </div>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <div className="p-24 text-center text-slate-500 font-medium uppercase tracking-wider truncate text-[10px] italic opacity-20">No orphaned directives detected in current topology</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-10 border-t border-slate-200 flex justify-between bg-slate-50/20">
          {step === 2 && (
            <button 
              onClick={() => setStep(1)}
              className="flex items-center gap-3 px-8 py-4 bg-slate-50 text-slate-500 rounded-[32px] font-black uppercase tracking-[0.2em] text-[10px] border border-slate-200 hover:text-slate-900 transition-all"
            >
              <ChevronLeft size={18} />
              Rollback
            </button>
          )}
          <div className="flex-1" />
          {step === 1 ? (
            <button 
              onClick={() => {
                if (!selectedAccount) {
                  toast.error('TOPOLOGY PENDING: SELECT ACCOUNT');
                  return;
                }
                setStep(2);
              }}
              className="flex items-center gap-3 px-12 py-4 bg-indigo-600 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-xl shadow-ledger-accent/20"
            >
              Initialize Matching Protocol
              <ChevronRight size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-5">
              <button 
                onClick={handleAutoMatch}
                className="flex items-center gap-3 px-8 py-4 bg-slate-50 text-indigo-600 rounded-[32px] font-black uppercase tracking-[0.1em] text-[10px] border border-indigo-600/20 hover:bg-indigo-600/10 transition-all"
              >
                <Sparkles size={18} />
                Neural Auto-Match
              </button>
              <button 
                onClick={handleFinalize}
                className={cn(
                  "flex items-center gap-3 px-12 py-4 rounded-[32px] font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl",
                  Math.abs(stats.difference) < 1 
                    ? "bg-slate-900 text-white hover:brightness-110 shadow-ledger-google-blue/20" 
                    : "bg-slate-50 text-slate-500/30 cursor-not-allowed border border-slate-200 grayscale"
                )}
              >
                <CheckCircle2 size={18} />
                Finalize Alignment
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
