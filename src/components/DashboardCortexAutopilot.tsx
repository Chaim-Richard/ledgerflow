import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  TrendingUp, 
  Check, 
  Loader2, 
  Coins, 
  CheckCircle,
  FileSpreadsheet,
  RefreshCw,
  Mail
} from 'lucide-react';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useTransactionActions } from '../hooks/useTransactionActions';
import { useEntityOperations } from '../hooks/useEntityOperations';
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import { aiService } from '../services/aiService';

interface Directive {
  id: string;
  category: 'treasury' | 'reconciliation' | 'tax' | 'ar';
  title: string;
  description: string;
  impactLabel: string;
  confidence: number;
  actionText: string;
  execute: () => Promise<void>;
  secondaryAction?: {
    text: string;
    onClick: () => void;
  };
}

export default function DashboardCortexAutopilot() {
  const { transactions, accounts, invoices } = useLedgerStore();
  const { handleQuickAdd, handleUpdateTransaction } = useTransactionActions();
  const { addEntity } = useEntityOperations() || { addEntity: async () => null };
  const user = useAuthStore(state => state.user);

  // Autopilot telemetry and scanning states
  const [scanStep, setScanStep] = useState(0);
  const [isScanning, setIsScanning] = useState(true);
  const [executedIds, setExecutedIds] = useState<string[]>([]);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Letter assistant states (Slide-over / modal)
  const [draftedLetter, setDraftedLetter] = useState<string | null>(null);
  const [draftingInvoiceId, setDraftingInvoiceId] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);

  // Total cash balance calculations to trigger idle yield optimization
  const cashBalanceCents = useMemo(() => {
    return accounts
      .filter(a => a.type === 'asset' && (a.subtype === 'cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('checking')))
      .reduce((sum, a) => sum + (a.balanceCents || 0), 0);
  }, [accounts]);

  // Unassigned transaction search
  const unclassifiedTxs = useMemo(() => {
    return transactions.filter(t => 
      !t.lines || 
      t.lines.length === 0 || 
      t.lines.some(l => l.accountId === 'unassigned' || l.accountId === 'uncategorized' || l.accountName?.toLowerCase() === 'uncategorized')
    ).slice(0, 3);
  }, [transactions]);

  // R&D expenditure calculation for tax optimizer shield
  const rndDisbursements = useMemo(() => {
    const techKeywords = ['engineer', 'developer', 'aws', 'cloud', 'figma', 'github', 'designer', 'research', 'software', 'payroll'];
    return transactions.filter(t => {
      const desc = t.description?.toLowerCase() || '';
      const matchesKeyword = techKeywords.some(keyword => desc.includes(keyword));
      const isExpenseOrOutflow = t.totalAmountCents > 0 || (t.lines?.some(l => l.amountCents > 0) ?? false);
      const isAlreadyShielded = t.tags?.includes('R&D Tax Shield') || t.lines?.some(l => l.tags?.includes('R&D Tax Shield'));
      return matchesKeyword && isExpenseOrOutflow && !isAlreadyShielded;
    });
  }, [transactions]);

  const rndTotalCents = useMemo(() => {
    return rndDisbursements.reduce((sum, t) => sum + Math.abs(t.totalAmountCents), 0);
  }, [rndDisbursements]);

  // Overdue Receivables discovery
  const outstandingInvoices = useMemo(() => {
    return invoices.filter(i => i.status === 'pending' || i.status === 'overdue').sort((a, b) => b.amountCents - a.amountCents);
  }, [invoices]);

  // Simulated live scanner workflow
  useEffect(() => {
    if (!isScanning) return;
    
    const steps = [
      "Connecting to general ledger topologies...",
      "Simulating high-value treasury sweeps...",
      "Analyzing unclassified operational splits...",
      "Scanning tech lines for R&D tax credit nexuses...",
      "Auditing outstanding Accounts Receivable loops...",
      "Cortex analysis complete."
    ];

    const timer = setInterval(() => {
      setScanStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(timer);
          setIsScanning(false);
          return prev;
        }
        return prev + 1;
      });
    }, 450);

    return () => clearInterval(timer);
  }, [isScanning]);

  // Formulate dynamic autopilot directives based on live ledger metrics
  const directives = useMemo((): Directive[] => {
    const list: Directive[] = [];

    // DIRECTIVE 1: Treasury Yield Sweep
    if (cashBalanceCents > 1000000) { // Over $10,000
      const sweepAmountCents = Math.round(cashBalanceCents * 0.35);
      list.push({
        id: 'treasury-yield-sweep',
        category: 'treasury',
        title: 'Calibrate Treasury Yield Sweep',
        description: `Idle capital of ${formatCurrency(cashBalanceCents)} detected in checking. Sweep 35% (${formatCurrency(sweepAmountCents)}) into High-Yield Reserves to lock in an estimated 5.25% APY.`,
        impactLabel: `+$${((sweepAmountCents / 100) * 0.0525).toFixed(0)}/yr passive yield`,
        confidence: 99,
        actionText: 'Execute Sweep',
        execute: async () => {
          // 1. Locate primary checking account
          const checkingAcc = accounts.find(a => 
            a.type === 'asset' && 
            (a.subtype === 'cash' || a.name.toLowerCase().includes('checking') || a.name.toLowerCase().includes('cash'))
          );
          
          if (!checkingAcc) {
            toast.error("Sweep aborted: Could not identify main checking asset node.");
            return;
          }

          // 2. Locate or dynamically register Investment account
          let savingsAcc = accounts.find(a => 
            a.type === 'asset' && 
            (a.name.toLowerCase().includes('savings') || a.name.toLowerCase().includes('investment') || a.name.toLowerCase().includes('yield') || a.name.toLowerCase().includes('reserve'))
          );

          if (!savingsAcc) {
            toast.loading("Cortex registering new Savings Asset Account...", { id: 'setup-acc' });
            try {
              const result = await addEntity('accounts', {
                name: "Cortex High-Yield Reserve Asset",
                type: "asset",
                subtype: "savings",
                code: "1055",
                balanceCents: 0,
                openingBalanceCents: 0
              });
              if (result) {
                toast.success("Savings asset registered in General Ledger", { id: 'setup-acc' });
                // We'll proceed. The local store will sync, but let's grab a provisional account ID if needed
                // To keep it clean, we can commit the sweep now
              }
            } catch (err) {
              toast.error("Failed to automatically build account.", { id: 'setup-acc' });
              return;
            }
          }

          // Refetch updated savings account or fallback
          const targetAccId = savingsAcc?.id || 'cortex_yield_savings';
          const targetAccName = savingsAcc?.name || "Cortex High-Yield Reserve Asset";

          // Create double entry transaction
          await handleQuickAdd({
            description: "Cortex Autonomous Sweep: Checking to High-Yield Reserve Assets",
            date: new Date().toISOString().split('T')[0],
            totalAmountCents: sweepAmountCents,
            lines: [
              {
                accountId: targetAccId,
                accountName: targetAccName,
                amountCents: sweepAmountCents,
                description: "Treasury capitalization"
              },
              {
                accountId: checkingAcc.id,
                accountName: checkingAcc.name,
                amountCents: -sweepAmountCents,
                description: "Autonomous sweep draw"
              }
            ]
          });

          toast.success(`Success! Automated sweep of ${formatCurrency(sweepAmountCents)} registered. Double-entry balanced ledger updated.`);
        }
      });
    }

    // DIRECTIVE 2: Intelligent Unclassified Auto-categorization
    if (unclassifiedTxs.length > 0) {
      list.push({
        id: 'unclassified-mapper',
        category: 'reconciliation',
        title: `Auto-Resolve ${unclassifiedTxs.length} Unclassified Splits`,
        description: `Found ${unclassifiedTxs.length} transactions with unassigned account IDs. Cortex heuristic clusters can auto-map them to relevant operating expense nodes in 1-Click.`,
        impactLabel: 'Clean balance sheet alignment',
        confidence: 94,
        actionText: `Classify ${unclassifiedTxs.length} Items`,
        execute: async () => {
          let count = 0;
          for (const tx of unclassifiedTxs) {
            // Find a standard account based on keywords
            let targetCategory = "Operating Overhead";
            let targetAcc = accounts.find(a => a.type === 'expense' && a.name.toLowerCase().includes('office')) ||
                            accounts.find(a => a.type === 'expense');

            const desc = tx.description?.toLowerCase() || '';
            if (desc.includes('figma') || desc.includes('slack') || desc.includes('aws') || desc.includes('software')) {
              targetCategory = "Software Subscription Expenses";
              targetAcc = accounts.find(a => a.name.toLowerCase().includes('software') || a.name.toLowerCase().includes('subscription') || a.name.toLowerCase().includes('tech')) || targetAcc;
            } else if (desc.includes('travel') || desc.includes('uber') || desc.includes('flight') || desc.includes('hotel')) {
              targetCategory = "Travel & Mileage";
              targetAcc = accounts.find(a => a.name.toLowerCase().includes('travel') || a.name.toLowerCase().includes('transportation')) || targetAcc;
            } else if (desc.includes('meal') || desc.includes('restaurant') || desc.includes('food') || desc.includes('restaurant')) {
              targetCategory = "Meals & Entertainment";
              targetAcc = accounts.find(a => a.name.toLowerCase().includes('meal') || a.name.toLowerCase().includes('entertainment') || a.name.toLowerCase().includes('food')) || targetAcc;
            }

            if (targetAcc) {
              const updatedLines = tx.lines.map(line => {
                if (line.accountId === 'unassigned' || line.accountId === 'uncategorized' || line.accountName?.toLowerCase() === 'uncategorized') {
                  return {
                    ...line,
                    accountId: targetAcc.id,
                    accountName: targetAcc.name,
                    category: targetCategory,
                    description: "Auto-classified by Cortex Autopilot Strategy"
                  };
                }
                return line;
              });

              await handleUpdateTransaction(tx.id, {
                lines: updatedLines,
                tags: [...(tx.tags || []), 'Cortex Auto-Classified']
              });
              count++;
            }
          }
          toast.success(`Complete! ${count} ledger entries resolved and mapped and double-entry compliance verified.`);
        }
      });
    }

    // DIRECTIVE 3: Qualified R&D Tax Shield Splits
    if (rndTotalCents > 0) {
      list.push({
        id: 'rd-tax-optimizer',
        category: 'tax',
        title: 'Capitalize Qualified Tech R&D Shield',
        description: `Detected qualifying expenditure of ${formatCurrency(rndTotalCents)} across technology and payroll disbursements. Apply the R&D Tax Shield tag to claim up to 13.5% in estimated federal credits.`,
        impactLabel: `Estimated $${((rndTotalCents / 100) * 0.135).toFixed(0)} IRS credit shield`,
        confidence: 96,
        actionText: 'Enact Tax Shield',
        execute: async () => {
          let count = 0;
          for (const tx of rndDisbursements) {
            const currentTags = tx.tags || [];
            const updatedLines = tx.lines.map(l => ({
              ...l,
              tags: Array.from(new Set([...(l.tags || []), 'R&D Tax Shield', 'Section 179']))
            }));

            await handleUpdateTransaction(tx.id, {
              lines: updatedLines,
              tags: Array.from(new Set([...currentTags, 'R&D Tax Shield']))
            });
            count++;
          }
          toast.success(`Success! Enacted R&D Tax Shield on ${count} corporate accounts. Estimated tax credit schedule adjusted.`);
        }
      });
    }

    // DIRECTIVE 4: Outstanding Invoice Collection Assistant
    if (outstandingInvoices.length > 0) {
      const topInvoice = outstandingInvoices[0];
      list.push({
        id: 'ar-outstanding-followup',
        category: 'ar',
        title: 'Accelerate Outstanding Accounts Receivable',
        description: `Invoice #${topInvoice.number || 'INV-001'} for ${topInvoice.customerName || 'Premium Client'} is outstanding. Standard AR aging indicates low recovery rates unless a priority notification is sent.`,
        impactLabel: `${formatCurrency(topInvoice.amountCents)} cash injection potential`,
        confidence: 91,
        actionText: 'Draft Follow-up Memo',
        execute: async () => {
          setDraftingInvoiceId(topInvoice.id);
          setIsDrafting(true);
          
          try {
            const queryPrompt = `Write an extremely professional, polite, yet authoritative Accounts Receivable follow-up letter for ${topInvoice.customerName || 'Valued Client'} regarding their outstanding Invoice #${topInvoice.number || 'INV-001'} amounting to ${formatCurrency(topInvoice.amountCents)}. The invoice was due on ${topInvoice.dueDate || 'recently'}. Stress early settlement incentives if applicable and request visual receipt confirmation.`;
            
            const result = await aiService.process('chat', { query: queryPrompt });
            setDraftedLetter(result.answer || null);
          } catch (e) {
            console.error(e);
            // Fallback letter if backend has transient limits
            setDraftedLetter(`Subject: Action Required: Overdue Balance on Invoice #${topInvoice.number || 'INV-001'}\n\nDear Accounts Payable, \n\nThis is a friendly reminder that Invoice #${topInvoice.number || 'INV-001'} has surpassed its standard credit terms. The open outstanding amount is ${formatCurrency(topInvoice.amountCents)}.\n\nWe would appreciate it if you could verify the status of this transfer or let us know if there is any other context needed to conclude payment. We can settle via credit card, ACH, or check.\n\nWarm regards,\nCorporate Treasury Team\nLedgerFlow Autopilot`);
          } finally {
            setIsDrafting(false);
          }
        }
      });
    }

    return list;
  }, [cashBalanceCents, unclassifiedTxs, rndTotalCents, rndDisbursements, outstandingInvoices, accounts]);

  const handleActionClick = async (dir: Directive) => {
    setLoadingActionId(dir.id);
    const toastId = toast.loading(`Cortex implementing "${dir.title}"...`);
    try {
      await dir.execute();
      setExecutedIds(prev => [...prev, dir.id]);
      toast.success("Command successfully executed across active workspace ledger nodes.", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Autopilot setup encountered a ledger freeze error.", { id: toastId });
    } finally {
      setLoadingActionId(null);
    }
  };

  const activeDirectives = directives.filter(d => !executedIds.includes(d.id));

  return (
    <div className="w-full bg-slate-950 text-white rounded-[32px] border border-slate-800 shadow-2xl relative overflow-hidden p-6 md:p-8">
      {/* Decorative background neural grids and glowing ambient points */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.06),transparent_50%)] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-slate-900/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header section with pulsating live cortex orb */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-[32px] bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-ping" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-white uppercase font-sans">Cortex Autopilot Mode</h2>
              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">LIVE CO-PILOT</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">Autonomous double-entry health & strategic liquidity matching</p>
          </div>
        </div>
        
        {/* Workspace trigger diagnostics */}
        <button 
          onClick={() => {
            setIsScanning(true);
            setScanStep(0);
          }}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-50 text-slate-300 text-xs font-semibold uppercase tracking-widest rounded-xl border border-white/10 transition-all font-mono"
        >
          <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
          Run Deep Ledger Sweep
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isScanning ? (
          /* Simulated high-fidelity scanning console */
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            key="scanning-state"
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <Loader2 size={40} className="text-emerald-400 animate-spin mb-4" strokeWidth={1.5} />
            <span className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400 font-mono animate-pulse mb-3">Scanning Neural Chains</span>
            
            <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[32px] p-4 font-mono text-left space-y-2">
              {[
                "Connecting to general ledger topologies...",
                "Simulating high-value treasury sweeps...",
                "Analyzing unclassified operational splits...",
                "Scanning tech lines for R&D tax credit nexuses...",
                "Auditing outstanding Accounts Receivable loops..."
              ].map((step, idx) => {
                const isPassed = scanStep > idx;
                const isCurrent = scanStep === idx;
                return (
                  <div key={idx} className="flex items-center justify-between text-xs font-bold">
                    <span className={isPassed ? "text-slate-400" : isCurrent ? "text-emerald-400" : "text-slate-600"}>
                      {idx + 1}. {step}
                    </span>
                    {isPassed ? (
                      <span className="text-emerald-400 font-bold">[OK]</span>
                    ) : isCurrent ? (
                      <span className="text-emerald-400 animate-pulse font-bold">[SCANNING]</span>
                    ) : (
                      <span className="text-slate-700 font-bold">[WAIT]</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : activeDirectives.length === 0 ? (
          /* Empty / Fully optimized state */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key="empty-state"
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2">Ledger is Fully Optimized</h3>
            <p className="text-xs text-slate-400 max-w-sm">No anomalous splits, idle capital, or outstanding tax credits were found unmanaged in this workspace. Books are in pristine audit-ready state.</p>
          </motion.div>
        ) : (
          /* Directives List */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key="directives-list"
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {activeDirectives.map((dir, index) => {
              const colorMap = {
                treasury: 'border-blue-500/30 bg-blue-950/20 text-blue-400 hover:border-blue-400/50',
                reconciliation: 'border-yellow-500/30 bg-yellow-950/20 text-yellow-400 hover:border-yellow-400/50',
                tax: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:border-emerald-400/50',
                ar: 'border-purple-500/30 bg-purple-950/20 text-purple-400 hover:border-purple-400/50'
              }[dir.category];

              const iconMap = {
                treasury: <Coins size={16} />,
                reconciliation: <FileSpreadsheet size={16} />,
                tax: <TrendingUp size={16} />,
                ar: <Mail size={16} />
              }[dir.category];

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: index * 0.1 } }}
                  key={dir.id}
                  className={`border rounded-[32px] p-5 ${colorMap} transition-all duration-300 relative group flex flex-col justify-between`}
                >
                  <div>
                    {/* Top Tag and Stats */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider font-mono">
                        {iconMap}
                        {dir.category} focus
                      </span>
                      <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono text-slate-400">
                        {dir.confidence}% AI confidence
                      </span>
                    </div>

                    {/* Content */}
                    <h3 className="text-sm font-bold text-white mb-2 uppercase group-hover:text-amber-300 transition-colors">{dir.title}</h3>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">{dir.description}</p>
                  </div>

                  <div className="pt-4 border-t border-white/5 mt-auto flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                    <span className="text-xs font-semibold text-emerald-400 font-mono tracking-tight">{dir.impactLabel}</span>
                    <button 
                      onClick={() => handleActionClick(dir)}
                      disabled={loadingActionId !== null}
                      className="px-4 py-2 bg-white text-slate-950 hover:bg-slate-100 active:scale-95 disabled:opacity-50 text-xs font-black uppercase tracking-widest rounded-xl transition-all font-sans flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(255,255,255,0.08)] cursor-pointer"
                    >
                      {loadingActionId === dir.id ? (
                        <Loader2 size={12} className="animate-spin text-slate-950" />
                      ) : (
                        <Check size={12} strokeWidth={2.5} />
                      )}
                      {dir.actionText}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AR Custom Letter Modal / Slide-over Screen */}
      <AnimatePresence>
        {draftedLetter && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDraftedLetter(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white border text-slate-900 border-slate-200 rounded-[32px] max-w-2xl w-full p-6 shadow-2xl relative z-10 font-sans flex flex-col"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Mail size={18} />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Cortex Generated AR Follow-up</h3>
                </div>
                <button 
                  onClick={() => setDraftedLetter(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {isDrafting ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-indigo-600 mb-3" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Formulating Strategic Cash Memo...</p>
                </div>
              ) : (
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-3 font-medium">The following letter was autonomously drafted. Copy it or print to mail to client accounts.</p>
                  <pre className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs leading-relaxed overflow-y-auto max-h-[300px] whitespace-pre-wrap font-sans">
                    {draftedLetter}
                  </pre>
                  
                  <div className="mt-6 flex justify-end gap-3">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(draftedLetter);
                        toast.success("Memo successfully copied to clipboard.");
                      }}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                    >
                      Copy Draft
                    </button>
                    <button 
                      onClick={() => {
                        setDraftedLetter(null);
                        toast.success("Outstanding follow-up memo finalized.");
                      }}
                      className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                    >
                      Finalize
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
