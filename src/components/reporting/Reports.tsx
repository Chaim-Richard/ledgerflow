import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePerformanceTrace } from '../../hooks/usePerformanceTrace';
import { Transaction } from '../../types';
import { 
  Activity,
  Download,
  Loader2,
  Printer
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn, formatCurrency, workspaceYearMonth } from '../../lib/utils';
const DrillDownModal = React.lazy(() => import('../layout/DrillDownModal'));

import { REPORT_TABS_REGISTRY, REPORT_COMPONENTS } from '../../config/registry';
import { useUIStore } from '../../stores/useUIStore';
import { getCachedReport, setCachedReport } from '../../lib/reportCache';
import { ViewErrorBoundary } from '../common/ViewErrorBoundary';



import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCommandDispatcher } from '../../hooks/useSystemContext';
import { useAuthStore } from '../../stores/useAuthStore';
import { getComparePeriod, getReportPeriod } from '../../lib/fiscalCalendar';
import type { CompareMode } from '../../lib/fiscalCalendar';
import { reportStateFromParams, reportStateToParams } from '../../lib/reportPermalink';
import { isTransactionInDateRange } from '../../lib/txFilters';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';

/** The report settings in the address bar when the page opened (a shared link), if any. */
function linkedReportParams(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const quarterNames = ["Q1", "Q2", "Q3", "Q4"];

const Reports = React.memo(() => {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const projects = useLedgerStore(s => s.projects);
  const budgets = useLedgerStore(s => s.budgets);
  useLedgerCollections('budgets');
  const { handleAction: onAction } = useCommandDispatcher();
  usePerformanceTrace("Reports");
  const activeTab = useUIStore(state => state.activeReportTab || 'pnl');
    const setActiveTab = useUIStore(state => state.setActiveReportTab);
  const fiscalYearStartMonth = useAuthStore(s => s.getCurrentWorkspace()?.fiscalYearStartMonth) || 1;
  const [linked] = useState(() => {
    return reportStateFromParams(linkedReportParams(), {
      report: activeTab, year: 0, timeframe: 'month', quarter: -1, month: -1, compare: 'none',
    });
  });
  const [timeframe, setTimeframe] = useState<'month' | 'quarter' | 'year'>(linked.timeframe);
  const [compareMode, setCompareMode] = useState<CompareMode>(linked.compare);
  const [drillDownAccount, setDrillDownAccount] = useState<string | null>(null);
  const language = useUIStore(state => state.language);

  const availableYears = useMemo(() => {
    if (!transactions || transactions.length === 0) return [workspaceYearMonth().year];
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
    if (linked.year) return linked.year;
    if (!transactions || transactions.length === 0) return workspaceYearMonth().year;
    let maxYear = 0;
    for (let i = 0; i < transactions.length; i++) {
      const d = transactions[i].date;
      if (d && d.length >= 4) {
        const y = parseInt(d.slice(0, 4), 10);
        if (y > maxYear) maxYear = y;
      }
    }
    return maxYear || workspaceYearMonth().year;
  });



  useMemo(() => {
    if (!transactions || transactions.length === 0) return [workspaceYearMonth().month];
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
    if (linked.month >= 0) return linked.month;
    if (!transactions || transactions.length === 0) return workspaceYearMonth().month;
    let maxMonth = -1;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t.date && t.date.length >= 7 && parseInt(t.date.slice(0, 4), 10) === selectedYear) {
        const m = parseInt(t.date.slice(5, 7), 10) - 1;
        if (m > maxMonth) maxMonth = m;
      }
    }
    return maxMonth === -1 ? workspaceYearMonth().month : maxMonth;
  });

  const [selectedQuarter, setSelectedQuarter] = useState<number>(() => (linked.quarter >= 0 ? linked.quarter : 0));

  // The dates every report uses (fiscal-year aware) and the comparison period
  const period = useMemo(
    () => getReportPeriod(timeframe, selectedYear, selectedQuarter, selectedMonth, fiscalYearStartMonth),
    [timeframe, selectedYear, selectedQuarter, selectedMonth, fiscalYearStartMonth]
  );
  const comparePeriod = useMemo(() => getComparePeriod(period.startDate, period.endDate, compareMode), [period, compareMode]);

  // Open the report named in a shared link, then keep the address bar in step with the settings
  const linkOpened = useRef(false);
  useEffect(() => {
    if (linkOpened.current) return;
    linkOpened.current = true;
    if (linked.report !== activeTab && REPORT_TABS_REGISTRY.some(t => t.id === linked.report)) setActiveTab(linked.report);
  }, [linked.report, activeTab, setActiveTab]);
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = reportStateToParams({ report: activeTab, year: selectedYear, timeframe, quarter: selectedQuarter, month: selectedMonth, compare: compareMode }, url.searchParams);
    const next = `${url.pathname}?${params.toString()}${url.hash}`;
    if (next !== `${url.pathname}${url.search}${url.hash}`) window.history.replaceState(window.history.state, '', next);
  }, [activeTab, selectedYear, timeframe, selectedQuarter, selectedMonth, compareMode]);

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
      if (maxYear > 0 && !yearsSet.has(selectedYear) && !linked.year) {
        setSelectedYear(maxYear);
      }
    }
  }, [transactions, selectedYear, linked.year]);

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
      if (maxMonth !== -1 && !monthsSet.has(selectedMonth) && linked.month < 0) {
        setSelectedMonth(maxMonth);
      }
    }
  }, [transactions, selectedYear, selectedMonth, linked.month]);

  const filteredReportTransactions = useMemo(() => {
    if (!transactions) return [];
    const cacheKey = `report_tx_${period.startDate}_${period.endDate}_${transactions.length}`;
    const cached = getCachedReport<Transaction[]>(cacheKey);
    if (cached) return cached;
    const filtered = transactions.filter(t => isTransactionInDateRange(t, period.startDate, period.endDate));
    setCachedReport(cacheKey, filtered);
    return filtered;
  }, [transactions, period]);

  const periodLabel = useMemo(() => {
    const fy = fiscalYearStartMonth === 1 ? String(selectedYear) : `FY${selectedYear}`;
    if (timeframe === 'month') return `${monthNames[selectedMonth]} ${period.startDate.slice(0, 4)}`;
    if (timeframe === 'quarter') return `${quarterNames[selectedQuarter]} ${fy}`;
    return fiscalYearStartMonth === 1 ? `FY ${selectedYear}` : fy;
  }, [timeframe, selectedMonth, selectedYear, selectedQuarter, fiscalYearStartMonth, period.startDate]);

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
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6" data-print-root>
      {/* Printed / PDF heading: the report and its period */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{(REPORT_TABS_REGISTRY.find(t => t.id === activeTab)?.label as Record<string, string> | undefined)?.en || 'Report'}</h1>
        <p className="text-sm">{periodLabel} · {period.startDate} to {period.endDate}{comparePeriod ? ` · compared with ${comparePeriod.startDate} to ${comparePeriod.endDate}` : ''}</p>
      </div>
      {/* Header banner with brand gold backdrop */}
      <div data-print-hide className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
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
                      ? "bg-[var(--brass)] text-[var(--ink)] shadow-xs font-bold" 
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
              aria-label="Select Year"
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
                aria-label="Select Month"
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
                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                aria-label="Select Quarter"
                className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--text)] hover:border-[var(--brass-line)] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] cursor-pointer animate-fade-in"
              >
                {quarterNames.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
            )}

            <select
              value={compareMode}
              onChange={(e) => setCompareMode(e.target.value as CompareMode)}
              aria-label="Compare to"
              className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--text)] hover:border-[var(--brass-line)] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] cursor-pointer"
            >
              <option value="none">No comparison</option>
              <option value="previous">vs previous period</option>
              <option value="lastYear">vs same period last year</option>
            </select>

            <div className="h-4 w-px bg-[var(--line)]" />
            
            <button onClick={() => onAction('export')} className="h-7 px-2.5 bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] rounded-md shadow-xs hover:border-[var(--brass-line)] flex items-center justify-center transition-colors cursor-pointer" aria-label="Export">
              <Download size={14} />
            </button>
            
            <button onClick={() => window.print()} className="h-7 px-2.5 flex items-center gap-1.5 text-[10px] font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--line)] rounded-md shadow-xs hover:border-[var(--brass-line)] transition-colors cursor-pointer">
              <Printer size={14} aria-hidden="true" /> Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div data-print-hide className="flex flex-wrap gap-2 pb-2 border-b border-[var(--line)]">
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
                startDate: period.startDate,
                endDate: period.endDate,
                asOfDate: period.endDate,
                compareStartDate: comparePeriod?.startDate,
                compareEndDate: comparePeriod?.endDate,
                formatCurrency,
                accountTypeMap,
                onDrillDown: (name: string) => setDrillDownAccount(name)
              };

              const reportTitle = typeof tab.label === 'string' ? tab.label : (tab.label?.en || tab.id);

              return (
                <ViewErrorBoundary key={tab.id} viewName={reportTitle}>
                  <Component {...standardProps} />
                </ViewErrorBoundary>
              );
            })}
          </AnimatePresence>
        </React.Suspense>
      </div>

      {/* Footer Actions */}
      <div data-print-hide className="flex justify-center pt-12">
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
          from="Reports"
          transactions={drillDownTransactions}
          formatCurrency={formatCurrency}
        />
      </React.Suspense>
    </div>
  );
});

export default Reports;
