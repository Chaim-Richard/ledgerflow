import { useState, useMemo } from 'react';
import { 
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Wallet,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useScenarioStore } from '../lib/scenarioStore';
import { useUIStore } from '../stores/useUIStore';
import { TaxReserveWidget } from './finance/TaxReserveWidget';
import { formatCurrency, cn } from '../lib/utils';

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
  const setActiveTab = useUIStore(s => s.setActiveTab);

  // Lens state: 'owner' vs 'accountant'
  const [lens, setLens] = useState<'owner' | 'accountant'>('owner');

  // Filter chips
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const removeFilter = (filter: string) => {
    setActiveFilters(prev => prev.filter(f => f !== filter));
  };

  const activeAccounts = computedAccounts.length > 0 ? computedAccounts : accounts;

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
        if (acc.subtype === 'cash' || acc.name.toLowerCase().includes('cash') || acc.name.toLowerCase().includes('checking') || acc.name.toLowerCase().includes('bank')) {
          liquidCash += bal;
        }
      } else if (acc.type === 'liability') {
        totalLiabilities += bal;
      } else if (acc.type === 'income') {
        totalRevenue += Math.abs(bal);
      } else if (acc.type === 'expense') {
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
        totalAmountCents: g.amountCents,
        currency: 'USD',
        status: 'completed' as const,
        type: 'forecast' as const,
        schemaVersion: '1.1',
        tags: ['scenario', 'ghost'],
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

  // Real Account Categories/Facet roll-up
  const accountFacets = useMemo(() => {
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1360px] mx-auto text-[var(--text)]">
      {/* Header section with lens selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--line)]">
        <div>
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

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[var(--surface)] border border-[var(--line)] rounded-lg p-1 text-xs font-medium">
            <button
              onClick={() => setLens('owner')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors",
                lens === 'owner' ? "bg-[var(--brass)] text-black font-semibold" : "text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              Owner Lens
            </button>
            <button
              onClick={() => setLens('accountant')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors",
                lens === 'accountant' ? "bg-[var(--brass)] text-black font-semibold" : "text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              Accountant Lens
            </button>
          </div>

          <button
            onClick={() => setQuickEntryOpen(true)}
            className="flex items-center gap-1.5 bg-[var(--brass)] hover:opacity-90 text-black px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Add Entry
          </button>
        </div>
      </div>

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

      {/* Summary Tiles from REAL Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Net Worth */}
        <div className="bg-[var(--panel)] border border-[var(--brass-line)] rounded-2xl p-5 relative overflow-hidden shadow-sm bg-gradient-to-b from-[var(--brass-soft)] to-[var(--panel)]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between">
            <span>Net Worth</span>
            <Building2 size={14} className="text-[var(--brass)]" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-[var(--text)]">
            {formatCurrency(metrics.netWorth)}
          </div>
          <div className="font-mono text-xs text-[var(--muted)] mt-2">
            Assets: {formatCurrency(metrics.totalAssets)}
          </div>
        </div>

        {/* Tile 2: Revenue / Money In */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between">
            <span>Money In (Revenue)</span>
            <ArrowUpRight size={14} className="text-[var(--pos)]" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-[var(--pos)]">
            {formatCurrency(metrics.totalRevenue)}
          </div>
          <div className="font-mono text-xs text-[var(--muted)] mt-2">
            Expenses: {formatCurrency(metrics.totalExpenses)}
          </div>
        </div>

        {/* Tile 3: Safe to Spend / Liquid Cash */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between">
            <span>Liquid Cash</span>
            <Wallet size={14} className="text-[var(--brass)]" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-[var(--text)]">
            {formatCurrency(metrics.liquidCash)}
          </div>
          <div className="font-mono text-xs text-[var(--muted)] mt-2">
            Liabilities: {formatCurrency(metrics.totalLiabilities)}
          </div>
        </div>

        {/* Tile 4: Double-Entry Audit */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between">
            <span>Books Balanced</span>
            <ShieldCheck size={14} className={metrics.isBalanced ? "text-[var(--pos)]" : "text-[var(--neg)]"} />
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

      {/* Two Column Layout: Real Transactions + Facets Panel */}
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
              transactions.slice(0, 8).map(tx => {
                const amountCents = tx.totalAmountCents || 0;
                const isExpense = amountCents < 0 || tx.lines?.some(l => l.amountCents < 0);
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
                              {l.accountName || l.accountId}
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

        {/* Real Accounts Roll-up Facet Panel */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[var(--line)] bg-[var(--surface)]">
            <div>
              <h3 className="font-bold text-sm text-[var(--text)] font-sans">Account Facets</h3>
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
            {accountFacets.map(facet => (
              <div key={facet.name} className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: facet.color }} />
                    {facet.name}s
                  </span>
                  <span className="font-mono text-[var(--muted)]">{formatCurrency(facet.total)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ backgroundColor: facet.color, width: `${Math.max(5, facet.percentage)}%` }} 
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
