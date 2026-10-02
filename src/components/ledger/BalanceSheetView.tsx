import { useLedgerStore } from '../../stores/useLedgerStore';
import React, { useId, useState, useMemo, useCallback, useEffect } from 'react';
import { ChartAccount, Transaction } from '../../types';
import { AlertCircle, Layers, HandCoins, ShieldCheck, Activity, Calendar, FileSpreadsheet, SplitSquareHorizontal, ArrowUp, ArrowDown, ExternalLink, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn, getLocalDateISO, addToDateISO } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';
import { isPostable, isTransactionInDateRange, lineAmount, calculateNetIncome } from '../../lib/txFilters';
import { motion } from 'motion/react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFinancialReporting, ServerBalanceSheetData } from '../../hooks/useFinancialReporting';
import MonthNavigator from '../ui/MonthNavigator';
import DrillDownModal from '../layout/DrillDownModal';

interface BalanceSheetViewProps {
  accounts: ChartAccount[];
  formatCurrency: (val: number) => string;
  /** As-of date and comparison chosen on the Reports page; the view follows them when given. */
  asOfDate?: string;
  compareEndDate?: string;
}

export default function BalanceSheetView({ accounts = [], formatCurrency, asOfDate: pageAsOfDate, compareEndDate }: BalanceSheetViewProps) {
  const formId = useId();
  const transactions = useLedgerStore(state => state.transactions || []);
  
  const [asOfDate, setAsOfDate] = useState<string>(getLocalDateISO());
  const [isComparative, setIsComparative] = useState<boolean>(false);
  const [priorDate, setPriorDate] = useState<string>(
    addToDateISO(getLocalDateISO(), { years: -1 })
  );
  useEffect(() => {
    if (pageAsOfDate) setAsOfDate(pageAsOfDate);
  }, [pageAsOfDate]);
  useEffect(() => {
    if (!pageAsOfDate) return;
    setIsComparative(Boolean(compareEndDate));
    if (compareEndDate) setPriorDate(compareEndDate);
  }, [pageAsOfDate, compareEndDate]);
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'balance'>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [drillDownTarget, setDrillDownTarget] = useState<{ accountName: string; transactions: Transaction[] } | null>(null);

  const isDataTruncated = useLedgerStore(s => s.isDataTruncated);
  const { fetchBalanceSheet, loadingStates } = useFinancialReporting();
  const [serverData, setServerData] = useState<ServerBalanceSheetData | null>(null);
  const [serverPrevData, setServerPrevData] = useState<ServerBalanceSheetData | null>(null);
  const [isServerAuthoritative, setIsServerAuthoritative] = useState(false);

  const loadServerReport = useCallback(async () => {
    try {
      const res = await fetchBalanceSheet(asOfDate);
      if (res) {
        setServerData(res);
        setIsServerAuthoritative(true);
      }
      if (isComparative) {
        const prevRes = await fetchBalanceSheet(priorDate);
        if (prevRes) {
          setServerPrevData(prevRes);
        }
      }
    } catch {
      setIsServerAuthoritative(false);
    }
  }, [fetchBalanceSheet, asOfDate, priorDate, isComparative]);

  useEffect(() => {
    loadServerReport();
  }, [loadServerReport]);

  const toggleSort = (field: 'code' | 'name' | 'balance') => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const workspaces = useAuthStore(s => s.workspaces);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const businessType = currentWorkspace?.businessType || 'generic';

  const labels = useMemo(() => {
    if (businessType === 'personal') {
      return {
        assetsLabel: "Personal Wealth & Assets",
        assetsSub: "Gross Liquid & Invested Portfolio",
        liabilitiesLabel: "Personal Debts & Liabilities",
        liabilitiesSub: "Aggregated Household Credit & Debt",
        equityLabel: "Personal Net Worth",
        equitySub: "Owner Cumulative Financial Capital",
        retainedEarningsLabel: "Household YTD Net Savings",
        retainedEarningsSub: "Calculated Periodic Savings Delta",
        totalClaimsLabel: "Total Liabilities & Net Worth",
        totalClaimsSub: "Combined Claims Dynamic Sum",
        isBalancedSuccess: "Equilibrium Confirmed",
        isBalancedDrift: "Discrepancy Detected"
      };
    } else if (businessType === 'nonprofit') {
      return {
        assetsLabel: "Charitable Trust & Fund Assets",
        assetsSub: "Restricted & Unrestricted Resources",
        liabilitiesLabel: "Institutional & Deferred Liabilities",
        liabilitiesSub: "Operational Commitments & Grants Payable",
        equityLabel: "Charitable Net Assets",
        equitySub: "Donor Reserves & Accumulated Funds",
        retainedEarningsLabel: "YTD Operating Surplus / Deficit",
        retainedEarningsSub: "Periodic Performance Change",
        totalClaimsLabel: "Total Liabilities & Net Assets",
        totalClaimsSub: "Aggregate Claims & Account Balance",
        isBalancedSuccess: "Fund Balanced",
        isBalancedDrift: "Balance Drift Detected"
      };
    } else {
      return {
        assetsLabel: "Resource Matrix (Assets)",
        assetsSub: "Aggregate Asset Vectors",
        liabilitiesLabel: "Institutional Obligations (Liabilities)",
        liabilitiesSub: "Operational Liabilities & Accounts Payable",
        equityLabel: "Owner Equity & Capital",
        equitySub: "Equity Topology & Paid-In Capital",
        retainedEarningsLabel: "Retained Earnings (YTD Net)",
        retainedEarningsSub: "Calculated Dynamic Net Surplus",
        totalClaimsLabel: "Total Equity & Liabilities",
        totalClaimsSub: "Combined Claims & Capital Balance",
        isBalancedSuccess: "Balanced Double-Entry",
        isBalancedDrift: "Balance Drift Detected"
      };
    }
  }, [businessType]);

  const getPeriodBalances = useCallback((dateCutoff: string) => {
    const assets: { [id: string]: number } = {};
    const liabilities: { [id: string]: number } = {};
    const equity: { [id: string]: number } = {};
    const income: { [id: string]: number } = {};
    const expense: { [id: string]: number } = {};

    const accountMap = new Map<string, ChartAccount>();
    accounts.forEach(acc => {
      accountMap.set(acc.id, acc);
      accountMap.set(acc.name, acc);
    });
    
    // Initialize with account opening balances
    accounts.forEach(acc => {
      const initVal = acc.openingBalanceCents || 0;
      if (acc.type === 'asset') assets[acc.id] = initVal;
      else if (acc.type === 'liability') liabilities[acc.id] = initVal;
      else if (acc.type === 'equity') equity[acc.id] = initVal;
      else if (acc.type === 'income' || acc.type === 'revenue') income[acc.id] = initVal;
      else if (acc.type === 'expense' || acc.type === 'cost_of_goods') expense[acc.id] = initVal;
    });

    const orphanedLines: Array<{ accountId: string; transactionId?: string; date?: string; amountCents: number }> = [];

    // Sum transactions before or on cutoff date
    transactions.forEach(tx => {
      if (!isPostable(tx) || !isTransactionInDateRange(tx, undefined, dateCutoff)) return;
      tx.lines?.forEach(line => {
        const id = line.accountId;
        const acc = accountMap.get(id) || (line.accountName ? accountMap.get(line.accountName) : undefined);
        if (!acc) {
          orphanedLines.push({
            accountId: id || line.accountName || 'unknown',
            transactionId: tx.id,
            date: tx.date,
            amountCents: lineAmount(line, tx)
          });
          return;
        }
        const accId = acc.id;
        
        const amt = lineAmount(line, tx);
        const isDebitNature = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';
        const delta = isDebitNature ? amt : -amt;

        if (acc.type === 'asset') assets[accId] = (assets[accId] || 0) + delta;
        else if (acc.type === 'liability') liabilities[accId] = (liabilities[accId] || 0) + delta;
        else if (acc.type === 'equity') equity[accId] = (equity[accId] || 0) + delta;
        else if (acc.type === 'income' || acc.type === 'revenue') income[accId] = (income[accId] || 0) + delta;
        else if (acc.type === 'expense' || acc.type === 'cost_of_goods') expense[accId] = (expense[accId] || 0) + delta;
      });
    });

    const totalAssets = Object.values(assets).reduce((sum, v) => sum + v, 0);
    const totalLiabilities = Object.values(liabilities).reduce((sum, v) => sum + v, 0);
    const totalEquity = Object.values(equity).reduce((sum, v) => sum + v, 0);
    const { netIncome } = calculateNetIncome(transactions, accounts, "1970-01-01", dateCutoff);

    const totalClaims = totalLiabilities + totalEquity + netIncome;

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      netIncome,
      totalClaims,
      isBalanced: totalAssets === totalClaims,
      orphanedLines
    };
  }, [transactions, accounts]);

  const localCalculation = useMemo(() => {
    const current = getPeriodBalances(asOfDate);
    const prev = isComparative ? getPeriodBalances(priorDate) : current;
    return { currentData: current, prevData: prev };
  }, [getPeriodBalances, asOfDate, priorDate, isComparative]);

  const currentData = isServerAuthoritative && serverData ? serverData : localCalculation.currentData;
  const prevData = isServerAuthoritative && serverPrevData ? serverPrevData : localCalculation.prevData;

  const exportBalanceSheet = async () => {
    const columns = [
      { header: 'Account Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 10 },
      { header: 'Current Balance', key: 'balance', width: 20 },
      { header: isComparative ? 'Prior Balance' : '', key: 'prior', width: 20 },
      { header: isComparative ? 'Variance' : '', key: 'variance', width: 20 },
      { header: isComparative ? 'Variance %' : '', key: 'variancePct', width: 15 },
    ];

    const titleRows = [
      ['Balance Sheet Statement'],
      [`Reporting Date: As of ${asOfDate}`, isComparative ? `Prior Reference: As of ${priorDate}` : '']
    ];

    const rows: any[] = [];

    rows.push([labels.assetsLabel.toUpperCase()]);
    accounts.filter(a => a.type === 'asset').forEach(acc => {
      const curBal = currentData.assets[acc.id] || 0;
      const prvBal = isComparative ? prevData.assets[acc.id] || 0 : 0;
      const variance = curBal - prvBal;
      const variancePct = prvBal !== 0 ? (variance / Math.abs(prvBal)) * 100 : 0;
      rows.push({
        name: acc.name,
        code: acc.code,
        balance: curBal / 100,
        prior: isComparative ? prvBal / 100 : null,
        variance: isComparative ? variance / 100 : null,
        variancePct: isComparative && prvBal !== 0 ? variancePct.toFixed(1) + '%' : null
      });
    });
    rows.push({
      name: `Total ${labels.assetsLabel}`,
      balance: currentData.totalAssets / 100,
      prior: isComparative ? prevData.totalAssets / 100 : null
    });
    rows.push([]);

    rows.push([labels.liabilitiesLabel.toUpperCase()]);
    accounts.filter(a => a.type === 'liability').forEach(acc => {
      const curBal = currentData.liabilities[acc.id] || 0;
      const prvBal = isComparative ? prevData.liabilities[acc.id] || 0 : 0;
      const variance = curBal - prvBal;
      const variancePct = prvBal !== 0 ? (variance / Math.abs(prvBal)) * 100 : 0;
      rows.push({
        name: acc.name,
        code: acc.code,
        balance: curBal / 100,
        prior: isComparative ? prvBal / 100 : null,
        variance: isComparative ? variance / 100 : null,
        variancePct: isComparative && prvBal !== 0 ? variancePct.toFixed(1) + '%' : null
      });
    });
    rows.push({
      name: `Total ${labels.liabilitiesLabel}`,
      balance: currentData.totalLiabilities / 100,
      prior: isComparative ? prevData.totalLiabilities / 100 : null
    });
    rows.push([]);

    rows.push([labels.equityLabel.toUpperCase()]);
    accounts.filter(a => a.type === 'equity').forEach(acc => {
      const curBal = currentData.equity[acc.id] || 0;
      const prvBal = isComparative ? prevData.equity[acc.id] || 0 : 0;
      const variance = curBal - prvBal;
      const variancePct = prvBal !== 0 ? (variance / Math.abs(prvBal)) * 100 : 0;
      rows.push({
        name: acc.name,
        code: acc.code,
        balance: curBal / 100,
        prior: isComparative ? prvBal / 100 : null,
        variance: isComparative ? variance / 100 : null,
        variancePct: isComparative && prvBal !== 0 ? variancePct.toFixed(1) + '%' : null
      });
    });

    const curRetEarn = currentData.netIncome;
    const prvRetEarn = isComparative ? prevData.netIncome : 0;
    const reVariance = curRetEarn - prvRetEarn;
    const reVariancePct = prvRetEarn !== 0 ? (reVariance / Math.abs(prvRetEarn)) * 100 : 0;
    rows.push({
      name: labels.retainedEarningsLabel,
      code: 'INC',
      balance: curRetEarn / 100,
      prior: isComparative ? prvRetEarn / 100 : null,
      variance: isComparative ? reVariance / 100 : null,
      variancePct: isComparative && prvRetEarn !== 0 ? reVariancePct.toFixed(1) + '%' : null
    });

    rows.push({
      name: `Total ${labels.equityLabel}`,
      balance: (currentData.totalEquity + currentData.netIncome) / 100,
      prior: isComparative ? (prevData.totalEquity + prevData.netIncome) / 100 : null
    });
    rows.push([]);
    rows.push({
      name: labels.totalClaimsLabel,
      balance: currentData.totalClaims / 100,
      prior: isComparative ? prevData.totalClaims / 100 : null
    });

    await exportToExcel(columns, rows, {
      sheetName: 'Balance Sheet',
      fileName: `Balance_Sheet_As_Of_${asOfDate}.xlsx`,
      titleRows
    });
  };

  const getVarianceAndPct = (curVal: number, prVal: number) => {
    const diff = curVal - prVal;
    const pct = prVal !== 0 ? (diff / Math.abs(prVal)) * 100 : null;
    return { diff, pct };
  };

  return (
    <div className="space-y-6">
      {/* Authoritative / Truncation Status Banner */}
      {!isServerAuthoritative && isDataTruncated ? (
        <div id="bs-statement-truncation-banner" className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle aria-hidden="true" className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Showing 2,000 of N transactions — totals are incomplete</span>
          </div>
          <button
            onClick={loadServerReport}
            disabled={loadingStates.balanceSheet}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded text-xs transition flex items-center gap-1.5"
          >
            {loadingStates.balanceSheet ? <RefreshCw aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>{loadingStates.balanceSheet ? "Loading Server..." : "Load Full Server Report"}</span>
          </button>
        </div>
      ) : isServerAuthoritative ? (
        <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400" />
            <span>Server-Authoritative Balance Sheet (Full History Verified)</span>
          </div>
          <button 
            onClick={loadServerReport} 
            title="Refresh server report"
            aria-label="Refresh server report"
            className="text-emerald-400/80 hover:text-emerald-300 p-0.5 rounded transition"
          >
            <RefreshCw aria-hidden="true" className={cn("w-3 h-3", loadingStates.balanceSheet && "animate-spin")} />
          </button>
        </div>
      ) : null}

      {/* Date controls and configuration header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-xl shadow-3xs relative overflow-hidden group gap-4">
        <div className="absolute technical-grid inset-0 opacity-[0.015] pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10 w-full lg:w-auto">
          <MonthNavigator
            currentDate={asOfDate}
            onMonthChange={({ end }) => setAsOfDate(end)}
          />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--ink)] border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--muted)] shrink-0">
               <Calendar aria-hidden="true" size={13} />
            </div>
            <div className="flex flex-col">
              <label htmlFor={`${formId}-as-of`} className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mb-0.5">As Of Reporting Date</label>
              <input 
                id={`${formId}-as-of`}
                type="date" 
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-slate-100 border-none text-xs font-semibold px-2.5 py-1 rounded-md focus:ring-1 focus:ring-slate-300 outline-none text-[var(--text)]"
              />
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-slate-200" />

          {/* Comparative mode selector */}
          <label htmlFor={`${formId}-comparative`} aria-label="Comparative Year-on-Year" className="flex items-center gap-2 cursor-pointer group/toggle">
            <input 
               id={`${formId}-comparative`}
               type="checkbox" 
               className="hidden" 
               checked={isComparative} 
               onChange={(e) => setIsComparative(e.target.checked)} 
            />
            <div className={cn(
               "w-8 h-4 rounded-full flex items-center p-0.5 transition-colors duration-300",
               isComparative ? "bg-indigo-500" : "bg-slate-300"
            )}>
              <div className={cn(
                "w-3 h-3 bg-[var(--surface)] rounded-full shadow-sm transition-transform duration-300",
                isComparative ? "translate-x-4" : "translate-[0px]"
              )} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider group-hover/toggle:text-[var(--text)] transition-colors flex items-center gap-1">
                Comparative Year-on-Year <SplitSquareHorizontal aria-hidden="true" size={10} className={cn(isComparative ? "text-indigo-500" : "text-[var(--muted)]")} />
              </span>
              <span className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest">Compare historical snapshot balances</span>
            </div>
          </label>

          {isComparative && (
            <>
              <div className="hidden sm:block w-px h-8 bg-slate-100" />
              <div className="flex flex-col">
                <label htmlFor={`${formId}-prior-as-of`} className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mb-0.5">Prior As Of Reference</label>
                <input 
                  id={`${formId}-prior-as-of`}
                  type="date" 
                  value={priorDate}
                  onChange={(e) => setPriorDate(e.target.value)}
                  className="bg-slate-100 border-none text-xs font-semibold px-2.5 py-1 rounded-md focus:ring-1 focus:ring-slate-300 outline-none text-[var(--text)]"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider px-1">Sort:</span>
            {(['code', 'name', 'balance'] as const).map(field => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={cn(
                  "px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1 cursor-pointer",
                  sortBy === field ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-[var(--text)]"
                )}
              >
                <span>{field}</span>
                {sortBy === field && (
                  sortDir === 'asc' ? <ArrowUp aria-hidden="true" size={9} /> : <ArrowDown aria-hidden="true" size={9} />
                )}
              </button>
            ))}
          </div>

          <button 
            onClick={exportBalanceSheet}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all shadow-sm active:scale-95 group/btn w-full lg:w-auto cursor-pointer"
           aria-label="Export Blueprint">
            <FileSpreadsheet aria-hidden="true" size={13} className="text-emerald-400 group-hover/btn:text-emerald-300 transition-colors shrink-0" />
            <span>Export Blueprint</span>
          </button>
        </div>
      </div>

      {/* Fundamental Equilibrium Status Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-slate-900 rounded-xl text-white shadow-sm relative overflow-hidden border border-slate-950 gap-4">
        <div className="absolute technical-grid inset-0 opacity-[0.03] pointer-events-none" />
        <div className="flex flex-col relative z-10">
          <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">Fundamental Equilibrium Status</span>
          <div className="flex items-baseline gap-3">
             <span className="text-xl font-black text-white tracking-tight">
               {currentData.isBalanced ? labels.isBalancedSuccess : 'Drift Alert'}
             </span>
             <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
               • {currentData.isBalanced ? 'Stable' : labels.isBalancedDrift}
             </p>
          </div>
        </div>

        <div className="flex items-center gap-6 relative z-10">
          {isComparative && (
            <div className="text-right">
              <span className="block text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest leading-none mb-1">As Of {priorDate}</span>
              <span className="block text-xs font-mono font-medium text-[var(--muted)] tabular-nums">
                {formatCurrency(prevData.totalAssets)} Assets / {formatCurrency(prevData.totalClaims)} Claims
              </span>
            </div>
          )}
          <motion.div 
            animate={currentData.isBalanced ? { scale: [1, 1.02, 1] } : { x: [0, -3, 3, -3, 3, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center border font-bold text-xs relative z-10 shadow-sm shrink-0",
              currentData.isBalanced 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}
          >
            {currentData.isBalanced ? <ShieldCheck aria-hidden="true" size={16} /> : <AlertCircle aria-hidden="true" size={16} />}
          </motion.div>
        </div>
      </div>

      {currentData.orphanedLines && currentData.orphanedLines.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-200">
          <AlertCircle aria-hidden="true" className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">
              Orphaned Account References Detected ({currentData.orphanedLines.length} line{currentData.orphanedLines.length > 1 ? 's' : ''})
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Transactions reference accounts not found in the current Chart of Accounts. This unbalances assets and claims.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from(new Set(currentData.orphanedLines.map(l => l.accountId))).map(accId => (
                <span key={accId} className="px-2 py-0.5 bg-amber-200/50 dark:bg-amber-900/40 rounded text-[10px] font-mono font-medium">
                  Missing ID: {accId}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets Column */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/80 shadow-3xs overflow-hidden group hover:border-slate-300 transition-all flex flex-col"
        >
          <div className="p-4 border-b border-[var(--line)] bg-[var(--ink)]/50 flex justify-between items-center relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-2 opacity-[0.015] pointer-events-none group-hover:rotate-6 transition-transform duration-700">
              <Layers aria-hidden="true" size={80} className="text-[var(--text)]" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider leading-none">{labels.assetsLabel}</h3>
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1 block">{labels.assetsSub}</span>
            </div>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              {accounts.filter(a => a.type === 'asset')
                .sort((a, b) => {
                  let comp: number;
                  if (sortBy === 'code') comp = (a.code || '').localeCompare(b.code || '');
                  else if (sortBy === 'name') comp = (a.name || '').localeCompare(b.name || '');
                  else comp = (currentData.assets[a.id] || 0) - (currentData.assets[b.id] || 0);
                  return sortDir === 'asc' ? comp : -comp;
                })
                .map(acc => {
                const curVal = currentData.assets[acc.id] || 0;
                const prVal = isComparative ? prevData.assets[acc.id] || 0 : curVal;
                const variance = getVarianceAndPct(curVal, prVal);

                return (
                  <button
                    key={acc.id} 
                    type="button" onClick={() => {
                      const matchedTxs = transactions.filter(t => isPostable(t) && isTransactionInDateRange(t, undefined, asOfDate) && t.lines?.some(l => l.accountId === acc.id || l.accountName === acc.name));
                      setDrillDownTarget({ accountName: acc.name, transactions: matchedTxs });
                    }}
                    title={`Click to drill down into ${acc.name}`}
                    className="w-full text-left flex justify-between items-center hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 p-2 rounded-lg transition-all border border-transparent hover:border-indigo-300 dark:hover:border-indigo-800 min-w-0 cursor-pointer group/row"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-[var(--ink)] text-[var(--muted)] rounded-md flex items-center justify-center text-[9px] font-bold font-mono border border-[var(--line)] shrink-0">
                        {acc.code}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text)] group-hover/row:text-indigo-600 transition-colors uppercase tracking-tight truncate flex items-center gap-1.5">
                          {acc.name}
                          <ExternalLink aria-hidden="true" size={10} className="opacity-0 group-hover/row:opacity-100 text-indigo-500 transition-opacity" />
                        </p>
                        <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider truncate">{acc.category || 'Direct Asset'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="font-mono font-bold text-[var(--text)] text-xs tabular-nums">{formatCurrency(curVal)}</span>
                      {isComparative && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[8px] text-[var(--muted)] tabular-nums">prev: {formatCurrency(prVal)}</span>
                          {variance.pct !== null && prVal !== 0 && (
                            <span className={cn("text-[8px] font-bold", variance.pct >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {variance.pct >= 0 ? '+' : ''}{variance.pct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-900 flex justify-between items-center relative overflow-hidden gap-4">
              <div className="flex items-center gap-1.5">
                 <Activity aria-hidden="true" size={14} className="text-slate-600 shrink-0" />
                 <span className="text-[var(--text)] font-bold uppercase tracking-wider text-[9px]">Total {labels.assetsLabel}</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-bold text-[var(--text)] tracking-tight block leading-none tabular-nums">{formatCurrency(currentData.totalAssets)}</span>
                {isComparative && prevData.totalAssets !== 0 && (
                  <span className={cn("text-[9px] font-bold block mt-1", currentData.totalAssets >= prevData.totalAssets ? "text-emerald-500" : "text-rose-500")}>
                    {(((currentData.totalAssets - prevData.totalAssets) / Math.abs(prevData.totalAssets)) * 100).toFixed(1)}% vs Prior
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Liabilities & Equity Column */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/80 shadow-3xs overflow-hidden group hover:border-slate-300 transition-all flex flex-col"
        >
          <div className="p-4 border-b border-[var(--line)] bg-[var(--ink)]/50 flex justify-between items-center relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-2 opacity-[0.015] pointer-events-none group-hover:-rotate-6 transition-transform duration-700">
               <HandCoins aria-hidden="true" size={80} className="text-[var(--text)]" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider leading-none">{labels.liabilitiesLabel} & {labels.equityLabel}</h3>
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1 block">{labels.liabilitiesSub} / {labels.equitySub}</span>
            </div>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Liabilities Section */}
              <div className="space-y-2">
                <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-wider truncate border-b border-[var(--line)] pb-2">{labels.liabilitiesLabel}</p>
                {accounts.filter(a => a.type === 'liability')
                  .sort((a, b) => {
                    let comp: number;
                    if (sortBy === 'code') comp = (a.code || '').localeCompare(b.code || '');
                    else if (sortBy === 'name') comp = (a.name || '').localeCompare(b.name || '');
                    else comp = (currentData.liabilities[a.id] || 0) - (currentData.liabilities[b.id] || 0);
                    return sortDir === 'asc' ? comp : -comp;
                  })
                  .map(acc => {
                  const curVal = currentData.liabilities[acc.id] || 0;
                  const prVal = isComparative ? prevData.liabilities[acc.id] || 0 : curVal;
                  const variance = getVarianceAndPct(curVal, prVal);

                  return (
                    <button
                      key={acc.id} 
                      type="button" onClick={() => {
                        const matchedTxs = transactions.filter(t => isPostable(t) && isTransactionInDateRange(t, undefined, asOfDate) && t.lines?.some(l => l.accountId === acc.id || l.accountName === acc.name));
                        setDrillDownTarget({ accountName: acc.name, transactions: matchedTxs });
                      }}
                      title={`Click to drill down into ${acc.name}`}
                      className="w-full text-left flex justify-between items-center hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 p-2 rounded-lg transition-all border border-transparent hover:border-indigo-300 dark:hover:border-indigo-800 min-w-0 cursor-pointer group/row"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-[var(--ink)] text-[var(--muted)] rounded-md flex items-center justify-center text-[9px] font-bold font-mono border border-[var(--line)] shrink-0">
                          {acc.code}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text)] group-hover/row:text-indigo-600 transition-colors uppercase tracking-tight truncate flex items-center gap-1.5">
                            {acc.name}
                            <ExternalLink aria-hidden="true" size={10} className="opacity-0 group-hover/row:opacity-100 text-indigo-500 transition-opacity" />
                          </p>
                          <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider truncate">{acc.category || 'Current Liability'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-2">
                        <span className="font-mono font-bold text-[var(--text)] text-xs tabular-nums">{formatCurrency(curVal)}</span>
                        {isComparative && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[8px] text-[var(--muted)] tabular-nums">prev: {formatCurrency(prVal)}</span>
                            {variance.pct !== null && prVal !== 0 && (
                              <span className={cn("text-[8px] font-bold", variance.pct <= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {variance.pct >= 0 ? '+' : ''}{variance.pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                <div className="flex justify-between items-center pt-2 text-[var(--muted)] text-[8px] font-bold uppercase tracking-wider">
                  <span>Sub-Total Liabilities</span>
                  <span className="font-mono font-semibold tabular-nums">{formatCurrency(currentData.totalLiabilities)}</span>
                </div>
              </div>

              {/* Equity Section */}
              <div className="space-y-2">
                <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-wider truncate border-b border-[var(--line)] pb-2">{labels.equityLabel}</p>
                {accounts.filter(a => a.type === 'equity')
                  .sort((a, b) => {
                    let comp: number;
                    if (sortBy === 'code') comp = (a.code || '').localeCompare(b.code || '');
                    else if (sortBy === 'name') comp = (a.name || '').localeCompare(b.name || '');
                    else comp = (currentData.equity[a.id] || 0) - (currentData.equity[b.id] || 0);
                    return sortDir === 'asc' ? comp : -comp;
                  })
                  .map(acc => {
                  const curVal = currentData.equity[acc.id] || 0;
                  const prVal = isComparative ? prevData.equity[acc.id] || 0 : curVal;
                  const variance = getVarianceAndPct(curVal, prVal);

                  return (
                    <button
                      key={acc.id} 
                      type="button" onClick={() => {
                        const matchedTxs = transactions.filter(t => isPostable(t) && isTransactionInDateRange(t, undefined, asOfDate) && t.lines?.some(l => l.accountId === acc.id || l.accountName === acc.name));
                        setDrillDownTarget({ accountName: acc.name, transactions: matchedTxs });
                      }}
                      title={`Click to drill down into ${acc.name}`}
                      className="w-full text-left flex justify-between items-center hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 p-2 rounded-lg transition-all border border-transparent hover:border-indigo-300 dark:hover:border-indigo-800 min-w-0 cursor-pointer group/row"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-[var(--ink)] text-[var(--muted)] rounded-md flex items-center justify-center text-[9px] font-bold font-mono border border-[var(--line)] shrink-0">
                          {acc.code}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text)] group-hover/row:text-indigo-600 transition-colors uppercase tracking-tight truncate flex items-center gap-1.5">
                            {acc.name}
                            <ExternalLink aria-hidden="true" size={10} className="opacity-0 group-hover/row:opacity-100 text-indigo-500 transition-opacity" />
                          </p>
                          <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider truncate">{acc.category || 'Owner Equity'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-2">
                        <span className="font-mono font-bold text-[var(--text)] text-xs tabular-nums">{formatCurrency(curVal)}</span>
                        {isComparative && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[8px] text-[var(--muted)] tabular-nums">prev: {formatCurrency(prVal)}</span>
                            {variance.pct !== null && prVal !== 0 && (
                              <span className={cn("text-[8px] font-bold", variance.pct <= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {variance.pct >= 0 ? '+' : ''}{variance.pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Retained Earnings Line Item */}
                <button
                  type="button" onClick={() => {
                    const matchedTxs = transactions.filter(t => isPostable(t) && isTransactionInDateRange(t, undefined, asOfDate) && t.lines?.some(l => {
                      const account = accounts.find(a => a.id === l.accountId);
                      return account && (account.type === 'income' || account.type === 'revenue' || account.type === 'expense' || account.type === 'cost_of_goods');
                    }));
                    setDrillDownTarget({ accountName: 'Retained Earnings (Income & Expenses)', transactions: matchedTxs });
                  }}
                  title="Click to drill down into Retained Earnings transaction activity"
                  className="w-full text-left flex justify-between items-center bg-emerald-50/20 hover:bg-emerald-50/50 p-2 rounded-lg transition-all border border-emerald-100/40 hover:border-emerald-300 min-w-0 cursor-pointer group/row"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-md flex items-center justify-center text-[9px] font-bold font-mono border border-emerald-100 shrink-0">
                      INC
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-emerald-800 group-hover/row:text-emerald-950 uppercase tracking-tight truncate flex items-center gap-1.5">
                        {labels.retainedEarningsLabel}
                        <ExternalLink aria-hidden="true" size={10} className="opacity-0 group-hover/row:opacity-100 text-emerald-600 transition-opacity" />
                      </p>
                      <p className="text-[8px] font-bold text-emerald-600/60 uppercase tracking-wider truncate">{labels.retainedEarningsSub}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-2">
                    <span className={cn("font-mono font-bold text-xs", currentData.netIncome >= 0 ? "text-emerald-700" : "text-rose-700", "tabular-nums")}>
                      {formatCurrency(currentData.netIncome)}
                    </span>
                    {isComparative && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[8.5px] text-[var(--muted)] tabular-nums">prev: {formatCurrency(prevData.netIncome)}</span>
                        {prevData.netIncome !== 0 && (
                          <span className={cn("text-[8.5px] font-bold", (currentData.netIncome >= prevData.netIncome) ? "text-emerald-500" : "text-rose-500")}>
                            {(((currentData.netIncome - prevData.netIncome) / Math.abs(prevData.netIncome)) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>

                <div className="flex justify-between items-center pt-2 text-[var(--muted)] text-[8px] font-bold uppercase tracking-wider">
                  <span>Sub-Total Equity</span>
                  <span className="font-mono font-semibold tabular-nums">{formatCurrency(currentData.totalEquity + currentData.netIncome)}</span>
                </div>
              </div>
            </div>

            {/* Combined Total Liabilities & Equity */}
            <div className="mt-6 pt-4 border-t border-slate-900 flex justify-between items-center relative overflow-hidden gap-4">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[var(--text)] font-bold uppercase tracking-wider text-[9px] block">{labels.totalClaimsLabel}</span>
                {!currentData.isBalanced && (
                  <motion.span 
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-[8px] text-rose-600 font-bold uppercase tracking-wider flex items-center gap-1 truncate"
                  >
                    <AlertCircle aria-hidden="true" size={10} className="shrink-0" /> Balance Drift Detected
                  </motion.span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-lg font-mono font-bold text-[var(--text)] tracking-tight block leading-none tabular-nums">
                  {formatCurrency(currentData.totalClaims)}
                </span>
                {isComparative && prevData.totalClaims !== 0 && (
                  <span className={cn("text-[9px] font-bold block mt-1", currentData.totalClaims >= prevData.totalClaims ? "text-emerald-500" : "text-rose-500")}>
                    {(((currentData.totalClaims - prevData.totalClaims) / Math.abs(prevData.totalClaims)) * 100).toFixed(1)}% vs Prior
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Drill-Down Modal */}
      {drillDownTarget && (
        <DrillDownModal
          isOpen={!!drillDownTarget}
          onClose={() => setDrillDownTarget(null)}
          accountName={drillDownTarget.accountName}
          transactions={drillDownTarget.transactions}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}
