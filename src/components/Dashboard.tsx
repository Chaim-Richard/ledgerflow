import { resolveAccountRole } from '../lib/accountUtils';
import { useState, useMemo } from 'react';
import { 
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Wallet,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Layers,
  UploadCloud,
  Sparkles,
  X
} from 'lucide-react';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useScenarioStore } from '../lib/scenarioStore';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { TaxReserveWidget } from './finance/TaxReserveWidget';
import OnboardingView from './onboarding/OnboardingView';
import SavedViewsBar from './ui/SavedViewsBar';
import { formatCurrency, resolveAccountName, cn } from '../lib/utils';
import { isPostable, lineAmount } from '../lib/txFilters';

import { useShallow } from 'zustand/react/shallow';

export default function Dashboard() {
  const { 
    rawTransactions, 
    accounts, 
    computedAccounts, 
    totalLedgerBalance, 
    integrityStatus, 
    projects 
  } = useLedgerStore(useShallow(s => ({
    rawTransactions: s.transactions,
    accounts: s.accounts,
    computedAccounts: s.computedAccounts,
    totalLedgerBalance: s.totalLedgerBalance,
    integrityStatus: s.integrityStatus,
    projects: s.projects
  })));
  const scenarios = useScenarioStore(s => s.scenarios);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const setQuickEntryOpen = useUIStore(s => s.setQuickEntryOpen);
  const setTemplateSelectorOpen = useUIStore(s => s.setTemplateSelectorOpen);
  const setActiveTab = useUIStore(s => s.setActiveTab);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const workspaces = useAuthStore(s => s.workspaces);

  // Setup completion criteria:
  // Brand new workspace has 0 transactions AND 0 accounts.
  const isCompletelyEmpty = rawTransactions.length === 0 && accounts.length === 0;

  // Lens state: 'owner' vs 'accountant'
  const [lens, setLens] = useState<'owner' | 'accountant'>('owner');

  // Track setup checklist banner dismissal in localStorage
  const [isChecklistDismissed, setIsChecklistDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`lf_checklist_dismissed_${currentWorkspaceId}`) === 'true';
    } catch {
      return false;
    }
  });

  const dismissChecklist = () => {
    setIsChecklistDismissed(true);
    try {
      if (currentWorkspaceId) {
        localStorage.setItem(`lf_checklist_dismissed_${currentWorkspaceId}`, 'true');
      }
    } catch {
      // ignore
    }
  };

  // Filter chips
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const removeFilter = (filter: string) => {
    setActiveFilters(prev => prev.filter(f => f !== filter));
  };

  const activeAccounts = computedAccounts.length > 0 ? computedAccounts : accounts;

  // Setup steps status
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const hasSelectedTemplate = Boolean(currentWorkspace?.businessType && currentWorkspace.businessType !== 'custom');
  const hasAccounts = accounts.length > 0;
  const hasTransactions = rawTransactions.length > 0;
  const setupStepCount = [hasSelectedTemplate, hasAccounts, hasTransactions].filter(Boolean).length;
  const isSetupIncomplete = setupStepCount < 3 && !isChecklistDismissed;

  // Real Calculated Financial Metrics
  const metrics = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;
    let liquidCash = 0;

    activeAccounts.forEach(acc => {
      const bal = acc.balanceCents || 0;
      if (acc.type === 'asset') {
        totalAssets += bal;
        if (resolveAccountRole(acc) === 'cash') {
          liquidCash += bal;
        }
      } else if (acc.type === 'liability') {
        totalLiabilities += bal;
      } else if ((acc.type === 'income' || acc.type === 'revenue')) {
        totalRevenue += Math.abs(bal);
      } else if ((acc.type === 'expense' || acc.type === 'cost_of_goods')) {
        totalExpenses += Math.abs(bal);
      }
    });

    const netWorth = totalAssets - totalLiabilities;
    const isBalanced = integrityStatus.isConsistent && Math.abs(totalLedgerBalance) === 0;

    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      totalRevenue,
      totalExpenses,
      liquidCash,
      isBalanced
    };
  }, [activeAccounts, totalLedgerBalance, integrityStatus]);

  // Real Scenarios or Ghost Transactions merge
  const transactions = useMemo(() => {
    const activeScenario = Array.isArray(scenarios) ? scenarios.find(s => s.id === activeScenarioId) : null;
    if (!activeScenario || !activeScenario.ghosts.length) return rawTransactions;
    
    const materializedGhosts = activeScenario.ghosts.filter(g => g.isActive).map(g => {
      const isExpense = g.type === 'expense';
      return {
        id: `ghost-${g.id}`,
        uid: 'ghost-user',
        workspaceId: 'ghost-workspace',
        date: g.date,
        description: g.description,
        totalAmountCents: Math.abs(g.amountCents || 0),
        currency: 'USD',
        status: 'completed' as const,
        type: 'forecast' as const,
        schemaVersion: '1.1',
        tags: ['scenario', 'ghost'],
        metadata: { isGhost: true },
        lines: [
          {
            accountId: isExpense ? 'expense-acc' : 'asset-acc',
            accountName: isExpense ? 'Operating Expense' : 'Operating Asset',
            amountCents: isExpense ? g.amountCents : -g.amountCents,
            description: g.description,
            tags: [] as string[]
          }
        ]
      };
    });
    return [...rawTransactions, ...materializedGhosts];
  }, [rawTransactions, scenarios, activeScenarioId]);

  // Real Account Categories/ledgerflow roll-up
  const accountledgerflows = useMemo(() => {
    const typeTotals: Record<string, number> = {
      Asset: 0,
      Liability: 0,
      Revenue: 0,
      Expense: 0,
      Equity: 0
    };

    activeAccounts.forEach(a => {
      const key = a.type.charAt(0).toUpperCase() + a.type.slice(1);
      typeTotals[key] = (typeTotals[key] || 0) + Math.abs(a.balanceCents || 0);
    });

    const grandTotal = Object.values(typeTotals).reduce((a, b) => a + b, 0) || 1;

    const colors: Record<string, string> = {
      Asset: 'var(--w-estate)',
      Liability: 'var(--neg)',
      Revenue: 'var(--pos)',
      Expense: 'var(--w-personal)',
      Equity: 'var(--w-book)'
    };

    return Object.entries(typeTotals).map(([type, total]) => ({
      name: type,
      total,
      percentage: Math.min(100, Math.round((total / grandTotal) * 100)),
      color: colors[type] || 'var(--brass)'
    }));
  }, [activeAccounts]);

  if (isCompletelyEmpty) {
    return <OnboardingView />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1360px] mx-auto text-[var(--text)]">
      {/* Header section with lens selector and subtle gold gradient backdrop */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
        {/* Subtle radial ambient glow */}
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-[var(--brass)] opacity-10 rounded-full blur-3xl hidden md:block pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[var(--brass-soft)]/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 text-[11px] font-mono text-[var(--brass)] font-semibold mb-2 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brass)] animate-pulse" />
              FINANCIAL COMMAND CENTER
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {lens === 'owner' ? 'Real-Time Financial Ledger' : 'Consolidated Double-Entry Trial Balance'}
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Connected to live store —{' '}
              <span className="text-[var(--brass)] font-medium">
                {lens === 'owner' ? 'owner perspective on assets, cash & net worth.' : 'audit-ready debits and credits.'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center bg-[var(--surface)]/80 border border-[var(--line)] rounded-xl p-1 text-xs font-medium shadow-inner backdrop-blur-sm">
              <button
                onClick={() => setLens('owner')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer",
                  lens === 'owner' 
                    ? "bg-gradient-to-r from-[var(--brass)] to-[#e5be6b] text-black font-semibold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Owner Lens
              </button>
              <button
                onClick={() => setLens('accountant')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer",
                  lens === 'accountant' 
                    ? "bg-gradient-to-r from-[var(--brass)] to-[#e5be6b] text-black font-semibold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Accountant Lens
              </button>
            </div>

            <button
              onClick={() => setQuickEntryOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] hover:opacity-95 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              Add Entry
            </button>
          </div>
        </div>
      </div>

      {/* Setup Checklist Guidance Banner (when setup is incomplete) */}
      {isSetupIncomplete && (
        <div className="bg-gradient-to-r from-[var(--brass-soft)] via-[var(--panel)] to-[var(--surface)] border border-[var(--brass-line)] rounded-2xl p-4 sm:p-5 relative shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider bg-[var(--brass)] text-black px-2 py-0.5 rounded-md font-bold">
                  Setup Progress ({setupStepCount}/3)
                </span>
                <h3 className="text-sm font-semibold text-[var(--text)]">Workspace Setup Checklist</h3>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Ensure your chart of accounts and transactions are configured for complete algorithmic accuracy.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissChecklist}
              className="text-[var(--muted)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--surface)] transition-colors cursor-pointer"
              title="Dismiss checklist"
             aria-label="Dismiss checklist">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {/* Step 1: Chart Template */}
            <button
              type="button"
              onClick={() => setTemplateSelectorOpen(true)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                hasAccounts
                  ? "bg-[var(--surface)]/80 border-[var(--brass-line)]/50"
                  : "bg-[var(--panel)] border-[var(--brass-line)] hover:border-[var(--brass)]"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                hasAccounts ? "bg-emerald-500/10 text-emerald-500" : "bg-[var(--brass)]/10 text-[var(--brass)]"
              )}>
                {hasAccounts ? <CheckCircle2 size={16} /> : <Layers size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)] truncate">1. Chart Template</p>
                <p className="text-[10px] text-[var(--muted)] truncate">
                  {hasAccounts ? `${accounts.length} accounts configured` : 'Select industry COA'}
                </p>
              </div>
            </button>

            {/* Step 2: Bank Lines / Import */}
            <button
              type="button"
              onClick={() => setActiveTab('banking')}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                hasTransactions
                  ? "bg-[var(--surface)]/80 border-[var(--brass-line)]/50"
                  : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--brass-line)]"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                hasTransactions ? "bg-emerald-500/10 text-emerald-500" : "bg-indigo-500/10 text-indigo-500"
              )}>
                {hasTransactions ? <CheckCircle2 size={16} /> : <UploadCloud size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)] truncate">2. Import History</p>
                <p className="text-[10px] text-[var(--muted)] truncate">
                  {hasTransactions ? `${rawTransactions.length} entries recorded` : 'Connect bank or CSV'}
                </p>
              </div>
            </button>

            {/* Step 3: Recon / First Entry */}
            <button
              type="button"
              onClick={() => hasTransactions ? setActiveTab('reconciliation') : setQuickEntryOpen(true)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                hasTransactions
                  ? "bg-[var(--surface)]/80 border-[var(--brass-line)]/50"
                  : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--brass-line)]"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                hasTransactions ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
              )}>
                {hasTransactions ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)] truncate">3. Reconcile & Verify</p>
                <p className="text-[10px] text-[var(--muted)] truncate">
                  {hasTransactions ? 'Verify balances & rules' : 'Record manual entry'}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Saved Views & Default Lenses Bar */}
      <SavedViewsBar />

      {/* Filter Chips if any */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(filter => (
            <span
              key={filter}
              className="inline-flex items-center gap-2 font-mono text-xs bg-[var(--surface)] border border-[var(--line)] rounded-full px-3 py-1 text-[var(--text)] shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--brass)]" />
              {filter}
              <button
                onClick={() => removeFilter(filter)}
                className="text-[var(--faint)] hover:text-[var(--neg)] ml-1"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Summary Tiles from REAL Data with layered gold/brass gradients */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Net Worth */}
        <div className="bg-[var(--panel)] border border-[var(--brass-line)] rounded-2xl p-5 relative overflow-hidden shadow-sm bg-gradient-to-b from-[var(--brass-soft)] via-[var(--brass-soft)]/20 to-[var(--panel)] group hover:border-[var(--brass)]/80 transition-all">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent" />
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--brass)] font-semibold flex items-center justify-between">
            <span>Net Worth</span>
            <Building2 size={15} className="text-[var(--brass)] group-hover:scale-110 transition-transform" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-[var(--text)] tabular-nums">
            {formatCurrency(metrics.netWorth)}
          </div>
          <div className="font-mono text-xs text-[var(--muted)] mt-2 flex items-center justify-between">
            <span>Assets: {formatCurrency(metrics.totalAssets)}</span>
            <span className="text-[10px] text-[var(--brass)] bg-[var(--brass-soft)] px-1.5 py-0.5 rounded border border-[var(--brass-line)]/50">Primary</span>
          </div>
        </div>

        {/* Tile 2: Revenue / Money In */}
        <div className="bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--brass-line)] rounded-2xl p-5 relative overflow-hidden shadow-sm bg-gradient-to-b from-[var(--brass-soft)]/40 via-[var(--panel)]/50 to-[var(--panel)] transition-all group">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between">
            <span>Money In (Revenue)</span>
            <ArrowUpRight size={15} className="text-[var(--pos)] group-hover:scale-110 transition-transform" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-[var(--pos)] tabular-nums">
            {formatCurrency(metrics.totalRevenue)}
          </div>
          <div className="font-mono text-xs text-[var(--muted)] mt-2 tabular-nums">
            Expenses: {formatCurrency(metrics.totalExpenses)}
          </div>
        </div>

        {/* Tile 3: Safe to Spend / Liquid Cash */}
        <div className="bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--brass-line)] rounded-2xl p-5 relative overflow-hidden shadow-sm bg-gradient-to-b from-[var(--brass-soft)]/50 via-[var(--panel)]/50 to-[var(--panel)] transition-all group">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between">
            <span>Liquid Cash</span>
            <Wallet size={15} className="text-[var(--brass)] group-hover:scale-110 transition-transform" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-[var(--text)] tabular-nums">
            {formatCurrency(metrics.liquidCash)}
          </div>
          <div className="font-mono text-xs text-[var(--muted)] mt-2 tabular-nums">
            Liabilities: {formatCurrency(metrics.totalLiabilities)}
          </div>
        </div>

        {/* Tile 4: Double-Entry Audit */}
        <div className="bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--brass-line)] rounded-2xl p-5 relative overflow-hidden shadow-sm bg-gradient-to-b from-[var(--brass-soft)]/30 via-[var(--panel)]/50 to-[var(--panel)] transition-all group">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between">
            <span>Books Balanced</span>
            <ShieldCheck size={15} className={metrics.isBalanced ? "text-[var(--pos)] group-hover:scale-110 transition-transform" : "text-[var(--neg)] group-hover:scale-110 transition-transform"} />
          </div>
          <div className={cn(
            "font-mono text-2xl sm:text-3xl font-bold tracking-tight mt-1",
            metrics.isBalanced ? "text-[var(--pos)]" : "text-[var(--neg)]"
          )}>
            {metrics.isBalanced ? "Verified ✓" : "Reconciling…"}
          </div>
          <div className="font-mono text-xs text-[var(--muted)] mt-2">
            {activeAccounts.length} active ledger accounts
          </div>
        </div>
      </div>

      {/* Tax Reserve Widget embedded */}
      <TaxReserveWidget />

      {/* Two Column Layout: Real Transactions + ledgerflows Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ledger Column */}
        <div className="lg:col-span-2 bg-[var(--panel)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-[var(--line)] bg-[var(--surface)]">
            <div>
              <h3 className="font-bold text-sm text-[var(--text)]">Recent Transactions</h3>
              <div className="font-mono text-[11px] text-[var(--faint)]">
                {transactions.length} record{transactions.length === 1 ? '' : 's'} in general ledger
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('transactions')}
              className="font-mono text-xs text-[var(--brass)] hover:underline cursor-pointer"
            >
              all transactions →
            </button>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {transactions.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center mx-auto text-[var(--muted)]">
                  <Scale size={20} />
                </div>
                <div className="text-sm font-medium text-[var(--text)]">No transactions recorded yet</div>
                <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                  Start by adding your first transaction or importing statement entries into the general ledger.
                </p>
                <button
                  onClick={() => setQuickEntryOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--brass)] text-black rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer mt-2"
                >
                  <Plus size={14} />
                  Record First Entry
                </button>
              </div>
            ) : (
              transactions.filter(isPostable).slice(0, 8).map(tx => {
                const amountCents = Math.abs(tx.totalAmountCents || 0);
                const isExpense = tx.lines?.some(l => {
                  const amt = lineAmount(l, tx);
                  const acc = accounts.find(a => a.id === l.accountId);
                  const role = resolveAccountRole(acc);
                  return role === 'expense' || role === 'cogs' || amt > 0;
                });
                return (
                  <div key={tx.id} className="p-4 hover:bg-[var(--elevated)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="font-medium text-sm text-[var(--text)]">{tx.description || 'Unspecified Transaction'}</div>
                      <div className="font-mono text-[11px] text-[var(--faint)]">{tx.date}</div>
                      
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tx.lines && tx.lines.length > 0 ? (
                          tx.lines.slice(0, 2).map((l, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 font-mono text-[10.5px] bg-[var(--surface)] border border-[var(--line)] rounded-md px-2 py-0.5 text-[var(--muted)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brass)]" />
                              {resolveAccountName(accounts, l.accountId, l.accountName)}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center font-mono text-[10.5px] bg-[var(--surface)] border border-[var(--line)] rounded-md px-2 py-0.5 text-[var(--faint)]">
                            {tx.status || 'posted'}
                          </span>
                        )}
                        {tx.tags && tx.tags.map((tag, idx) => (
                          <span key={idx} className="inline-flex items-center font-mono text-[10.5px] bg-[var(--surface)] border border-[var(--line)] rounded-md px-2 py-0.5 text-[var(--faint)]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={cn(
                        "font-mono text-sm sm:text-base font-semibold tabular-nums",
                        isExpense ? "text-[var(--neg)]" : "text-[var(--pos)]"
                      )}>
                        {formatCurrency(amountCents)}
                      </div>
                      <div className="font-mono text-[10px] text-[var(--faint)] mt-0.5 uppercase tracking-wider">
                        {tx.currency || 'USD'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Real Accounts Roll-up ledgerflow Panel */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[var(--line)] bg-[var(--surface)]">
            <div>
              <h3 className="font-bold text-sm text-[var(--text)] font-sans">Account ledgerflows</h3>
              <div className="font-mono text-[11px] text-[var(--faint)]">roll-up by type</div>
            </div>
            <button 
              onClick={() => setActiveTab('ledger')}
              className="font-mono text-xs text-[var(--brass)] hover:underline cursor-pointer"
            >
              chart of accounts →
            </button>
          </div>

          <div className="divide-y divide-[var(--line)] flex-1">
            {accountledgerflows.map(ledgerflow => (
              <div key={ledgerflow.name} className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ledgerflow.color }} />
                    {ledgerflow.name}s
                  </span>
                  <span className="font-mono text-[var(--muted)] tabular-nums">{formatCurrency(ledgerflow.total)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ backgroundColor: ledgerflow.color, width: `${Math.max(5, ledgerflow.percentage)}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
