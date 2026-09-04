import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, FileSpreadsheet, Activity, Target, Zap, SplitSquareHorizontal, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { parseLocalDate, cn, getLocalDateISO, formatCurrency } from '../../lib/utils';
import * as XLSX from 'xlsx';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import DrillDownModal from '../layout/DrillDownModal';

interface PLData {
  income: { total: number; accounts: Record<string, any> };
  expense: { total: number; accounts: Record<string, any> };
  grossProfit: number;
  netIncome: number;
}

interface ProfitAndLossViewProps {
  workspaceId: string;
}

const ProfitAndLossView: React.FC<ProfitAndLossViewProps> = ({ workspaceId }) => {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const [dateRange, setDateRange] = useState({
    start: getLocalDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    end: getLocalDateISO()
  });
  const [isComparative, setIsComparative] = useState(false);
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'balance'>('balance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [drillDownTarget, setDrillDownTarget] = useState<{ accountName: string; transactions: any[] } | null>(null);

  const toggleSort = (field: 'code' | 'name' | 'balance') => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const workspaces = useAuthStore(s => s.workspaces);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const businessType = currentWorkspace?.businessType || 'generic';

  const labels = useMemo(() => {
    if (businessType === 'personal') {
      return {
        title: "Income & Expenditures (Household)",
        inflowLabel: "Household Inflows",
        inflowSub: "Generating Income",
        outflowLabel: "Living Expenditures",
        outflowSub: "Household Cost Absorption",
        netLabel: "Household Net Savings",
        netSub: "Net Performance Summary",
        revenueStreams: "Inflow Categories",
        expenseClusters: "Outflow Categories",
        netChangeTitle: "Household Savings Potential",
        exportName: "Household_Income_Statement"
      };
    } else if (businessType === 'nonprofit') {
      return {
        title: "Statement of Activities",
        inflowLabel: "Fundraising & Program Revenues",
        inflowSub: "Public Contribution Inflows",
        outflowLabel: "Operating Expenditures",
        outflowSub: "Program Services Absorption",
        netLabel: "Change in Net Assets",
        netSub: "Net Surplus Summary",
        revenueStreams: "Public Revenues & Grants",
        expenseClusters: "Functional Program Expenditures",
        netChangeTitle: "Net Reserve Surplus",
        exportName: "Statement_of_Activities"
      };
    } else {
      return {
        title: "Profit & Loss Statement",
        inflowLabel: "Inflow Velocity",
        inflowSub: "Generating Revenue",
        outflowLabel: "Resource Leakage",
        outflowSub: "Cost Absorption",
        netLabel: "Net Structural Surplus",
        netSub: "Performance Protocol Status",
        revenueStreams: "Revenue Streams",
        expenseClusters: "Expense Clusters",
        netChangeTitle: "Net Performance Surplus",
        exportName: "Profit_and_Loss_Statement"
      };
    }
  }, [businessType]);

  // Helper to subtract months
  const getPrevPeriod = (start: string, end: string) => {
    const s = parseLocalDate(start);
    const e = parseLocalDate(end);
    const msDiff = e.getTime() - s.getTime();
    const prevE = new Date(s.getTime() - 86400000); 
    const MathDiffDays = Math.round(msDiff / 86400000);
    const prevS = new Date(prevE.getTime() - (MathDiffDays * 86400000));
    return {
      start: getLocalDateISO(prevS),
      end: getLocalDateISO(prevE)
    }
  };

  const { data, prevData } = useMemo(() => {
    const defaultData = {
      income: { total: 0, accounts: {} },
      expense: { total: 0, accounts: {} },
      grossProfit: 0,
      netIncome: 0
    };
    if (!Array.isArray(transactions) || !Array.isArray(accounts)) return { data: defaultData, prevData: defaultData };

    const calculatePeriod = (start: string, end: string) => {
      const pl: PLData = {
        income: { total: 0, accounts: {} },
        expense: { total: 0, accounts: {} },
        grossProfit: 0,
        netIncome: 0
      };

      const accountMap = new Map();
      for (let i = 0; i < accounts.length; i++) accountMap.set(accounts[i].id, accounts[i]);

      const filtered = transactions.filter(t => t.date >= start && t.date <= end);

      for (let i = 0; i < filtered.length; i++) {
        const t = filtered[i];
        const lines = t.lines || [];
        for (let j = 0; j < lines.length; j++) {
          const l = lines[j];
          const acc = accountMap.get(l.accountId);
          if (!acc) continue;

          if (acc.type === 'income' || acc.type === 'revenue') {
            const amount = -(l.amountCents || 0);
            pl.income.total += amount;
            if (!pl.income.accounts[acc.id]) {
              pl.income.accounts[acc.id] = { name: acc.name, code: acc.code, balance: 0 };
            }
            pl.income.accounts[acc.id].balance += amount;
          } else if (acc.type === 'expense' || acc.type === 'cost_of_goods') {
            const amount = (l.amountCents || 0);
            pl.expense.total += amount;
            if (!pl.expense.accounts[acc.id]) {
              pl.expense.accounts[acc.id] = { name: acc.name, code: acc.code, balance: 0 };
            }
            pl.expense.accounts[acc.id].balance += amount;
          }
        }
      }

      pl.grossProfit = pl.income.total;
      pl.netIncome = pl.income.total - pl.expense.total;
      return pl;
    };

    const currentPl = calculatePeriod(dateRange.start, dateRange.end);
    let prevPl = defaultData;
    
    if (isComparative) {
      const prev = getPrevPeriod(dateRange.start, dateRange.end);
      prevPl = calculatePeriod(prev.start, prev.end);
    }

    return { data: currentPl, prevData: prevPl };
  }, [transactions, accounts, dateRange, isComparative]);

  const formatCurrency = (cents: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const exportToExcel = () => {
    if (!data) return;
    
    const isComp = isComparative;

    const rows = [
      [labels.title, '', ''],
      [`Period: ${dateRange.start} to ${dateRange.end}`, isComp ? 'Prior Period' : '', isComp ? 'Variance %' : ''],
      ['', '', ''],
      ['Account', 'Amount', isComp ? 'Prior Amount' : '', isComp ? 'Variance %' : ''],
      [labels.revenueStreams.toUpperCase(), '', '', ''],
      ...Object.values(data.income?.accounts || {}).map((acc: any) => {
         const pBal = (prevData?.income?.accounts as any)[acc.id]?.balance || 0;
         const varPct = pBal !== 0 ? (((acc.balance || 0) - pBal) / Math.abs(pBal)) * 100 : 0;
         return [acc.name, (acc.balance || 0) / 100, isComp ? pBal / 100 : '', isComp && pBal !== 0 ? varPct.toFixed(2) + '%' : ''];
      }),
      [`Total ${labels.revenueStreams}`, (data.income?.total || 0) / 100, isComp ? (prevData?.income?.total || 0) / 100 : '', ''],
      ['', '', '', ''],
      [labels.expenseClusters.toUpperCase(), '', '', ''],
      ...Object.values(data.expense?.accounts || {}).map((acc: any) => {
         const pBal = (prevData?.expense?.accounts as any)[acc.id]?.balance || 0;
         const varPct = pBal !== 0 ? (((acc.balance || 0) - pBal) / Math.abs(pBal)) * 100 : 0;
         return [acc.name, (acc.balance || 0) / 100, isComp ? pBal / 100 : '', isComp && pBal !== 0 ? varPct.toFixed(2) + '%' : ''];
      }),
      [`Total ${labels.expenseClusters}`, (data.expense?.total || 0) / 100, isComp ? (prevData?.expense?.total || 0) / 100 : '', ''],
      ['', '', '', ''],
      [labels.netLabel.toUpperCase(), (data.netIncome || 0) / 100, isComp ? (prevData?.netIncome || 0) / 100 : '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `${labels.exportName}_${dateRange.start}_${dateRange.end}.xlsx`);
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Date Range & Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-xl shadow-3xs relative overflow-hidden group gap-4">
        <div className="absolute technical-grid inset-0 opacity-[0.015] pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10 w-full lg:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--ink)] border border-[var(--line)] rounded-lg flex items-center justify-center text-slate-500 shrink-0">
               <Calendar size={13} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Temporal Range</span>
              <div className="flex flex-wrap items-center gap-2">
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="bg-slate-55 bg-slate-100 border-none text-xs font-semibold px-2 py-1 rounded-md focus:ring-1 focus:ring-slate-300 outline-none text-[var(--text)]"
                />
                <span className="text-slate-300 font-mono text-sm leading-none">/</span>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-slate-55 bg-slate-100 border-none text-xs font-semibold px-2 py-1 rounded-md focus:ring-1 focus:ring-slate-300 outline-none text-[var(--text)]"
                />
              </div>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200" />
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
                isComparative ? "translate-x-4" : "translate-x-0"
              )} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider group-hover/toggle:text-[var(--text)] transition-colors flex items-center gap-1">
                Comparative Mode <SplitSquareHorizontal size={10} className={cn(isComparative ? "text-indigo-500" : "text-slate-400")} />
              </span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Compare to Prior Prev</span>
            </div>
          </label>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold uppercase text-[10px] tracking-wider hover:bg-slate-800 transition-all shadow-sm active:scale-95 group/btn w-full lg:w-auto cursor-pointer"
         aria-label="Export Synthesis">
          <FileSpreadsheet size={13} className="text-emerald-400 group-hover/btn:text-emerald-300 transition-colors shrink-0" />
          <span>Export Synthesis</span>
        </button>
      </div>

      {/* KPI Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--surface)] p-5 rounded-xl border border-[var(--line)]/80 shadow-3xs relative overflow-hidden group hover:border-slate-300 transition-all flex flex-col justify-between"
        >
           <div className="absolute -top-3 -right-3 p-3 opacity-[0.015] group-hover:rotate-6 transition-transform text-[var(--text)]">
             <TrendingUp size={80} />
           </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{labels.inflowLabel}</p>
            <p className="text-xl font-black text-[var(--text)] leading-none mb-3 tabular-nums font-mono">{formatCurrency(data.income?.total || 0)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider w-fit">
              <Activity size={10} className="animate-pulse" />
              {labels.inflowSub}
            </div>
            {isComparative && prevData.income?.total !== 0 && (
               <span className={cn(
                 "text-[9px] font-bold", 
                 (data.income?.total || 0) >= prevData.income?.total ? "text-emerald-500" : "text-rose-500"
               )}>
                 {(((data.income?.total || 0) - prevData.income.total) / Math.abs(prevData.income.total) * 100).toFixed(1)}% vs Prior
               </span>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[var(--surface)] p-5 rounded-xl border border-[var(--line)]/80 shadow-3xs relative overflow-hidden group hover:border-slate-300 transition-all flex flex-col justify-between"
        >
          <div className="absolute -top-3 -right-3 p-3 opacity-[0.015] group-hover:-rotate-6 transition-transform text-[var(--text)]">
              <TrendingDown size={80} />
           </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{labels.outflowLabel}</p>
            <p className="text-xl font-black text-[var(--text)] leading-none mb-3 tabular-nums font-mono">{formatCurrency(data.expense?.total || 0)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider w-fit">
              <Zap size={10} />
              {labels.outflowSub}
            </div>
            {isComparative && prevData.expense?.total !== 0 && (
               <span className={cn(
                 "text-[9px] font-bold", 
                 (data.expense?.total || 0) <= prevData.expense?.total ? "text-emerald-500" : "text-rose-500"
               )}>
                 {(((data.expense?.total || 0) - prevData.expense.total) / Math.abs(prevData.expense.total) * 100).toFixed(1)}% vs Prior
               </span>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "p-5 rounded-xl border shadow-3xs relative overflow-hidden transition-all flex flex-col justify-between",
            (data.netIncome || 0) >= 0 ? "bg-slate-900 text-white border-slate-950" : "bg-rose-950 text-white border-rose-950"
          )}
        >
          <div className="absolute -top-3 -right-3 p-3 opacity-[0.05] group-hover:scale-105 transition-transform text-white">
              <Target size={80} />
           </div>
          <div>
            <p className="text-[9px] font-bold text-white/40 mb-2 uppercase tracking-wider">{labels.netLabel}</p>
            <p className="text-xl font-black italic tracking-tight font-mono leading-none mb-3">
              {formatCurrency(data.netIncome || 0)}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-auto">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/60">
              {(data.netIncome || 0) >= 0 ? "Surplus Mode Stable" : "Refinement Protocol Recommended"}
            </p>
            {isComparative && prevData.netIncome !== 0 && (
               <span className={cn(
                 "text-[9px] font-bold ml-auto", 
                 (data.netIncome || 0) >= prevData.netIncome ? "text-emerald-400" : "text-rose-400"
               )}>
                 {(((data.netIncome || 0) - prevData.netIncome) / Math.abs(prevData.netIncome) * 100).toFixed(1)}%
               </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Detail Core */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/80 shadow-3xs overflow-hidden relative">
        <div className="absolute technical-grid inset-0 opacity-[0.01] pointer-events-none" />
        <div className="p-4 border-b border-slate-150 bg-[var(--ink)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">{labels.title}</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Hierarchical Performance Synthesis</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sort By:</span>
            <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--line)] rounded-lg p-0.5">
              {(['balance', 'name', 'code'] as const).map(field => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={cn(
                    "px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1 cursor-pointer",
                    sortBy === field ? "bg-slate-900 text-white" : "text-slate-500 hover:text-[var(--text)]"
                  )}
                >
                  <span>{field}</span>
                  {sortBy === field && (
                    sortDir === 'asc' ? <ArrowUp size={9} /> : <ArrowDown size={9} />
                  )}
                </button>
              ))}
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0 ml-2" />
          </div>
        </div>
        
        <div className="p-5 space-y-8">
          {/* Income Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-900">
              <div className="flex items-center gap-2">
                 <div className="w-1 h-3.5 bg-emerald-500 rounded-full shrink-0" />
                 <h4 className="font-bold text-[var(--text)] uppercase tracking-wider text-xs">{labels.revenueStreams}</h4>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-base font-black text-emerald-700">{formatCurrency(data.income?.total || 0)}</span>
                {isComparative && prevData.income?.total !== 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                     <span className="font-mono text-[9px] text-slate-400 font-medium">prev: {formatCurrency(prevData.income?.total)}</span>
                     <span className={cn(
                       "text-[10px] font-bold", 
                       (data.income?.total || 0) >= prevData.income?.total ? "text-emerald-500" : "text-rose-500"
                     )}>
                       {(((data.income?.total || 0) - prevData.income.total) / Math.abs(prevData.income.total) * 100).toFixed(1)}%
                     </span>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(data.income?.accounts || {})
                .sort(([idA, a]: [string, any], [idB, b]: [string, any]) => {
                  let comp = 0;
                  if (sortBy === 'code') comp = (a.code || '').localeCompare(b.code || '');
                  else if (sortBy === 'name') comp = (a.name || '').localeCompare(b.name || '');
                  else comp = (a.balance || 0) - (b.balance || 0);
                  return sortDir === 'asc' ? comp : -comp;
                })
                .map(([id, acc]: [string, any]) => {
                const prevAcc = (prevData.income?.accounts as any)[id];
                const prevBalance = prevAcc ? prevAcc.balance : 0;
                const balance = acc.balance || 0;
                const variance = isComparative && prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : null;

                return (
                  <div 
                    key={id} 
                    onClick={() => {
                      const matchedTxs = transactions.filter(t => 
                        t.date >= dateRange.start && 
                        t.date <= dateRange.end && 
                        t.lines?.some(l => l.accountId === id || l.accountName === acc.name)
                      );
                      setDrillDownTarget({
                        accountName: acc.name,
                        transactions: matchedTxs
                      });
                    }}
                    title={`Click to drill down into ${acc.name}`}
                    className="flex items-center justify-between p-3 bg-[var(--ink)]/50 rounded-lg border border-transparent hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all group gap-4 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[8px] font-bold text-slate-400 bg-[var(--ink)] px-1.5 py-0.5 rounded border border-[var(--line)] uppercase shrink-0">{acc.code}</span>
                      <span className="text-[var(--text)] font-bold group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-xs truncate flex items-center gap-1.5">
                        {acc.name}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-mono text-[var(--text)] text-xs font-semibold">{formatCurrency(balance)}</span>
                      {isComparative && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[8px] text-slate-400">prev: {formatCurrency(prevBalance)}</span>
                          {variance !== null && (
                            <span className={cn("text-[9px] font-bold", variance >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Expense Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
               <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-rose-500 rounded-full shrink-0" />
                  <h4 className="font-bold text-[var(--text)] uppercase tracking-wider text-xs">{labels.expenseClusters}</h4>
               </div>
               <div className="flex flex-col items-end">
                 <span className="font-mono text-base font-black text-rose-700">{formatCurrency(data.expense?.total || 0)}</span>
                 {isComparative && prevData.expense?.total !== 0 && (
                   <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[9px] text-slate-400 font-medium">prev: {formatCurrency(prevData.expense?.total)}</span>
                      <span className={cn(
                        "text-[10px] font-bold", 
                        (data.expense?.total || 0) <= prevData.expense?.total ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {(((data.expense?.total || 0) - prevData.expense.total) / Math.abs(prevData.expense.total) * 100).toFixed(1)}%
                      </span>
                   </div>
                 )}
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(data.expense?.accounts || {})
                .sort(([idA, a]: [string, any], [idB, b]: [string, any]) => {
                  let comp = 0;
                  if (sortBy === 'code') comp = (a.code || '').localeCompare(b.code || '');
                  else if (sortBy === 'name') comp = (a.name || '').localeCompare(b.name || '');
                  else comp = (a.balance || 0) - (b.balance || 0);
                  return sortDir === 'asc' ? comp : -comp;
                })
                .map(([id, acc]: [string, any]) => {
                const prevAcc = (prevData.expense?.accounts as any)[id];
                const prevBalance = prevAcc ? prevAcc.balance : 0;
                const balance = acc.balance || 0;
                const variance = isComparative && prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : null;

                return (
                  <div 
                    key={id} 
                    onClick={() => {
                      const matchedTxs = transactions.filter(t => 
                        t.date >= dateRange.start && 
                        t.date <= dateRange.end && 
                        t.lines?.some(l => l.accountId === id || l.accountName === acc.name)
                      );
                      setDrillDownTarget({
                        accountName: acc.name,
                        transactions: matchedTxs
                      });
                    }}
                    title={`Click to drill down into ${acc.name}`}
                    className="flex items-center justify-between p-3 bg-[var(--ink)]/50 rounded-lg border border-transparent hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all group gap-4 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[8px] font-bold text-slate-400 bg-[var(--ink)] px-1.5 py-0.5 rounded border border-[var(--line)] uppercase shrink-0">{acc.code}</span>
                      <span className="text-[var(--text)] font-bold group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-xs truncate flex items-center gap-1.5">
                        {acc.name}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-mono text-[var(--text)] text-xs font-semibold">{formatCurrency(balance)}</span>
                      {isComparative && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[8px] text-slate-400">prev: {formatCurrency(prevBalance)}</span>
                          {variance !== null && (
                            <span className={cn("text-[9px] font-bold", variance <= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Net Income Cluster */}
          <div className="mt-6 p-4 bg-slate-900 text-white rounded-lg border border-slate-950 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col self-start sm:self-auto">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{labels.netChangeTitle}</h4>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{labels.netSub}</p>
            </div>
            <div className="flex flex-col items-end sm:items-center sm:flex-row gap-4 text-right">
              {isComparative && prevData.netIncome !== 0 && (
                <div className="flex flex-col sm:items-end items-end mr-4">
                  <span className="text-[9px] font-bold text-slate-400 font-medium tracking-wider mb-1">PRIOR PERIOD</span>
                  <span className="font-mono text-sm text-slate-300 line-through opacity-70">
                    {formatCurrency(prevData.netIncome)}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded", 
                    (data.netIncome || 0) >= prevData.netIncome ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                  )}>
                    {(((data.netIncome || 0) - prevData.netIncome) / Math.abs(prevData.netIncome) * 100).toFixed(1)}% vs Prior
                  </span>
                </div>
              )}
              <span className={cn(
                "text-lg font-mono font-bold tracking-tight",
                (data.netIncome || 0) >= 0 ? "text-white" : "text-rose-400"
              )}>
                {formatCurrency(data.netIncome || 0)}
              </span>
            </div>
          </div>
        </div>
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
};

export default ProfitAndLossView;
