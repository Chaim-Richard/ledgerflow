import { useMemo } from 'react';
import { Transaction, FilterCriteria, ChartAccount } from '../types';
import { LedgerEngine } from '../kernel/ledger/LedgerEngine';
import { isPostable, calculateFilteredTotals } from '../lib/txFilters';
import { useScenarioStore } from '../lib/scenarioStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useSavedViewsStore } from '../stores/useSavedViewsStore';
import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns';
import { parseLocalDate } from '../lib/utils';
import { TransactionQueryEngine } from '../lib/TransactionQueryEngine';
import { useLedgerCollections } from './useLedgerCollections';

export function useLedgerComputation(
  transactions: Transaction[] = [], 
  filterCriteria: FilterCriteria | null = null, 
  searchTerm: string = '', 
  accounts: ChartAccount[] = [],
  sortConfig?: { key: string, direction: 'asc' | 'desc' } | null
) {
  const user = useAuthStore(s => s.user);
  useAuthStore(s => s.getCurrentWorkspace());
  const dimensionNodes = useLedgerStore(s => s.dimensionNodes);
  
  const scenarios = useScenarioStore(state => state.scenarios);
  const activeScenarioId = useScenarioStore(state => state.activeScenarioId);
  useLedgerCollections('scenarios');
  const activeScenario = Array.isArray(scenarios) ? scenarios.find(s => s.id === activeScenarioId) : null;

  const views = useSavedViewsStore(s => s.views);
  const activeViewId = useSavedViewsStore(s => s.activeViewId);
  const activeView = views.find(v => v.id === activeViewId);

  // Materialize Ghost Transactions into actual ledger entries for simulation
  const expandedTransactions = useMemo(() => {
    if (!activeScenario || !activeScenario.ghosts.length) return transactions;

    const materializedGhosts: Transaction[] = [];
    const horizonEndDate = addDays(new Date(), 365); // Simulate up to 1 year ahead
    const cachedCashAcc = accounts.find(a => a.type === 'asset' || a.category?.toLowerCase() === 'cash') || { id: 'ghost-asset-offset', name: 'Simulated Cash Offset' };

    activeScenario.ghosts.filter(g => g.isActive).forEach(ghost => {
      let currentDate = parseLocalDate(ghost.date);
      
      const createGhost = (date: Date) => {
        const mainLineAmount = ghost.type === 'income' ? -ghost.amountCents : ghost.amountCents; // Neg for Credit (Income source), Pos for Debit (Expense dest)
        const offsetLineAmount = -mainLineAmount; // Pos for Debit (Cash increase), Neg for Credit (Cash decrease)

        return {
          id: `ghost-${ghost.id}-${format(date, 'yyyyMMdd')}`,
          uid: 'system',
          workspaceId: 'simulation',
          date: format(date, 'yyyy-MM-dd'),
          description: `[GHOST] ${ghost.description}`,
          totalAmountCents: Math.abs(ghost.amountCents || 0),
          currency: 'USD',
          status: 'pending',
          type: 'forecast',
          isCleared: false,
          project: 'Simulation',
          lines: [
            {
              accountId: 'ghost-acc',
              accountName: ghost.type === 'income' ? 'Simulated Income' : 'Simulated Expense',
              amountCents: mainLineAmount,
            },
            {
              accountId: cachedCashAcc.id,
              accountName: cachedCashAcc.name,
              amountCents: offsetLineAmount,
            }
          ],
          createdAt: new Date().toISOString(),
          metadata: { isGhost: true }
        } as Transaction;
      };

      if (ghost.frequency === 'once') {
        materializedGhosts.push(createGhost(currentDate));
      } else {
        while (currentDate <= horizonEndDate) {
          materializedGhosts.push(createGhost(currentDate));
          if (ghost.frequency === 'daily') currentDate = addDays(currentDate, 1);
          else if (ghost.frequency === 'weekly') currentDate = addWeeks(currentDate, 1);
          else if (ghost.frequency === 'monthly') currentDate = addMonths(currentDate, 1);
          else if (ghost.frequency === 'quarterly') currentDate = addMonths(currentDate, 3);
          else if (ghost.frequency === 'yearly') currentDate = addYears(currentDate, 1);
          else break;
        }
      }
    });

    return [...transactions, ...materializedGhosts];
  }, [transactions, activeScenario]);

  // O(1) Lookup Maps for financial entities
  const accountMap = useMemo(() => new Set(accounts.map(a => a.id)), [accounts]);
  
  // Pre-sort expanded transactions. Done once per filter change.
  const sortedExpandedTransactions = useMemo(() => {
    // High-Stability sorting with tie-breakers for consistent rendering
    return [...expandedTransactions].sort((a, b) => {
      if (!a || !b) return 0;

      if (sortConfig) {
        let valA: any;
        let valB: any;

        switch (sortConfig.key) {
          case 'date': {
            valA = a.date;
            valB = b.date;
            break;
          }
          case 'amount':
            valA = Number(a.totalAmountCents) || 0;
            valB = Number(b.totalAmountCents) || 0;
            break;
          case 'description':
            valA = (a.description || '').toLowerCase();
            valB = (b.description || '').toLowerCase();
            break;
          case 'category':
            valA = (a.lines?.[0]?.accountName || '').toLowerCase();
            valB = (b.lines?.[0]?.accountName || '').toLowerCase();
            break;
          case 'project':
            valA = (a.project || '').toLowerCase();
            valB = (b.project || '').toLowerCase();
            break;
          case 'class':
            valA = (a.lines?.[0]?.class || '').toLowerCase();
            valB = (b.lines?.[0]?.class || '').toLowerCase();
            break;
          case 'type':
            valA = (a.type || '').toLowerCase();
            valB = (b.type || '').toLowerCase();
            break;
          case 'status':
            valA = (a.status || '').toLowerCase();
            valB = (b.status || '').toLowerCase();
            break;
          default:
            valA = (a as any)[sortConfig.key];
            valB = (b as any)[sortConfig.key];
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      }

      // Default fallback sorting
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      
      const aTime = (a as any).createdAt || a.id;
      const bTime = (b as any).createdAt || b.id;
      if (aTime > bTime) return -1;
      if (aTime < bTime) return 1;
      return 0;
    });
  }, [expandedTransactions, sortConfig]);

  // Pre-normalize for speed
  const normalized = useMemo(() => LedgerEngine.normalize(sortedExpandedTransactions), [sortedExpandedTransactions]);

  // True O(1) Reverse Index for Dimension Lookup (Performance Optimization for 100k+ scaling)
  const reverseDimensionIndex = useMemo(() => {
    const idx = new Map<string, Set<string>>();
    for (let i = 0; i < normalized.length; i++) {
      const t = normalized[i];
      if (t.dimensions) {
        for (const nodeId of Object.values(t.dimensions)) {
          if (!idx.has(nodeId as string)) idx.set(nodeId as string, new Set());
          idx.get(nodeId as string)!.add(t.id);
        }
      }
      if (t.lines) {
        for (const line of t.lines) {
          if (line.dimensions) {
            for (const nodeId of Object.values(line.dimensions)) {
              if (!idx.has(nodeId as string)) idx.set(nodeId as string, new Set());
              idx.get(nodeId as string)!.add(t.id);
            }
          }
        }
      }
    }
    return idx;
  }, [normalized]);

  const thresholds = useMemo(() => {
    if (normalized.length === 0) return { avg: 0, totalVolume: 0, percentiles: { top10: 0, top25: 0, bottom10: 0 } };
    
    const totalVolume = normalized.reduce((acc, t) => acc + t._normalized.absAmount, 0);
    const avg = totalVolume / (normalized.length || 1);
    
    const amounts = normalized.map(t => t._normalized.absAmount).sort((a, b) => b - a);
    return {
      avg,
      totalVolume,
      percentiles: {
        top10: amounts[Math.floor(amounts.length * 0.1)] || 0,
        top25: amounts[Math.floor(amounts.length * 0.25)] || 0,
        bottom10: amounts[Math.floor(amounts.length * 0.9)] || 0,
      }
    };
  }, [normalized]);

  const smartFilteredTransactions = useMemo(() => {
    return TransactionQueryEngine.query({
      normalized,
      filterCriteria,
      searchTerm,
      accounts,
      activeView,
      dimensionNodes,
      reverseDimensionIndex,
      thresholds,
      userUid: user?.uid
    });
  }, [normalized, filterCriteria, searchTerm, accounts, activeView, dimensionNodes, reverseDimensionIndex, thresholds, user?.uid]);

  const chronologicalRunningBalances = useMemo(() => {
    // Chronologically compute historical running balance for every transaction to ensure mathematical stability.
    // Done once per transaction load, massively improving rendering & filtering performance for 50,000+ inputs.
    const chronologicalTxs = [...transactions].filter(isPostable).sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      const aTime = (a as any).createdAt || a.id;
      const bTime = (b as any).createdAt || b.id;
      if (aTime < bTime) return -1;
      if (aTime > bTime) return 1;
      return 0;
    });

    const runningBalanceMap = new Map<string, number>();
    let currentSum = 0;
    for (let i = 0; i < chronologicalTxs.length; i++) {
      const t = chronologicalTxs[i];
      currentSum += (t.totalAmountCents || 0);
      runningBalanceMap.set(t.id, currentSum);
    }
    return runningBalanceMap;
  }, [transactions]);

  const transactionsWithBalance = useMemo(() => {
    return smartFilteredTransactions.map(t => {
      const balance = chronologicalRunningBalances.get(t.id) ?? 0;
      return { ...t, balanceCents: balance };
    });
  }, [smartFilteredTransactions, chronologicalRunningBalances]);

  const stats = useMemo(() => {
    let discrepancies = 0;
    const conflicts = new Map<string, { type: string, message: string }>();
    
    for (const t of smartFilteredTransactions) {
      if (!isPostable(t)) continue;
      
      const auditErrors = LedgerEngine.auditTransaction(t, accountMap);
      if (auditErrors.length > 0) {
        discrepancies++;
        conflicts.set(t.id, { 
          type: 'audit_fail', 
          message: auditErrors.join('; ')
        });
      }
    }

    const { inflowCents, outflowCents, totalExposure } = calculateFilteredTotals(
      smartFilteredTransactions,
      accounts
    );

    return { 
      totalExposure, 
      count: smartFilteredTransactions.length, 
      inflowCents,
      outflowCents,
      discrepancies, 
      conflicts,
      totalValues: {
        sum: smartFilteredTransactions.filter(isPostable).reduce((acc, t) => acc + (t.totalAmountCents || 0), 0)
      }
    };
  }, [smartFilteredTransactions, accounts]);

  return { smartFilteredTransactions, transactionsWithBalance, stats, conflicts: stats.conflicts };
}
