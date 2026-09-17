import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { usePerformanceTrace } from '../../hooks/usePerformanceTrace';
import { Transaction, ChartAccount, Project, Budget } from '../../types';
import { 
  Activity,
  Download,
  Loader2
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../../lib/utils';
const DrillDownModal = React.lazy(() => import('../layout/DrillDownModal'));

import { REPORT_TABS_REGISTRY, REPORT_COMPONENTS } from '../../config/registry';
import { useUIStore } from '../../stores/useUIStore';
import { getCachedReport, setCachedReport } from '../../lib/reportCache';



import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCommandDispatcher } from '../../hooks/useSystemContext';

const Reports = React.memo(() => {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const projects = useLedgerStore(s => s.projects);
  const budgets = useLedgerStore(s => s.budgets);
  const { handleAction: onAction } = useCommandDispatcher();
  usePerformanceTrace("Reports");
  const activeTab = useUIStore(state => state.activeReportTab || 'pnl');
    const setActiveTab = useUIStore(state => state.setActiveReportTab);
  const [timeframe, setTimeframe] = useState<'month' | 'quarter' | 'year'>('month');
  const [drillDownAccount, setDrillDownAccount] = useState<string | null>(null);
  const language = useUIStore(state => state.language);

  const availableYears = useMemo(() => {
    if (!transactions || transactions.length === 0) return [new Date().getFullYear()];
    const yearsSet = new Set<number>();
    for (let i = 0; i < transactions.length; i++) {
      const d = transactions[i].date;
      if (d && d.length >= 4) {
        yearsSet.add(parseInt(d.slice(0, 4), 10));
      }
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (!transactions || transactions.length === 0) return new Date().getFullYear();
    let maxYear = 0;
    for (let i = 0; i < transactions.length; i++) {
      const d = transactions[i].date;
      if (d && d.length >= 4) {
        const y = parseInt(d.slice(0, 4), 10);
        if (y > maxYear) maxYear = y;
      }
    }
    return maxYear || new Date().getFullYear();
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const quarterNames = ["Q1", "Q2", "Q3", "Q4"];

  const availableMonths = useMemo(() => {
    if (!transactions || transactions.length === 0) return [new Date().getMonth()];
    const monthsSet = new Set<number>();
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t.date && t.date.length >= 10 && parseInt(t.date.slice(0, 4), 10) === selectedYear) {
        monthsSet.add(parseInt(t.date.slice(5, 7), 10) - 1);
      }
    }
    if (monthsSet.size === 0) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    return Array.from(monthsSet).sort((a, b) => a - b);
  }, [transactions, selectedYear]);

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    if (!transactions || transactions.length === 0) return new Date().getMonth();
    let maxMonth = -1;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t.date && t.date.length >= 7 && parseInt(t.date.slice(0, 4), 10) === selectedYear) {
        const m = parseInt(t.date.slice(5, 7), 10) - 1;
        if (m > maxMonth) maxMonth = m;
      }
    }
    return maxMonth === -1 ? new Date().getMonth() : maxMonth;
  });

  const selectedQuarter = useMemo(() => Math.floor(selectedMonth / 3), [selectedMonth]);

  // Keep state synchronized when transactions stream in from Firestore
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      let maxYear = 0;
      const yearsSet = new Set<number>();
      for (let i = 0; i < transactions.length; i++) {
        const d = transactions[i].date;
        if (d && d.length >= 4) {
          const y = parseInt(d.slice(0, 4), 10);
          yearsSet.add(y);
          if (y > maxYear) maxYear = y;
        }
      }
      if (maxYear > 0 && !yearsSet.has(selectedYear)) {
        setSelectedYear(maxYear);
      }
    }
  }, [transactions, selectedYear]);

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      let maxMonth = -1;
      const monthsSet = new Set<number>();
      for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        if (t.date && t.date.length >= 7 && parseInt(t.date.slice(0, 4), 10) === selectedYear) {
          const m = parseInt(t.date.slice(5, 7), 10) - 1;
          monthsSet.add(m);
          if (m > maxMonth) maxMonth = m;
        }
      }
      if (maxMonth !== -1 && !monthsSet.has(selectedMonth)) {
        setSelectedMonth(maxMonth);
      }
    }
  }, [transactions, selectedYear, selectedMonth]);

  const filteredReportTransactions = useMemo(() => {
    if (!transactions) return [];
    const cacheKey = `report_tx_${selectedYear}_${selectedMonth}_${timeframe}_${transactions.length}`;
    const cached = getCachedReport<Transaction[]>(cacheKey);
    if (cached) return cached;

    const filtered = transactions.filter(t => {
      if (!t.date || t.date.length < 10) return false;
      const txYear = parseInt(t.date.slice(0, 4), 10);
      if (txYear !== selectedYear) return false;

      const txMonth = parseInt(t.date.slice(5, 7), 10) - 1; // 0-indexed month

      if (timeframe === 'month') {
        return txMonth === selectedMonth;
      }
      if (timeframe === 'quarter') {
        const q = Math.floor(txMonth / 3);
        return q === selectedQuarter;
      }
      return true; // For 'year', match current year block
    });

    setCachedReport(cacheKey, filtered);
    return filtered;
  }, [transactions, timeframe, selectedYear, selectedMonth, selectedQuarter]);

  const periodLabel = useMemo(() => {
    if (timeframe === 'month') return `${monthNames[selectedMonth]} ${selectedYear}`;
    if (timeframe === 'quarter') return `${quarterNames[selectedQuarter]} ${selectedYear}`;
    return `FY ${selectedYear}`;
  }, [timeframe, selectedMonth, selectedYear, selectedQuarter]);

  const drillDownTransactions = useMemo(() => {
    if (!drillDownAccount || !transactions) return [];
    return transactions.filter(t => t.lines?.some(l => l.accountName === drillDownAccount));
  }, [transactions, drillDownAccount]);

  const accountTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach(a => {
      if (a.name) map.set(a.name.toLowerCase(), a.type);
      map.set(a.id, a.type);
    });
    return map;
  }, [accounts]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header banner with brand gold backdrop */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-[var(--brass)] opacity-10 rounded-full blur-3xl hidden md:block pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 text-[10px] font-mono text-[var(--brass)] font-semibold shadow-xs">
              <Activity size={12} />
              FINANCIAL INTELLIGENCE HUB
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">Financial Reports & Statements</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-[var(--surface)]/80 p-2 rounded-xl border border-[var(--line)] shadow-inner backdrop-blur-sm">
            <button onClick={() => onAction('generate')} className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black hover:opacity-95 transition-all shadow-xs cursor-pointer">
              Generate
            </button>
            
            <div className="flex items-center gap-1 bg-[var(--panel)] border border-[var(--line)] p-0.5 rounded-lg">
              {(['month', 'quarter', 'year'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                    timeframe === t 
                      ? "bg-[var(--brass)] text-black shadow-xs font-bold" 
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-[var(--line)]" />

            {/* Dynamic Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--text)] hover:border-[var(--brass-line)] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] cursor-pointer"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            {/* Dynamic Month/Quarter Selector */}
            {timeframe === 'month' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--text)] hover:border-[var(--brass-line)] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] cursor-pointer animate-fade-in"
              >
                {monthNames.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
            )}

            {timeframe === 'quarter' && (
              <select
                value={selectedQuarter}
                onChange={(e) => {
                  const q = Number(e.target.value);
                  setSelectedMonth(q * 3);
                }}
                className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--text)] hover:border-[var(--brass-line)] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] cursor-pointer animate-fade-in"
              >
                {quarterNames.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
            )}

            <div className="h-4 w-px bg-[var(--line)]" />
            
            <button onClick={() => onAction('export')} className="h-7 px-2.5 bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] rounded-md shadow-xs hover:border-[var(--brass-line)] flex items-center justify-center transition-colors cursor-pointer" aria-label="Export">
              <Download size={14} />
            </button>
            
            <button onClick={() => onAction('print')} className="h-7 px-2.5 flex items-center justify-center text-[var(--text)] bg-[var(--surface)] border border-[var(--line)] rounded-md shadow-xs hover:border-[var(--brass-line)] transition-colors cursor-pointer" aria-label="Print">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-[var(--line)]">
        {REPORT_TABS_REGISTRY.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
              activeTab === tab.id
                ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold border-[var(--brass-line)] shadow-sm"
                : "bg-[var(--surface)] border-[var(--line)]/80 text-[var(--muted)] hover:border-[var(--brass-line)]/60 hover:text-[var(--text)] shadow-3xs"
            )}
          >
            <tab.icon size={14} />
            {tab.label[language] || tab.label['en']}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[600px]">
        <React.Suspense fallback={
          <div className="h-96 w-full flex flex-col items-center justify-center gap-4 opacity-50">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <p className="text-[10px] font-medium uppercase tracking-wider truncate">Assembling Financial Matrix...</p>
          </div>
        }>
          <AnimatePresence mode="wait">
            {REPORT_TABS_REGISTRY.map(tab => {
              if (tab.id !== activeTab) return null;
              const Component = REPORT_COMPONENTS[tab.componentName];
              
              // We pass all possible props to the dynamic component. 
              // React ignores extra props, and components grab what they need.
              const standardProps = {
                transactions: filteredReportTransactions,
                allTransactions: transactions,
                accounts,
                projects,
                budgets,
                selectedYear,
                periodLabel,
                formatCurrency,
                accountTypeMap,
                onDrillDown: (name: string) => setDrillDownAccount(name)
              };

              return (
                <Component key={tab.id} {...standardProps} />
              )
            })}
          </AnimatePresence>
        </React.Suspense>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-center pt-12">
        <button 
          onClick={() => onAction('export')}
          className="flex items-center gap-3 px-10 py-5 bg-[var(--surface)] border-2 border-zinc-900 rounded-full text-[var(--text)] font-medium uppercase tracking-wider text-xs hover:bg-zinc-900 hover:text-white transition-all group"
        >
          <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
          Export Full Financial Package
        </button>
      </div>
      <React.Suspense fallback={null}>
        <DrillDownModal 
          isOpen={!!drillDownAccount}
          onClose={() => setDrillDownAccount(null)}
          accountName={drillDownAccount || ''}
          transactions={drillDownTransactions}
          formatCurrency={formatCurrency}
        />
      </React.Suspense>
    </div>
  );
});

export default Reports;
