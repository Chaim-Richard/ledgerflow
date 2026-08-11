import { useMemo } from 'react';
import { Transaction, FilterCriteria, ChartAccount } from '../types';
import { LedgerEngine } from '../lib/ledger-engine';
import { jaroWinklerSimilarity } from '../lib/algorithms';
import { useScenarioStore } from '../lib/scenarioStore';
import { useAuthStore } from '../stores/useAuthStore';
import { TruthEngine } from '../modules/integrity/TruthEngine';
import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns';
import { parseLocalDate, resolveAccountName } from '../lib/utils';

// RULES PATTERN ENGINE: Pre-compiled static regex for maximum pipeline throughput
const PATTERNS = {
  OP: /([><=])\s*([\d,]+(\.\d+)?)/,
  TEXT_OP: /(greater than|more than|over|above|less than|under|below|at least|at most|around|about|approx|approximately)\s*([\d,]+(\.\d+)?)/,
  RANGE: /between\s*([\d,]+(\.\d+)?)\s*and\s*([\d,]+(\.\d+)?)/,
  PERCENTILE: /\b(top|bottom)\s*(10|25|50)\s*%?\b/,
  MONTH: /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/,
  YEAR: /\b(20\d{2})\b/,
  RELATIVE: /\b(last month|this month|last week|this week|yesterday|today|last year|this year|last 7 days|last 30 days|ytd)\b/,
  QUARTER: /\b(q[1-4])\b/,
  DATE_RANGE: /(\d{4}-\d{2}-\d{2})\s*(?:to|and)\s*(\d{4}-\d{2}-\d{2})/,
  SINCE_DATE: /\b(since|after)\s*(\d{4}-\d{2}-\d{2})\b/,
  BEFORE_DATE: /\b(before|until)\s*(\d{4}-\d{2}-\d{2})\b/,
  CATEGORY: /(category|type|account):\s*([a-zA-Z\s]+)/,
  PROJECT: /(project|initiative|tag):\s*([a-zA-Z\s]+)/,
  CLASS: /(class|segment):\s*([a-zA-Z\s]+)/,
  LOCATION: /(location|office|site):\s*([a-zA-Z\s]+)/,
  STARTS_WITH: /starts\s+with\s+([a-zA-Z0-9\s]+)/,
  ENDS_WITH: /ends\s+with\s+([a-zA-Z0-9\s]+)/,
  CONTAINS: /contains\s+([a-zA-Z0-9\s]+)/,
  ERROR: /\b(error|mismatch|conflict|audit|review|unbalanced)\b/,
  AVERAGE: /\b(above|below)\s+average\b/,
};

export function useLedgerComputation(
  transactions: Transaction[] = [], 
  filterCriteria: FilterCriteria | null = null, 
  searchTerm: string = '', 
  accounts: ChartAccount[] = [],
  sortConfig?: { key: string, direction: 'asc' | 'desc' } | null
) {
  const user = useAuthStore(s => s.user);
  const currentWorkspace = useAuthStore(s => s.getCurrentWorkspace());
  const dimensionNodes = currentWorkspace?.dimensionNodes || [];
  
  const scenarios = useScenarioStore(state => state.scenarios);
  const activeScenarioId = useScenarioStore(state => state.activeScenarioId);
  const activeScenario = Array.isArray(scenarios) ? scenarios.find(s => s.id === activeScenarioId) : null;

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
          totalAmountCents: ghost.type === 'income' ? ghost.amountCents : -ghost.amountCents,
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
    const hasFilter = filterCriteria && Object.keys(filterCriteria).length > 0;
    const hasSearch = searchTerm.trim().length > 0;
    
    if (!hasFilter && !hasSearch) return normalized;

    const lowerSearch = searchTerm.toLowerCase().trim();
    
    // 1. Precise Amount Operators (Higher Precedence)
    const opMatch = lowerSearch.match(PATTERNS.OP);
    const textOpMatch = lowerSearch.match(PATTERNS.TEXT_OP);
    const rangeMatch = lowerSearch.match(PATTERNS.RANGE);
    const percentileMatch = lowerSearch.match(PATTERNS.PERCENTILE);

    // 2. Temporal Context Parsers
    const monthMatch = lowerSearch.match(PATTERNS.MONTH);
    const yearMatch = lowerSearch.match(PATTERNS.YEAR);
    const relativeTimeMatch = lowerSearch.match(PATTERNS.RELATIVE);
    const quarterMatch = lowerSearch.match(PATTERNS.QUARTER);
    const dateRangeMatch = lowerSearch.match(PATTERNS.DATE_RANGE);
    const sinceDateMatch = lowerSearch.match(PATTERNS.SINCE_DATE);
    const beforeDateMatch = lowerSearch.match(PATTERNS.BEFORE_DATE);

    // 3. Entity & Advanced String Tags
    const categoryMatch = lowerSearch.match(PATTERNS.CATEGORY);
    const projectMatch = lowerSearch.match(PATTERNS.PROJECT);
    const classMatch = lowerSearch.match(PATTERNS.CLASS);
    const locationMatch = lowerSearch.match(PATTERNS.LOCATION);
    const startsWithMatch = lowerSearch.match(PATTERNS.STARTS_WITH);
    const endsWithMatch = lowerSearch.match(PATTERNS.ENDS_WITH);
    const containsMatch = lowerSearch.match(PATTERNS.CONTAINS);
    const errorMatch = lowerSearch.match(PATTERNS.ERROR);
    const averageMatch = lowerSearch.match(PATTERNS.AVERAGE);

    // 4. Entity Intent Resolver (Heuristic categorization without prefixes)
    const possibleEntityMatch = lowerSearch.length > 2 && !Object.values(PATTERNS).some(p => lowerSearch.match(p));
    const recognizedAccountNames = possibleEntityMatch ? accounts.filter(a => 
      (a.name || '').toLowerCase().includes(lowerSearch) || 
      (a.category || '').toLowerCase().includes(lowerSearch) ||
      jaroWinklerSimilarity(lowerSearch, (a.name || '').toLowerCase()) > 0.88
    ).map(a => a.name) : [];
    
    // Convert to Set for O(1) lookup inside the 100k hot-loop
    const recognizedAccountNamesSet = new Set(recognizedAccountNames);
    
    // Dimension Node Intent Resolver
    const recognizedDimensionNodeIds = possibleEntityMatch ? dimensionNodes.filter(n => 
      (n.id || '').toLowerCase() === lowerSearch || 
      (n.description || '').toLowerCase().includes(lowerSearch) ||
      n.aliases?.some(a => a.toLowerCase().includes(lowerSearch)) ||
      jaroWinklerSimilarity(lowerSearch, (n.description || '').toLowerCase()) > 0.88
    ).map(n => n.id) : [];
    const recognizedDimensionNodeIdsSet = new Set(recognizedDimensionNodeIds);

    // Pull directly from O(1) reverse index for dimension matches to avoid scanning dimensions in loop
    const matchedByDimensionTxIds = new Set<string>();
    if (recognizedDimensionNodeIds.length > 0) {
       recognizedDimensionNodeIds.forEach(nId => {
          const txs = reverseDimensionIndex.get(nId);
          if (txs) txs.forEach(tId => matchedByDimensionTxIds.add(tId));
       });
    }

    // Intent Resolution & Sub-Hot-Loop Pre-computation (CRITICAL FOR PERFORMANCE AT 100k RECORDS)
    const opVal = opMatch ? { op: opMatch[1], val: TruthEngine.parseAmountToCents(opMatch[2]) / 100 } : null;
    let textOp = null;
    if (textOpMatch) {
      const phrase = textOpMatch[1];
      const val = TruthEngine.parseAmountToCents(textOpMatch[2]) / 100;
      if (phrase.includes('greater') || phrase.includes('more') || phrase.includes('over') || phrase.includes('above')) textOp = { op: '>', val };
      else if (phrase.includes('less') || phrase.includes('under') || phrase.includes('below')) textOp = { op: '<', val };
      else if (phrase.includes('least')) textOp = { op: '>=', val };
      else if (phrase.includes('most')) textOp = { op: '<=', val };
      else if (phrase.includes('around') || phrase.includes('about') || phrase.includes('approx')) textOp = { op: '~', val };
    }

    // Precalculate parsed parameters for Range Logic
    const rangeMin = rangeMatch ? TruthEngine.parseAmountToCents(rangeMatch[1]) / 100 : 0;
    const rangeMax = rangeMatch ? TruthEngine.parseAmountToCents(rangeMatch[4]) / 100 : 0;

    // Precalculate Month Logic
    const parsedMonthIdx = (() => {
      if (!monthMatch) return -1;
      const mNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      return mNames.indexOf(monthMatch[1].toLowerCase()) % 12;
    })();
    const parsedMonthStr = parsedMonthIdx !== -1 ? (parsedMonthIdx + 1).toString().padStart(2, '0') : '';

    // Precalculate Relative Date thresholds and state variables
    const parsedRelativeRel = relativeTimeMatch ? relativeTimeMatch[1].toLowerCase() : '';
    const parsedNow = new Date();
    const parsedNowMonth = parsedNow.getMonth();
    const parsedNowYear = parsedNow.getFullYear();
    const parsedNowTime = parsedNow.getTime();
    const parsedTodayStr = format(parsedNow, 'yyyy-MM-dd');

    // Precalculate prefix filter parameters
    const queryCategory = categoryMatch ? categoryMatch[2].trim().toLowerCase() : '';
    const queryProject = projectMatch ? projectMatch[2].trim().toLowerCase() : '';
    const queryClass = classMatch ? classMatch[2].trim().toLowerCase() : '';
    const queryLocation = locationMatch ? locationMatch[2].trim().toLowerCase() : '';
    const queryStartsWith = startsWithMatch ? startsWithMatch[1].trim().toLowerCase() : '';
    const queryEndsWith = endsWithMatch ? endsWithMatch[1].trim().toLowerCase() : '';
    const queryContains = containsMatch ? containsMatch[1].trim().toLowerCase() : '';

    return normalized.filter(t => {
      // Identity Consistency Guard
      if (!t.id || !t._normalized) return false;

      // Filter Criteria (UI Overrides) - Optimized Procedural Filtering
      if (filterCriteria) {
        if ((filterCriteria.selectedCategories?.length ?? 0) > 0) {
          const account = resolveAccountName(accounts, t.lines?.[0]?.accountId, t.lines?.[0]?.accountName);
          if (!filterCriteria.selectedCategories?.includes(account || '')) return false;
        }
        if ((filterCriteria.selectedProjects?.length ?? 0) > 0) {
          if (!filterCriteria.selectedProjects?.includes(t.project || '')) return false;
        }
        if ((filterCriteria.selectedClasses?.length ?? 0) > 0) {
          const txClass = t.lines?.[0]?.class;
          if (!filterCriteria.selectedClasses?.includes(txClass || '')) return false;
        }
        if ((filterCriteria.selectedStatuses?.length ?? 0) > 0) {
          if (!filterCriteria.selectedStatuses?.includes(t.status || '')) return false;
        }
        if ((filterCriteria.selectedTypes?.length ?? 0) > 0) {
          if (!filterCriteria.selectedTypes?.includes(t.type || '')) return false;
        }

        const categoryName = resolveAccountName(accounts, t.lines?.[0]?.accountId, t.lines?.[0]?.accountName);
        if (filterCriteria.category && filterCriteria.category !== 'All' && categoryName !== filterCriteria.category) return false;
        if (filterCriteria.project && filterCriteria.project !== 'All' && t.project !== filterCriteria.project) return false;
        if (filterCriteria.type && filterCriteria.type !== 'All' && t.type !== filterCriteria.type) return false;
        
        if (filterCriteria.startDate && t.date < filterCriteria.startDate) return false;
        if (filterCriteria.endDate && t.date > filterCriteria.endDate) return false;
        if (filterCriteria.minAmount !== undefined && t._normalized.absAmount < filterCriteria.minAmount) return false;
        if (filterCriteria.maxAmount !== undefined && t._normalized.absAmount > filterCriteria.maxAmount) return false;

        // Class and Location arrays
        if (filterCriteria.selectedClasses && filterCriteria.selectedClasses.length > 0) {
          const match = t.lines?.some((l: any) => filterCriteria.selectedClasses?.includes(l.class || 'Unspecified'));
          if (!match) return false;
        }
        if (filterCriteria.selectedLocations && filterCriteria.selectedLocations.length > 0) {
          const match = t.lines?.some((l: any) => filterCriteria.selectedLocations?.includes(l.location || 'Unspecified'));
          if (!match) return false;
        }
      }

      // Smart Text Search Logic (Deterministic Intelligence)
      if (hasSearch) {
        let isMatch = true;

        // A. Amount Heuristics
        if (opVal) {
          const amt = t._normalized.absAmount;
          if (opVal.op === '>' && !(amt > opVal.val)) isMatch = false;
          else if (opVal.op === '<' && !(amt < opVal.val)) isMatch = false;
          else if (opVal.op === '=' && !(Math.abs(amt - opVal.val) < 0.01)) isMatch = false;
        } 
        else if (textOp) {
          const actualAmt = t._normalized.absAmount;
          if (textOp.op === '>') { if (!(actualAmt > textOp.val)) isMatch = false; }
          else if (textOp.op === '<') { if (!(actualAmt < textOp.val)) isMatch = false; }
          else if (textOp.op === '~') { if (!(actualAmt >= textOp.val * 0.9 && actualAmt <= textOp.val * 1.1)) isMatch = false; }
        }
        else if (rangeMatch) {
          const amt = t._normalized.absAmount;
          if (amt < rangeMin || amt > rangeMax) isMatch = false;
        }

        // B. Statistical Anchors
        if (isMatch && averageMatch) {
            const rel = averageMatch[1].toLowerCase();
            if (rel === 'above' && t._normalized.absAmount <= thresholds.avg) isMatch = false;
            if (rel === 'below' && t._normalized.absAmount >= thresholds.avg) isMatch = false;
        }
        if (isMatch && percentileMatch) {
            const side = percentileMatch[1].toLowerCase();
            const pct = percentileMatch[2];
            if (side === 'top' && pct === '10' && t._normalized.absAmount < thresholds.percentiles.top10) isMatch = false;
            if (side === 'top' && pct === '25' && t._normalized.absAmount < thresholds.percentiles.top25) isMatch = false;
            if (side === 'bottom' && pct === '10' && t._normalized.absAmount > thresholds.percentiles.bottom10) isMatch = false;
        }

        // C. Temporal Vectoring
        if (isMatch && monthMatch) {
          if (!(t.date || '').includes(`-${parsedMonthStr}-`)) isMatch = false;
        }
        if (isMatch && yearMatch) {
          if (!(t.date || '').startsWith(yearMatch[1])) isMatch = false;
        }
        if (isMatch && relativeTimeMatch) {
          const tDateStr = t.date || '';
          if (parsedRelativeRel === 'this month') {
             const tYear = parseInt(tDateStr.substring(0, 4), 10);
             const tMonth = parseInt(tDateStr.substring(5, 7), 10) - 1;
             if (tMonth !== parsedNowMonth || tYear !== parsedNowYear) isMatch = false;
          } else if (parsedRelativeRel === 'last month') {
             const lm = parsedNowMonth === 0 ? 11 : parsedNowMonth - 1;
             const lmy = parsedNowMonth === 0 ? parsedNowYear - 1 : parsedNowYear;
             const tYear = parseInt(tDateStr.substring(0, 4), 10);
             const tMonth = parseInt(tDateStr.substring(5, 7), 10) - 1;
             if (tMonth !== lm || tYear !== lmy) isMatch = false;
          } else if (parsedRelativeRel === 'this year') {
             const tYear = parseInt(tDateStr.substring(0, 4), 10);
             if (tYear !== parsedNowYear) isMatch = false;
          } else if (parsedRelativeRel === 'last year') {
             const tYear = parseInt(tDateStr.substring(0, 4), 10);
             if (tYear !== parsedNowYear - 1) isMatch = false;
          } else if (parsedRelativeRel === 'last 30 days') {
             const tTime = parseLocalDate(tDateStr).getTime();
             const diffDays = Math.floor((parsedNowTime - tTime) / (1000 * 60 * 60 * 24));
             if (diffDays < 0 || diffDays > 30) isMatch = false;
          } else if (parsedRelativeRel === 'ytd') {
             const tYear = parseInt(tDateStr.substring(0, 4), 10);
             const tDateObj = parseLocalDate(tDateStr);
             if (tYear !== parsedNowYear || tDateObj > parsedNow) isMatch = false;
          } else if (parsedRelativeRel === 'today') {
             if (tDateStr !== parsedTodayStr) isMatch = false;
          }
        }
        if (isMatch && quarterMatch) {
          const q = quarterMatch[1].toLowerCase();
          const tDateStr = t.date || '';
          const tMonth = parseInt(tDateStr.substring(5, 7), 10) - 1;
          if (q === 'q1' && tMonth > 2) isMatch = false;
          else if (q === 'q2' && (tMonth < 3 || tMonth > 5)) isMatch = false;
          else if (q === 'q3' && (tMonth < 6 || tMonth > 8)) isMatch = false;
          else if (q === 'q4' && tMonth < 9) isMatch = false;
        }
        if (isMatch && dateRangeMatch) {
          const start = dateRangeMatch[1];
          const end = dateRangeMatch[2];
          if (t.date < start || t.date > end) isMatch = false;
        }
        if (isMatch && sinceDateMatch) {
          const start = sinceDateMatch[2];
          if (t.date < start) isMatch = false;
        }
        if (isMatch && beforeDateMatch) {
          const end = beforeDateMatch[2];
          if (t.date > end) isMatch = false;
        }

        // D. String Pattern Matching (High Precision)
        if (isMatch && startsWithMatch) {
            if (!(t.description || '').toLowerCase().startsWith(queryStartsWith)) isMatch = false;
        }
        if (isMatch && endsWithMatch) {
            if (!(t.description || '').toLowerCase().endsWith(queryEndsWith)) isMatch = false;
        }
        if (isMatch && containsMatch) {
            if (!(t.description || '').toLowerCase().includes(queryContains)) isMatch = false;
        }

        // E. Entity & Audit Logic
        if (isMatch && categoryMatch) {
          const catName = resolveAccountName(accounts, t.lines?.[0]?.accountId, t.lines?.[0]?.accountName);
          if (!catName.toLowerCase().includes(queryCategory)) isMatch = false;
        }
        if (isMatch && projectMatch) {
          if (!(t.project || '').toLowerCase().includes(queryProject)) isMatch = false;
        }
        if (isMatch && classMatch) {
          if (!t.lines?.some((l: any) => (l.class || '').toLowerCase().includes(queryClass))) isMatch = false;
        }
        if (isMatch && locationMatch) {
          if (!t.lines?.some((l: any) => (l.location || '').toLowerCase().includes(queryLocation))) isMatch = false;
        }
        if (isMatch && errorMatch) {
           const auditErrors = LedgerEngine.auditTransaction(t, accountMap);
           if (auditErrors.length === 0) isMatch = false;
        }

        // F. Fallback: Fuzzy Brand Identification & Entity Resolution
        if (isMatch && !opVal && !textOp && !monthMatch && !yearMatch && !relativeTimeMatch && !categoryMatch && !projectMatch && !classMatch && !locationMatch && !errorMatch && !startsWithMatch && !endsWithMatch && !containsMatch && !averageMatch && !percentileMatch && !quarterMatch) {
            const searchStr = t._normalized.searchStr;
            const hasSubstring = searchStr.includes(lowerSearch);
            
            if (hasSubstring) {
              isMatch = true;
            } else {
              // Rapid short-circuit boundary for massive performance scaling
              const hasEntityMatch = t.lines?.some((l: any) => recognizedAccountNamesSet.has(l.accountName)) || 
                                     matchedByDimensionTxIds.has(t.id);
              
              if (normalized.length <= 10000) {
                const similarity = jaroWinklerSimilarity(lowerSearch, (t.description || '').toLowerCase(), user?.uid, t._normalized.sanitizedDescription);
                if (similarity < 0.85 && !hasEntityMatch) isMatch = false;
              } else {
                if (!hasEntityMatch) isMatch = false;
              }
            }
        }

        return isMatch;
      }

      return true;
    });
  }, [normalized, transactions, filterCriteria, searchTerm, accounts, dimensionNodes, user?.uid]);

  const chronologicalRunningBalances = useMemo(() => {
    // Chronologically compute historical running balance for every transaction to ensure mathematical stability.
    // Done once per transaction load, massively improving rendering & filtering performance for 50,000+ inputs.
    const chronologicalTxs = [...transactions].sort((a, b) => {
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
    let totalExposure = 0;
    let discrepancies = 0;
    const conflicts = new Map<string, { type: string, message: string }>();
    
    for (const t of smartFilteredTransactions) {
      totalExposure += Math.abs(t.totalAmountCents);
      
      const auditErrors = LedgerEngine.auditTransaction(t, accountMap);
      if (auditErrors.length > 0) {
        discrepancies++;
        conflicts.set(t.id, { 
          type: 'audit_fail', 
          message: auditErrors.join('; ')
        });
      }
    }

    return { 
      totalExposure, 
      count: smartFilteredTransactions.length, 
      discrepancies, 
      conflicts,
      totalValues: {
        sum: smartFilteredTransactions.reduce((acc, t) => acc + (t.totalAmountCents || 0), 0)
      }
    };
  }, [smartFilteredTransactions, accounts]);

  return { smartFilteredTransactions, transactionsWithBalance, stats, conflicts: stats.conflicts };
}
