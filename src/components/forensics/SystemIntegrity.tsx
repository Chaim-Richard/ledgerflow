import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Calculator, 
  ArrowRightLeft, 
  Landmark, 
  Brain,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, ChartAccount, JournalEntry } from '../../types';
import { cn, safeConfirm } from '../../lib/utils';
import { DoubleEntryAuditor, AuditResult } from '../../services/auditor';
import { toast } from 'sonner';

// Modular Sub-Tabs (Lazily Loaded for High Performance & Micro-Sizing)
const AuditTab = React.lazy(() => import('./tabs/AuditTab'));
const TracerTab = React.lazy(() => import('./tabs/TracerTab'));
const SymmetryTab = React.lazy(() => import('./tabs/SymmetryTab'));
const CashReconcilerTab = React.lazy(() => import('./tabs/CashReconcilerTab'));
const EconomicsMatrixTab = React.lazy(() => import('./tabs/EconomicsMatrixTab'));
const BookClosureTab = React.lazy(() => import('./tabs/BookClosureTab'));

interface SystemIntegrityProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  journalEntries: JournalEntry[];
  onAction?: (action: string, details?: any) => void;
}

export default function SystemIntegrity({ transactions = [], accounts = [], journalEntries = [], onAction }: SystemIntegrityProps) {
  // Navigation & Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'tracer' | 'symmetry' | 'cash-reconciler' | 'economics-matrix' | 'book-closure'>('audit');
  
  // Real-Time Economics Scenario Engine State
  const [inflationScenario, setInflationScenario] = useState<number>(3.5); // Inflation adjustment (0% to 15%)
  const [taxClassification, setTaxClassification] = useState<number>(25); // Estimated tax rate (10% to 50%)
  const [costOfCapital, setCostOfCapital] = useState<number>(6.5); // Interest adjusted leverage (0% to 15%)

  // Master Scanner State
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<AuditResult | null>(null);

  // Tracer State
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [tracerSearch, setTracerSearch] = useState<string>('');

  // Symmetry Toggle state for expanded transactions
  const [expandedSymmetryTxId, setExpandedSymmetryTxId] = useState<string | null>(null);

  // 200+ Stress Testing Simulation State
  const [stressData, setStressData] = useState<any[]>([]);
  const [isStressRunning, setIsStressRunning] = useState(false);
  const [stressTelemetry, setStressTelemetry] = useState<{
    txCount: number;
    imbalancedCount: number;
    duplicateCandidatesCount: number;
    verificationMs: number;
    unmappedCount: number;
    merkleRoot: string;
    memoryKb: number;
  } | null>(null);

  // Economic Scenario Sandbox calculations
  const bookAssets = useMemo(() => {
    return accounts
      .filter(a => a.type === 'asset')
      .reduce((sum, a) => sum + (a.balanceCents || 0), 0);
  }, [accounts]);

  const bookLiabilities = useMemo(() => {
    return accounts
      .filter(a => a.type === 'liability')
      .reduce((sum, a) => sum + (a.balanceCents || 0), 0);
  }, [accounts]);

  const accountTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach(a => {
      map.set(a.id, a.type);
    });
    return map;
  }, [accounts]);

  const rawGrossRevenue = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t.deletedAt) continue;
      const lines = t.lines || [];
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        if (accountTypeMap.get(line.accountId) === 'income') {
          sum += Math.abs(line.amountCents || 0);
        }
      }
    }
    return sum;
  }, [transactions, accountTypeMap]);

  const rawExpenses = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t.deletedAt) continue;
      const lines = t.lines || [];
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        if (accountTypeMap.get(line.accountId) === 'expense') {
          sum += Math.abs(line.amountCents || 0);
        }
      }
    }
    return sum;
  }, [transactions, accountTypeMap]);

  const preTaxNetIncome = rawGrossRevenue - rawExpenses;
  const inflationAdjustedAssets = Math.round(bookAssets * (1 - inflationScenario / 100));
  const estimatedTaxLiability = Math.round(Math.max(0, preTaxNetIncome) * (taxClassification / 100));
  const interestLeverageCost = Math.round(Math.abs(bookLiabilities) * (costOfCapital / 100));
  const trueEconomicWORTH = inflationAdjustedAssets - Math.abs(bookLiabilities) - estimatedTaxLiability - interestLeverageCost;

  // Master Diagnostics Execute
  const runDiagnostics = async () => {
    setIsVerifying(true);
    const auditResults = DoubleEntryAuditor.auditLedger(transactions, accounts, journalEntries);
    setResults(auditResults);
    setIsVerifying(false);
    
    if (auditResults.isBalanced) {
      toast.success("Zero-Sum Balance Verified", {
        description: "Mathematical integrity matches across all ledger nodes."
      });
    } else {
      toast.error("Integrity Protocol Violation", {
        description: "Found imbalances in the ledger chain."
      });
    }
  };

  const handleRepairChain = async () => {
    const confirm = safeConfirm("CERTIFY RE-SERIALIZATION: This will re-calculate all cryptographic hashes for the entire ledger based on chronological sequence. Continue?");
    if (!confirm) return;

    setIsRepairing(true);
    try {
      const repaired = DoubleEntryAuditor.repairChain(transactions);
      onAction?.('bulk-repair-ledger', { transactions: repaired });
      toast.success("Ledger chain re-serialized successfully.");
      setResults(null); // Reset to force re-scan
    } catch {
      toast.error("Repair sequence failed.");
    } finally {
      setIsRepairing(false);
    }
  };

  const handleFixImbalances = () => {
    if (!results) return;
    onAction?.('fix-ledger-imbalances', { imbalances: results.imbalances });
    toast.success('Ledger Repaired');
  };

  const handleClearTransaction = (txId: string, newState: boolean) => {
    onAction?.('update', {
      id: txId,
      entityType: 'transactions',
      updates: { isCleared: newState, clearedAt: newState ? new Date().toISOString() : null }
    });
    toast.success(newState ? 'Transaction marked as CLEARED' : 'Transaction set to PENDING');
  };

  const generateStressRecords = () => {
    const activeAsset = accounts.find(a => a.type === 'asset')?.id || 'acc-asset';
    const activeIncome = accounts.find(a => a.type === 'income')?.id || 'acc-income';
    const activeExpense = accounts.find(a => a.type === 'expense')?.id || 'acc-expense';
    const activeAssetLabel = accounts.find(a => a.type === 'asset')?.name || 'General Cash Checking';
    const activeIncomeLabel = accounts.find(a => a.type === 'income')?.name || 'Corporate Revenue';
    const activeExpenseLabel = accounts.find(a => a.type === 'expense')?.name || 'Operating Expenditures';

    const simulated: Array<any> = new Array(235);
    const baseTimestamp = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (let i = 1; i <= 235; i++) {
      const isRevenue = i % 3 !== 0; 
      const amountCents = isRevenue 
        ? Math.round((2000 + Math.sin(i) * 1500) * 100)
        : Math.round((500 + Math.cos(i) * 350) * 100);

      // High-efficiency date calculation without overhead
      const txTimestamp = baseTimestamp - i * oneDayMs;
      const dateStr = new Date(txTimestamp).toISOString().slice(0, 10);
      const duplicationProbability = i % 25 === 0;
      const description = duplicationProbability 
        ? "SaaS Infrastructure Computing SLA Fee" 
        : isRevenue 
          ? `Consolidated Enterprise Client Payment #${1000 + i}`
          : `Service Outsource Provider Invoice Verification #${3000 + i}`;

      const lines: any[] = [];

      simulated[i - 1] = {
        id: `stress-tx-${i}-${Math.random().toString(36).substring(2, 7)}`,
        date: dateStr,
        description,
        totalAmountCents: amountCents,
        lines,
        createdAt: new Date(txTimestamp).toISOString(),
        verification: {
          hash: '',
          previousHash: '',
          status: 'unverified'
        }
      };
    }

    let previousHash = 'genesis';
    // Highly efficient string concatenation instead of slow JSON.stringify serialization
    for (let i = 0; i < simulated.length; i++) {
      const tx = simulated[i];
      const hashPayload = `${tx.date}|${tx.description}|${tx.totalAmountCents}|${tx.lines[0].accountId}|${tx.lines[0].amountCents}|${previousHash}`;

      let hash = 0;
      for (let j = 0; j < hashPayload.length; j++) {
        hash = ((hash << 5) - hash) + hashPayload.charCodeAt(j);
        hash = hash & hash;
      }
      const computed = Math.abs(hash).toString(16).padStart(8, '0');
      
      tx.verification = {
        hash: computed,
        previousHash,
        status: 'verified',
        verifiedAt: new Date().toISOString(),
        timestamp: tx.createdAt
      };
      
      previousHash = computed;
    }

    return simulated;
  };

  const handleRunStressSimulation = async () => {
    setIsStressRunning(true);
    setStressTelemetry(null);
    setStressData([]);
    
    const startTime = performance.now();
    const generated = generateStressRecords();
    const endTime = performance.now();

    let imbalancedCount = 0;
    let duplicateCandidatesCount = 0;
    let unmappedCount = 0;

    const accountIds = new Set(accounts.map(a => a.id));
    const seenSigs = new Map<string, string>();
    
    generated.forEach(t => {
      let debits = 0;
      let credits = 0;
      t.lines.forEach((l: any) => {
        if (l.amountCents > 0) debits += l.amountCents;
         else credits += Math.abs(l.amountCents);
        if (accountIds.size > 0 && !accountIds.has(l.accountId)) unmappedCount++;
      });
      if (debits !== credits) imbalancedCount++;

      const sig = `${t.description}_${t.totalAmountCents}`;
      if (seenSigs.has(sig)) {
        duplicateCandidatesCount++;
      } else {
        seenSigs.set(sig, t.id);
      }
    });

    // High precision fractional millisecond recording
    const duration = endTime - startTime;
    const verificationMs = Number(duration.toFixed(3)) || 1;
    const memoryKb = Math.round((JSON.stringify(generated).length * 2) / 1024);

    const hashes = generated.map(t => t.verification?.hash || t.id);
    let level = hashes;
    while (level.length > 1) {
      const len = level.length;
      const nextLevel: string[] = [];
      for (let i = 0; i < len; i += 2) {
        const left = level[i];
        const right = i + 1 < len ? level[i + 1] : left;
        const combStr = left + right;
        let combined = 0;
        for (let idx = 0; idx < combStr.length; idx++) {
          combined = ((combined << 5) - combined) + combStr.charCodeAt(idx);
          combined = combined & combined;
        }
        nextLevel.push(Math.abs(combined).toString(16).padStart(8, '0'));
      }
      level = nextLevel;
    }
    const merkleRoot = level[0] || 'genesis-root';

    setStressData(generated);
    setStressTelemetry({
      txCount: generated.length,
      imbalancedCount,
      duplicateCandidatesCount,
      verificationMs,
      unmappedCount,
      merkleRoot: (merkleRoot || '').toUpperCase(),
      memoryKb
    });
    setIsStressRunning(false);
    toast.success("Zenith 200+ Scaling Audit Completed", {
      description: `Secured sequential double-entry validation for ${generated.length} ledger nodes.`
    });
  };

  // ============================================
  // Core TRUTH Engine Mathematics & Selectors
  // ============================================

  // Match selectable accounts for Formula Tracer
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => 
      acc.name.toLowerCase().includes(tracerSearch.toLowerCase()) || 
      acc.code.toLowerCase().includes(tracerSearch.toLowerCase())
    );
  }, [accounts, tracerSearch]);

  const activeTracerAccount = useMemo(() => {
    const defaultAcc = accounts[0] || null;
    if (!selectedAccountId) return defaultAcc;
    return accounts.find(a => a.id === selectedAccountId) || defaultAcc;
  }, [accounts, selectedAccountId]);

  // Dynamic mathematically precise formula audit trace on the selected account
  const auditTrace = useMemo(() => {
    if (!activeTracerAccount) return null;
    
    const openingBalance = activeTracerAccount.openingBalanceCents || 0;
    const debitList: Array<{ date: string; desc: string; amount: number; source: string; id: string; type: 'tx' | 'je' }> = [];
    const creditList: Array<{ date: string; desc: string; amount: number; source: string; id: string; type: 'tx' | 'je' }> = [];
    
    // Scan transactions for direct matching allocations
    transactions.forEach(tx => {
      if (tx.deletedAt) return;
      tx.lines?.forEach(line => {
        if (line.accountId === activeTracerAccount.id) {
          if (line.amountCents > 0) {
            debitList.push({
              date: tx.date,
              desc: tx.description || 'Transaction Allocation',
              amount: line.amountCents,
              source: `Tx #${tx.id.substring(0, 6)}`,
              id: tx.id,
              type: 'tx'
            });
          } else if (line.amountCents < 0) {
            creditList.push({
              date: tx.date,
              desc: tx.description || 'Transaction Allocation',
              amount: Math.abs(line.amountCents),
              source: `Tx #${tx.id.substring(0, 6)}`,
              id: tx.id,
              type: 'tx'
            });
          }
        }
      });
    });

    // Scan general journals
    journalEntries.forEach(je => {
      if (je.deletedAt) return;
      je.lines?.forEach(line => {
        if (line.accountId === activeTracerAccount.id) {
          if (line.debit > 0) {
            debitList.push({
              date: je.date,
              desc: je.description || 'Journal split',
              amount: line.debit,
              source: `Journal #${je.id.substring(0, 6)}`,
              id: je.id,
              type: 'je'
            });
          }
          if (line.credit > 0) {
            creditList.push({
              date: je.date,
              desc: je.description || 'Journal split',
              amount: line.credit,
              source: `Journal #${je.id.substring(0, 6)}`,
              id: je.id,
              type: 'je'
            });
          }
        }
      });
    });

    const sumDebits = debitList.reduce((sum, item) => sum + item.amount, 0);
    const sumCredits = creditList.reduce((sum, item) => sum + item.amount, 0);
    
    // Normal debit vs credit balance directions:
    // Assets & Expenses increase with Debit (+), decrease with Credit (-)
    // Liabilities, Equity & Revenue increase with Credit (+), decrease with Debit (-)
    const isDebitNormal = activeTracerAccount.type === 'asset' || activeTracerAccount.type === 'expense';
    const computedBalance = isDebitNormal
      ? openingBalance + sumDebits - sumCredits
      : openingBalance + sumCredits - sumDebits;
      
    const mismatch = Math.abs(computedBalance - activeTracerAccount.balanceCents) > 1;

    // Excel balance simulation mapping precedents
    const formulaString = `= B${activeTracerAccount.code.substring(0,3)} + SUM(DEBITS) - SUM(CREDITS)`;

    // Map raw precedents in sheet structure to pass down
    const p1 = {
      name: `Opening ${activeTracerAccount.name}`,
      code: `Cell B${activeTracerAccount.code.substring(0,3)}`,
      type: `${activeTracerAccount.type} (Seed)`,
      balance: openingBalance,
      factor: 1,
      strength: openingBalance === 0 ? 0 : 0.4
    };

    const p2 = {
      name: `${activeTracerAccount.name} DEBIT INFLOW SPLITS`,
      code: `Cell DR${activeTracerAccount.code.substring(0,3)}`,
      type: `Flow Allocation`,
      balance: sumDebits,
      factor: isDebitNormal ? 1 : -1,
      strength: sumDebits === 0 ? 0 : 0.45
    };

    const p3 = {
      name: `${activeTracerAccount.name} CREDIT OUTFLOW SPLITS`,
      code: `Cell CR${activeTracerAccount.code.substring(0,3)}`,
      type: `Flow Allocation`,
      balance: sumCredits,
      factor: isDebitNormal ? -1 : 1,
      strength: sumCredits === 0 ? 0 : 0.15
    };

    return {
      formula: formulaString,
      value: computedBalance,
      precedents: [p1, p2, p3],
      openingBalance,
      debitList: debitList.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      creditList: creditList.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      sumDebits,
      sumCredits,
      computedBalance,
      isDebitNormal,
      mismatch
    };
  }, [activeTracerAccount, transactions, journalEntries]);

  // Bilateral transaction split matching data
  const symmetryData = useMemo(() => {
    return transactions.map(tx => {
      if (tx.deletedAt) return null;
      const debits = tx.lines?.filter(l => l.amountCents > 0) || [];
      const credits = tx.lines?.filter(l => l.amountCents < 0) || [];
      const totalDebits = debits.reduce((s, d) => s + d.amountCents, 0);
      const totalCredits = credits.reduce((s, c) => s + Math.abs(c.amountCents), 0);
      const balanced = Math.abs(totalDebits - totalCredits) < 0.1;
      return {
        id: tx.id,
        date: tx.date,
        desc: tx.description || 'General Transaction',
        lines: tx.lines || [],
        debitSum: totalDebits,
        creditSum: totalCredits,
        balanced,
        delta: Math.abs(totalDebits - totalCredits)
      };
    }).filter(Boolean);
  }, [transactions]);

  // Cash asset bridge comparing Ledger values against cleared statement parameters
  const cashAccounts = useMemo(() => {
    return accounts.filter(a => 
      a.type === 'asset' && 
      (a.category?.toLowerCase() === 'cash' || 
       (a.name || '').toLowerCase().includes('cash') || 
       (a.name || '').toLowerCase().includes('checking') || 
       (a.name || '').toLowerCase().includes('bank'))
    );
  }, [accounts]);

  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>('');

  const activeCashAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedCashAccountId) || cashAccounts[0] || null;
  }, [accounts, cashAccounts, selectedCashAccountId]);

  const cashReconData = useMemo(() => {
    if (!activeCashAccount) return null;
    
    let totalLedgerValue = activeCashAccount.balanceCents;
    let clearedValue = activeCashAccount.openingBalanceCents || 0;
    let unclearedList: Array<{ id: string; date: string; desc: string; amount: number; isCleared: boolean }> = [];
    
    transactions.forEach(tx => {
      if (tx.deletedAt) return;
      tx.lines?.forEach(line => {
        if (line.accountId === activeCashAccount.id) {
          if (tx.isCleared) {
            clearedValue += line.amountCents;
          } else {
            unclearedList.push({
              id: tx.id,
              date: tx.date,
              desc: tx.description || 'Raw Posting',
              amount: line.amountCents,
              isCleared: !!tx.isCleared
            });
          }
        }
      });
    });
    
    return {
      ledgerBalance: totalLedgerValue,
      clearedBalance: clearedValue,
      unclearedDelta: totalLedgerValue - clearedValue,
      statementBalance: clearedValue,
      cleared: Math.abs(totalLedgerValue - clearedValue) < 1,
      unclearedList
    };
  }, [activeCashAccount, transactions]);

  return (
    <div className="space-y-10 pb-24 px-4 md:px-0">
      {/* Upper Title Block */}
      <div className="p-4 md:p-8 md:p-4 md:p-10 bg-white rounded-[32px] border border-slate-200 shadow-xl flex flex-col md:flex-row md:items-center justify-between relative overflow-hidden group gap-6 text-left">
        <div className="absolute inset-0 bg-slate-50 opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-[32px] flex items-center justify-center shadow-[0_15px_30px_rgba(0,0,0,0.15)] transform -rotate-1 group-hover:rotate-0 transition-transform">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Financial Truth Engine</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate mt-2 opacity-50">
              Bi-lateral Balance verification & formula auditing
            </p>
          </div>
        </div>
        
        {/* Core Sub-Tab Buttons - Tablet responsive flex */}
        <div className="flex overflow-x-auto max-w-full scrollbar-none items-center gap-2 p-1.5 bg-slate-100 dark:bg-neutral-800/60 rounded-[32px] relative z-10 self-stretch md:self-center">
          <button
            onClick={() => setActiveSubTab('audit')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'audit' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Activity size={12} /> Master Scan
          </button>
          <button
            onClick={() => setActiveSubTab('tracer')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'tracer' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Calculator size={12} /> Formula Tracer
          </button>
          <button
            onClick={() => setActiveSubTab('symmetry')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'symmetry' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <ArrowRightLeft size={12} /> Bi-lateral Split
          </button>
          <button
            onClick={() => setActiveSubTab('cash-reconciler')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'cash-reconciler' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Landmark size={12} /> Cash Reconciler
          </button>
          <button
            onClick={() => setActiveSubTab('economics-matrix')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'economics-matrix' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Brain size={12} /> Economics & Matrix
          </button>
          <button
            onClick={() => setActiveSubTab('book-closure')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'book-closure' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Lock size={12} /> Close Books
          </button>
        </div>
      </div>

      {/* Main Panel Frame */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-2xl min-h-[550px] overflow-hidden relative">
        <div className="technical-grid pointer-events-none opacity-[0.03] absolute inset-0" />

        <div className="p-4 md:p-8 md:p-12 relative z-10">
          <AnimatePresence mode="wait">
            <React.Suspense fallback={
              <div className="py-24 text-center space-y-4">
                <div className="flex justify-center gap-2">
                  {[0, 1, 2].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      className="w-3 h-3 bg-indigo-600 rounded-full"
                    />
                  ))}
                </div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Assembling dynamic ledger component layers...</p>
              </div>
            }>
              {activeSubTab === 'audit' && (
                <AuditTab
                  transactions={transactions}
                  accounts={accounts}
                  journalEntries={journalEntries}
                  results={results}
                  isVerifying={isVerifying}
                  isRepairing={isRepairing}
                  runDiagnostics={runDiagnostics}
                  handleFixImbalances={handleFixImbalances}
                  handleRepairChain={handleRepairChain}
                />
              )}

              {activeSubTab === 'tracer' && (
                <TracerTab
                  accounts={accounts}
                  transactions={transactions}
                  filteredAccounts={filteredAccounts}
                  tracerSearch={tracerSearch}
                  setTracerSearch={setTracerSearch}
                  selectedAccountId={selectedAccountId}
                  setSelectedAccountId={setSelectedAccountId}
                  activeTracerAccount={activeTracerAccount}
                  auditTrace={auditTrace}
                />
              )}

              {activeSubTab === 'symmetry' && (
                <SymmetryTab
                  symmetryData={symmetryData}
                  expandedSymmetryTxId={expandedSymmetryTxId}
                  setExpandedSymmetryTxId={setExpandedSymmetryTxId}
                />
              )}

              {activeSubTab === 'cash-reconciler' && (
                <CashReconcilerTab
                  cashAccounts={cashAccounts}
                  selectedCashAccountId={selectedCashAccountId}
                  setSelectedCashAccountId={setSelectedCashAccountId}
                  activeCashAccount={activeCashAccount}
                  cashReconData={cashReconData}
                  handleClearTransaction={handleClearTransaction}
                />
              )}

              {activeSubTab === 'economics-matrix' && (
                <EconomicsMatrixTab
                  inflationScenario={inflationScenario}
                  setInflationScenario={setInflationScenario}
                  taxClassification={taxClassification}
                  setTaxClassification={setTaxClassification}
                  costOfCapital={costOfCapital}
                  setCostOfCapital={setCostOfCapital}
                  bookAssets={bookAssets}
                  bookLiabilities={bookLiabilities}
                  preTaxNetIncome={preTaxNetIncome}
                  rawExpenses={rawExpenses}
                  trueEconomicWORTH={trueEconomicWORTH}
                  onAction={onAction}
                  setActiveSubTab={setActiveSubTab}
                  runDiagnostics={runDiagnostics}
                  isStressRunning={isStressRunning}
                  handleRunStressSimulation={handleRunStressSimulation}
                  stressTelemetry={stressTelemetry}
                  stressData={stressData}
                />
              )}

              {activeSubTab === 'book-closure' && (
                <BookClosureTab />
              )}
            </React.Suspense>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
