import { useLedgerStore } from '../../stores/useLedgerStore';
import React, { useState, useMemo } from 'react';
import { ChartAccount, Transaction, JournalEntry } from '../../types';
import { 
  AlertCircle, 
  Layers, 
  HandCoins, 
  ShieldCheck, 
  Activity, 
  Calendar, 
  FileSpreadsheet, 
  SplitSquareHorizontal
} from 'lucide-react';
import { cn, getLocalDateISO } from '../../lib/utils';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { useAuthStore } from '../../stores/useAuthStore';

interface BalanceSheetViewProps {
  accounts: ChartAccount[];
  
  journalEntries: JournalEntry[];
  formatCurrency: (val: number) => string;
}

export default function BalanceSheetView({ accounts = [], journalEntries = [], formatCurrency }: BalanceSheetViewProps) {
  const transactions = useLedgerStore(state => state.transactions || []);
  
  const [asOfDate, setAsOfDate] = useState<string>(getLocalDateISO());
  const [isComparative, setIsComparative] = useState<boolean>(false);
  const [priorDate, setPriorDate] = useState<string>(
    getLocalDateISO(new Date(new Date().getFullYear() - 1, new Date().getMonth(), new Date().getDate()))
  );

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

  const getPeriodBalances = (dateCutoff: string) => {
    const assets: { [id: string]: number } = {};
    const liabilities: { [id: string]: number } = {};
    const equity: { [id: string]: number } = {};
    const income: { [id: string]: number } = {};
    const expense: { [id: string]: number } = {};
    
    // Initialize with account opening balances
    accounts.forEach(acc => {
      const initVal = acc.openingBalanceCents || 0;
      if (acc.type === 'asset') assets[acc.id] = initVal;
      else if (acc.type === 'liability') liabilities[acc.id] = initVal;
      else if (acc.type === 'equity') equity[acc.id] = initVal;
      else if (acc.type === 'income' || acc.type === 'revenue') income[acc.id] = initVal;
      else if (acc.type === 'expense' || acc.type === 'cost_of_goods') expense[acc.id] = initVal;
    });

    // Sum transactions before or on cutoff date
    transactions.forEach(tx => {
      if (tx.deletedAt || tx.date > dateCutoff) return;
      tx.lines?.forEach(line => {
        const id = line.accountId;
        const acc = accounts.find(a => a.id === id);
        if (!acc) return;
        
        const isDebitNature = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';
        const delta = isDebitNature ? line.amountCents : -line.amountCents;

        if (acc.type === 'asset') assets[id] = (assets[id] || 0) + delta;
        else if (acc.type === 'liability') liabilities[id] = (liabilities[id] || 0) + delta;
        else if (acc.type === 'equity') equity[id] = (equity[id] || 0) + delta;
        else if (acc.type === 'income' || acc.type === 'revenue') income[id] = (income[id] || 0) + delta;
        else if (acc.type === 'expense' || acc.type === 'cost_of_goods') expense[id] = (expense[id] || 0) + delta;
      });
    });

    // Sum General Journal entries before or on cutoff date
    journalEntries.forEach(entry => {
      if (entry.deletedAt || entry.date > dateCutoff) return;
      entry.lines?.forEach(line => {
        const id = line.accountId;
        const acc = accounts.find(a => a.id === id);
        if (!acc) return;

        const netAmount = line.debit - line.credit;
        const isDebitNature = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';
        const delta = isDebitNature ? netAmount : -netAmount;

        if (acc.type === 'asset') assets[id] = (assets[id] || 0) + delta;
        else if (acc.type === 'liability') liabilities[id] = (liabilities[id] || 0) + delta;
        else if (acc.type === 'equity') equity[id] = (equity[id] || 0) + delta;
        else if ((acc.type === 'income' || acc.type === 'revenue')) income[id] = (income[id] || 0) + delta;
        else if ((acc.type === 'expense' || acc.type === 'cost_of_goods')) expense[id] = (expense[id] || 0) + delta;
      });
    });

    const totalAssets = Object.values(assets).reduce((sum, v) => sum + v, 0);
    const totalLiabilities = Object.values(liabilities).reduce((sum, v) => sum + v, 0);
    const totalEquity = Object.values(equity).reduce((sum, v) => sum + v, 0);
    const totalIncome = Object.values(income).reduce((sum, v) => sum + v, 0);
    const totalExpenses = Object.values(expense).reduce((sum, v) => sum + v, 0);
    const netIncome = totalIncome - totalExpenses;

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
      isBalanced: Math.abs(totalAssets - totalClaims) < 1 // check for integer equality
    };
  };

  const { currentData, prevData } = useMemo(() => {
    const currentData = getPeriodBalances(asOfDate);
    const prevData = isComparative ? getPeriodBalances(priorDate) : currentData;
    return { currentData, prevData };
  }, [accounts, journalEntries, asOfDate, priorDate, isComparative]);

  const exportBalanceSheet = () => {
    const rows = [
      ['Balance Sheet Statement', ''],
      [`Reporting Date: As of ${asOfDate}`, isComparative ? `Prior Reference: As of ${priorDate}` : ''],
      [],
      ['Account Name', 'Code', 'Current Balance', isComparative ? 'Prior Balance' : '', isComparative ? 'Variance' : '', isComparative ? 'Variance %' : ''],
      [],
      [labels.assetsLabel.toUpperCase()],
    ];

    const currentAssetsAccs = accounts.filter(a => a.type === 'asset');
    currentAssetsAccs.forEach(acc => {
      const curBal = currentData.assets[acc.id] || 0;
      const prvBal = isComparative ? prevData.assets[acc.id] || 0 : 0;
      const variance = curBal - prvBal;
      const variancePct = prvBal !== 0 ? (variance / Math.abs(prvBal)) * 100 : 0;

      rows.push([
        acc.name,
        acc.code,
        (curBal / 100).toFixed(2),
        isComparative ? (prvBal / 100).toFixed(2) : '',
        isComparative ? (variance / 100).toFixed(2) : '',
        isComparative && prvBal !== 0 ? variancePct.toFixed(1) + '%' : ''
      ]);
    });

    rows.push([`Total ${labels.assetsLabel}`, '', (currentData.totalAssets / 100).toFixed(2), isComparative ? (prevData.totalAssets / 100).toFixed(2) : '', '', '']);
    rows.push([]);

    rows.push([labels.liabilitiesLabel.toUpperCase()]);
    const currentLiabilitiesAccs = accounts.filter(a => a.type === 'liability');
    currentLiabilitiesAccs.forEach(acc => {
      const curBal = currentData.liabilities[acc.id] || 0;
      const prvBal = isComparative ? prevData.liabilities[acc.id] || 0 : 0;
      const variance = curBal - prvBal;
      const variancePct = prvBal !== 0 ? (variance / Math.abs(prvBal)) * 100 : 0;

      rows.push([
        acc.name,
        acc.code,
        (curBal / 100).toFixed(2),
        isComparative ? (prvBal / 100).toFixed(2) : '',
        isComparative ? (variance / 100).toFixed(2) : '',
        isComparative && prvBal !== 0 ? variancePct.toFixed(1) + '%' : ''
      ]);
    });

    rows.push([`Total ${labels.liabilitiesLabel}`, '', (currentData.totalLiabilities / 100).toFixed(2), isComparative ? (prevData.totalLiabilities / 100).toFixed(2) : '', '', '']);
    rows.push([]);

    rows.push([labels.equityLabel.toUpperCase()]);
    const currentEquityAccs = accounts.filter(a => a.type === 'equity');
    currentEquityAccs.forEach(acc => {
      const curBal = currentData.equity[acc.id] || 0;
      const prvBal = isComparative ? prevData.equity[acc.id] || 0 : 0;
      const variance = curBal - prvBal;
      const variancePct = prvBal !== 0 ? (variance / Math.abs(prvBal)) * 100 : 0;

      rows.push([
        acc.name,
        acc.code,
        (curBal / 100).toFixed(2),
        isComparative ? (prvBal / 100).toFixed(2) : '',
        isComparative ? (variance / 100).toFixed(2) : '',
        isComparative && prvBal !== 0 ? variancePct.toFixed(1) + '%' : ''
      ]);
    });

    // Retained Earnings row
    const curRetEarn = currentData.netIncome;
    const prvRetEarn = isComparative ? prevData.netIncome : 0;
    const reVariance = curRetEarn - prvRetEarn;
    const reVariancePct = prvRetEarn !== 0 ? (reVariance / Math.abs(prvRetEarn)) * 100 : 0;
    rows.push([
      labels.retainedEarningsLabel,
      'INC',
      (curRetEarn / 100).toFixed(2),
      isComparative ? (prvRetEarn / 100).toFixed(2) : '',
      isComparative ? (reVariance / 100).toFixed(2) : '',
      isComparative && prvRetEarn !== 0 ? reVariancePct.toFixed(1) + '%' : ''
    ]);

    rows.push([`Total ${labels.equityLabel}`, '', ((currentData.totalEquity + currentData.netIncome) / 100).toFixed(2), isComparative ? ((prevData.totalEquity + prevData.netIncome) / 100).toFixed(2) : '', '', '']);
    rows.push([]);
    rows.push([labels.totalClaimsLabel, '', (currentData.totalClaims / 100).toFixed(2), isComparative ? (prevData.totalClaims / 100).toFixed(2) : '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
    XLSX.writeFile(wb, `Balance_Sheet_As_Of_${asOfDate}.xlsx`);
  };

  const getVarianceAndPct = (curVal: number, prVal: number) => {
    const diff = curVal - prVal;
    const pct = prVal !== 0 ? (diff / Math.abs(prVal)) * 100 : null;
    return { diff, pct };
  };

  return (
    <div className="space-y-6">
      {/* Date controls and configuration header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-xl shadow-3xs relative overflow-hidden group gap-4">
        <div className="absolute technical-grid inset-0 opacity-[0.015] pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10 w-full lg:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--ink)] border border-[var(--line)] rounded-lg flex items-center justify-center text-slate-500 shrink-0">
               <Calendar size={13} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">As Of Reporting Date</span>
              <input 
                type="date" 
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-slate-100 border-none text-xs font-semibold px-2.5 py-1 rounded-md focus:ring-1 focus:ring-slate-300 outline-none text-[var(--text)]"
              />
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-slate-200" />

          {/* Comparative mode selector */}
          <label className="flex items-center gap-2 cursor-pointer group/toggle">
            <input 
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
                Comparative Year-on-Year <SplitSquareHorizontal size={10} className={cn(isComparative ? "text-indigo-500" : "text-slate-400")} />
              </span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Compare historical snapshot balances</span>
            </div>
          </label>

          {isComparative && (
            <>
              <div className="hidden sm:block w-px h-8 bg-slate-100" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Prior As Of Reference</span>
                <input 
                  type="date" 
                  value={priorDate}
                  onChange={(e) => setPriorDate(e.target.value)}
                  className="bg-slate-100 border-none text-xs font-semibold px-2.5 py-1 rounded-md focus:ring-1 focus:ring-slate-300 outline-none text-[var(--text)]"
                />
              </div>
            </>
          )}
        </div>

        <button 
          onClick={exportBalanceSheet}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all shadow-sm active:scale-95 group/btn w-full lg:w-auto cursor-pointer"
        >
          <FileSpreadsheet size={13} className="text-emerald-400 group-hover/btn:text-emerald-300 transition-colors shrink-0" />
          <span>Export Blueprint</span>
        </button>
      </div>

      {/* Fundamental Equilibrium Status Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-slate-900 rounded-xl text-white shadow-sm relative overflow-hidden border border-slate-950 gap-4">
        <div className="absolute technical-grid inset-0 opacity-[0.03] pointer-events-none" />
        <div className="flex flex-col relative z-10">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fundamental Equilibrium Status</span>
          <div className="flex items-baseline gap-3">
             <span className="text-xl font-black text-white tracking-tight">
               {currentData.isBalanced ? labels.isBalancedSuccess : 'Drift Alert'}
             </span>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
               • {currentData.isBalanced ? 'Stable' : labels.isBalancedDrift}
             </p>
          </div>
        </div>

        <div className="flex items-center gap-6 relative z-10">
          {isComparative && (
            <div className="text-right">
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">As Of {priorDate}</span>
              <span className="block text-xs font-mono font-medium text-slate-400">
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
            {currentData.isBalanced ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets Column */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/80 shadow-3xs overflow-hidden group hover:border-slate-300 transition-all flex flex-col"
        >
          <div className="p-4 border-b border-[var(--line)] bg-[var(--ink)]/50 flex justify-between items-center relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-2 opacity-[0.015] pointer-events-none group-hover:rotate-6 transition-transform duration-700">
              <Layers size={80} className="text-[var(--text)]" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider leading-none">{labels.assetsLabel}</h3>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1 block">{labels.assetsSub}</span>
            </div>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              {accounts.filter(a => a.type === 'asset').map(acc => {
                const curVal = currentData.assets[acc.id] || 0;
                const prVal = isComparative ? prevData.assets[acc.id] || 0 : curVal;
                const variance = getVarianceAndPct(curVal, prVal);

                return (
                  <div key={acc.id} className="flex justify-between items-center hover:bg-[var(--ink)]/60 p-2 rounded-lg transition-all border border-transparent hover:border-[var(--line)] min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-[var(--ink)] text-slate-500 rounded-md flex items-center justify-center text-[9px] font-bold font-mono border border-[var(--line)] shrink-0">
                        {acc.code}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text)] uppercase tracking-tight truncate">{acc.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{acc.category || 'Direct Asset'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="font-mono font-bold text-[var(--text)] text-xs">{formatCurrency(curVal)}</span>
                      {isComparative && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[8px] text-slate-400">prev: {formatCurrency(prVal)}</span>
                          {variance.pct !== null && prVal !== 0 && (
                            <span className={cn("text-[8px] font-bold", variance.pct >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {variance.pct >= 0 ? '+' : ''}{variance.pct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-900 flex justify-between items-center relative overflow-hidden gap-4">
              <div className="flex items-center gap-1.5">
                 <Activity size={14} className="text-slate-600 shrink-0" />
                 <span className="text-[var(--text)] font-bold uppercase tracking-wider text-[9px]">Total {labels.assetsLabel}</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-bold text-[var(--text)] tracking-tight block leading-none">{formatCurrency(currentData.totalAssets)}</span>
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
               <HandCoins size={80} className="text-[var(--text)]" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider leading-none">{labels.liabilitiesLabel} & {labels.equityLabel}</h3>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1 block">{labels.liabilitiesSub} / {labels.equitySub}</span>
            </div>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Liabilities Section */}
              <div className="space-y-2">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider truncate border-b border-[var(--line)] pb-2">{labels.liabilitiesLabel}</p>
                {accounts.filter(a => a.type === 'liability').map(acc => {
                  const curVal = currentData.liabilities[acc.id] || 0;
                  const prVal = isComparative ? prevData.liabilities[acc.id] || 0 : curVal;
                  const variance = getVarianceAndPct(curVal, prVal);

                  return (
                    <div key={acc.id} className="flex justify-between items-center hover:bg-[var(--ink)]/60 p-2 rounded-lg transition-all border border-transparent hover:border-[var(--line)] min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-[var(--ink)] text-slate-500 rounded-md flex items-center justify-center text-[9px] font-bold font-mono border border-[var(--line)] shrink-0">
                          {acc.code}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text)] uppercase tracking-tight truncate">{acc.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{acc.category || 'Current Liability'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-2">
                        <span className="font-mono font-bold text-[var(--text)] text-xs">{formatCurrency(curVal)}</span>
                        {isComparative && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[8px] text-slate-400">prev: {formatCurrency(prVal)}</span>
                            {variance.pct !== null && prVal !== 0 && (
                              <span className={cn("text-[8px] font-bold", variance.pct <= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {variance.pct >= 0 ? '+' : ''}{variance.pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-2 text-slate-400 text-[8px] font-bold uppercase tracking-wider">
                  <span>Sub-Total Liabilities</span>
                  <span className="font-mono font-semibold">{formatCurrency(currentData.totalLiabilities)}</span>
                </div>
              </div>

              {/* Equity Section */}
              <div className="space-y-2">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider truncate border-b border-[var(--line)] pb-2">{labels.equityLabel}</p>
                {accounts.filter(a => a.type === 'equity').map(acc => {
                  const curVal = currentData.equity[acc.id] || 0;
                  const prVal = isComparative ? prevData.equity[acc.id] || 0 : curVal;
                  const variance = getVarianceAndPct(curVal, prVal);

                  return (
                    <div key={acc.id} className="flex justify-between items-center hover:bg-[var(--ink)]/60 p-2 rounded-lg transition-all border border-transparent hover:border-[var(--line)] min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-[var(--ink)] text-slate-500 rounded-md flex items-center justify-center text-[9px] font-bold font-mono border border-[var(--line)] shrink-0">
                          {acc.code}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text)] uppercase tracking-tight truncate">{acc.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{acc.category || 'Owner Equity'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-2">
                        <span className="font-mono font-bold text-[var(--text)] text-xs">{formatCurrency(curVal)}</span>
                        {isComparative && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[8px] text-slate-400">prev: {formatCurrency(prVal)}</span>
                            {variance.pct !== null && prVal !== 0 && (
                              <span className={cn("text-[8px] font-bold", variance.pct >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {variance.pct >= 0 ? '+' : ''}{variance.pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Retained Earnings Line Item */}
                <div className="flex justify-between items-center bg-emerald-50/20 hover:bg-emerald-50/40 p-2 rounded-lg transition-all border border-emerald-100/40 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-md flex items-center justify-center text-[9px] font-bold font-mono border border-emerald-100 shrink-0">
                      INC
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-emerald-800 uppercase tracking-tight truncate">{labels.retainedEarningsLabel}</p>
                      <p className="text-[8px] font-bold text-emerald-600/60 uppercase tracking-wider truncate">{labels.retainedEarningsSub}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-2">
                    <span className={cn("font-mono font-bold text-xs", currentData.netIncome >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {formatCurrency(currentData.netIncome)}
                    </span>
                    {isComparative && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[8.5px] text-slate-400">prev: {formatCurrency(prevData.netIncome)}</span>
                        {prevData.netIncome !== 0 && (
                          <span className={cn("text-[8.5px] font-bold", (currentData.netIncome >= prevData.netIncome) ? "text-emerald-500" : "text-rose-500")}>
                            {(((currentData.netIncome - prevData.netIncome) / Math.abs(prevData.netIncome)) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 text-slate-400 text-[8px] font-bold uppercase tracking-wider">
                  <span>Sub-Total Equity</span>
                  <span className="font-mono font-semibold">{formatCurrency(currentData.totalEquity + currentData.netIncome)}</span>
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
                    <AlertCircle size={10} className="shrink-0" /> Balance Drift Detected
                  </motion.span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-lg font-mono font-bold text-[var(--text)] tracking-tight block leading-none">
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
    </div>
  );
}
