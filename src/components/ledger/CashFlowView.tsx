import { resolveAccountRole } from '../../lib/accountUtils';
import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { parseLocalDate, formatDecimal, formatCurrency, cn, getLocalDateISO } from '../../lib/utils';
import { isPostable, lineAmount, isTransactionInDateRange } from '../../lib/txFilters';
import { Calendar, FileSpreadsheet, Waves, SplitSquareHorizontal } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

export default function CashFlowView() {
  const transactions = useLedgerStore(s => s.transactions);
  const rawAccounts = useLedgerStore(s => s.accounts);
  const computedAccounts = useLedgerStore(s => s.computedAccounts);
  const accounts = useMemo(() => {
    return computedAccounts && computedAccounts.length > 0 ? computedAccounts : rawAccounts;
  }, [computedAccounts, rawAccounts]);

  const [dateRange, setDateRange] = useState({
    start: getLocalDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    end: getLocalDateISO()
  });
  const [isComparative, setIsComparative] = useState(false);

  const workspaces = useAuthStore(s => s.workspaces);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const businessType = currentWorkspace?.businessType || 'generic';

  const labels = useMemo(() => {
    if (businessType === 'personal') {
      return {
        title: "Statement of Cash Flows (Household)",
        operating: "Living & Household Cash Flow",
        operatingSub: "Daily living inflows & standard expenses",
        investing: "Asset Portfolio & Savings Flows",
        investingSub: "Acquisition or sale of financial assets",
        financing: "Debt & Capital Transfers",
        financingSub: "Lending, credit card repayments & mortgage servicing",
        netChange: "Household Net Cash Position Shift",
        netChangeSub: "Liquidity delta synthesis position",
        netSectionLabel: (sec: string) => `Net Household Cash from ${sec}`
      };
    } else if (businessType === 'nonprofit') {
      return {
        title: "Statement of Cash Flows (Fund)",
        operating: "Operating & Public Program Cash Flow",
        operatingSub: "Charitable grant receipts & program spending outflows",
        investing: "Charitable Capital & Program Outlays",
        investingSub: "Development of program infrastructure",
        financing: "Endowments & Borrowing",
        financingSub: "Restricted endowment funds & borrowing",
        netChange: "Net Shift in Reserve Liquidity",
        netChangeSub: "Liquidity delta synthesis position",
        netSectionLabel: (sec: string) => `Net Fund Flow from ${sec}`
      };
    } else {
      return {
        title: "Statement of Cash Flows",
        operating: "Operating Activities",
        operatingSub: "Core operational receipts & vendor disbursements",
        investing: "Investing Activities",
        investingSub: "Capital expenditure & direct asset asset acquisition",
        financing: "Financing Activities",
        financingSub: "Long-term liabilities, debt servicing & equity transactions",
        netChange: "Net Increase / Decrease in Cash",
        netChangeSub: "Liquidity delta synthesis position",
        netSectionLabel: (sec: string) => `Net Cash from ${sec}`
      };
    }
  }, [businessType]);

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

  const { currentData, prevData } = useMemo(() => {
    const calcPeriod = (start: string, end: string) => {
      const data = {
        operating: { total: 0, inflow: 0, outflow: 0 },
        investing: { total: 0, inflow: 0, outflow: 0 },
        financing: { total: 0, inflow: 0, outflow: 0 },
        netChange: 0,
      };

      const periodTxs = transactions.filter(t => isPostable(t) && isTransactionInDateRange(t, start, end));
      const cashAccounts = accounts.filter(a => resolveAccountRole(a) === 'cash' || (a.type === 'asset' && a.code?.startsWith('10')));

      periodTxs.forEach(tx => {
        const isCashTx = tx.lines?.some(l => cashAccounts.find(ca => ca.id === l.accountId));
        if (!isCashTx) return;

        // Simplify: all income/expense into Operating. Equity/Loans into Financing. Assets into Investing
        tx.lines?.forEach(line => {
          const acc = accounts.find(a => a.id === line.accountId);
          if (!acc || cashAccounts.find(ca => ca.id === acc.id)) return;

          const cents = lineAmount(line, tx);
          const absoluteAmount = Math.abs(cents);
          // If transaction increases cash, the offsetting line is negative (credit). If credit is income, it's inflow.
          const isCashInflow = cents < 0; 
          const moneyFlow = isCashInflow ? absoluteAmount : -absoluteAmount;

          const role = resolveAccountRole(acc);
          const isWorkingCapital = 
            role === 'ar' || acc.category === 'Receivables' || acc.category === 'Receivable' ||
            role === 'ap' || acc.category === 'Payables' || acc.category === 'Payable' ||
            role === 'inventory' || acc.category === 'Inventory' ||
            acc.category === 'Tax' || acc.category === 'Deposits';

          if ((acc.type === 'income' || acc.type === 'revenue') || (acc.type === 'expense' || acc.type === 'cost_of_goods') || isWorkingCapital) {
            data.operating.total += moneyFlow;
            if (isCashInflow) {
              data.operating.inflow += absoluteAmount;
            } else {
              data.operating.outflow += absoluteAmount;
            }
          } else if (acc.type === 'asset') {
            data.investing.total += moneyFlow;
            if (isCashInflow) {
              data.investing.inflow += absoluteAmount;
            } else {
              data.investing.outflow += absoluteAmount;
            }
          } else if (acc.type === 'liability' || acc.type === 'equity') {
            data.financing.total += moneyFlow;
            if (isCashInflow) {
              data.financing.inflow += absoluteAmount;
            } else {
              data.financing.outflow += absoluteAmount;
            }
          }
        });
      });

      data.netChange = data.operating.total + data.investing.total + data.financing.total;
      return data;
    };

    const currentData = calcPeriod(dateRange.start, dateRange.end);
    let prevData = {
        operating: { total: 0, inflow: 0, outflow: 0 },
        investing: { total: 0, inflow: 0, outflow: 0 },
        financing: { total: 0, inflow: 0, outflow: 0 },
        netChange: 0,
    };

    if (isComparative) {
      const prev = getPrevPeriod(dateRange.start, dateRange.end);
      prevData = calcPeriod(prev.start, prev.end);
    }

    return { currentData, prevData };
  }, [transactions, accounts, dateRange, isComparative]);

  const exportCashFlow = async () => {
    const isComp = isComparative;
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cash Flows');

    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 40 },
      { header: 'Amount ($)', key: 'amount', width: 20 },
      { header: isComp ? 'Prior Period ($)' : '', key: 'prior', width: 20 },
      { header: isComp ? 'Variance %' : '', key: 'variance', width: 15 },
    ];

    worksheet.addRow([labels.title]);
    worksheet.addRow([`Period: ${dateRange.start} to ${dateRange.end}`]);
    worksheet.addRow([]);

    worksheet.addRow({
      metric: `CASH FLOWS FROM ${labels.operating.toUpperCase()}`,
      amount: currentData.operating.total / 100,
      prior: isComp ? prevData.operating.total / 100 : null
    });
    worksheet.addRow({
      metric: `CASH FLOWS FROM ${labels.investing.toUpperCase()}`,
      amount: currentData.investing.total / 100,
      prior: isComp ? prevData.investing.total / 100 : null
    });
    worksheet.addRow({
      metric: `CASH FLOWS FROM ${labels.financing.toUpperCase()}`,
      amount: currentData.financing.total / 100,
      prior: isComp ? prevData.financing.total / 100 : null
    });

    worksheet.addRow([]);
    worksheet.addRow({
      metric: labels.netChange.toUpperCase(),
      amount: currentData.netChange / 100,
      prior: isComp ? prevData.netChange / 100 : null
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Cash_Flow_Statement_${dateRange.start}_${dateRange.end}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Date Range & Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-5 bg-[var(--surface)] border border-[var(--line)]/80 rounded-xl shadow-3xs relative overflow-hidden group gap-4">
        <div className="absolute technical-grid inset-0 opacity-[0.015] pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10 w-full lg:w-auto">
          <div className="flex items-center gap-3 w-full">
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
          onClick={exportCashFlow}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold uppercase text-[10px] tracking-wider hover:bg-slate-800 transition-all shadow-sm active:scale-95 group/btn w-full lg:w-auto cursor-pointer"
        >
          <FileSpreadsheet size={13} className="text-emerald-400 group-hover/btn:text-emerald-300 transition-colors shrink-0" />
          <span>Export Synthesis</span>
        </button>
      </div>

      <div className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/80 shadow-3xs overflow-hidden relative p-4 md:p-8">
        <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.02] pointer-events-none">
          <Waves size={160} />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto space-y-12">
           <div className="border-b border-slate-900 pb-4 flex items-end justify-between">
              <div>
                <h3 className="text-xl font-bold text-[var(--text)] tracking-tight uppercase italic">{labels.title}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">For period ending {dateRange.end}</p>
              </div>
              <Waves size={24} className="text-slate-200" />
           </div>

           <div className="space-y-8">
              {[
                  { label: labels.operating, desc: labels.operatingSub, data: currentData.operating, prev: prevData.operating },
                  { label: labels.investing, desc: labels.investingSub, data: currentData.investing, prev: prevData.investing },
                  { label: labels.financing, desc: labels.financingSub, data: currentData.financing, prev: prevData.financing }
              ].map((section, idx) => (
                  <div key={idx} className="space-y-4">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                        <h4 className="text-[11px] font-bold bg-slate-900 text-white px-3 py-1 rounded inline-flex uppercase tracking-wider">{section.label}</h4>
                        <span className="text-[9px] font-semibold text-slate-450 uppercase tracking-wider text-slate-400">{section.desc}</span>
                     </div>
                     
                     <div className="pl-4 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-slate-600 font-medium">Cash Inflows</span>
                           <span className="font-mono tabular-nums">{formatCurrency(section.data.inflow)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-slate-600 font-medium">Cash Outflows</span>
                           <span className="font-mono tabular-nums text-rose-600/80">({formatCurrency(section.data.outflow)})</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-[var(--line)] pt-2 font-bold cursor-default hover:bg-[var(--ink)] p-1 -mx-1 px-1 rounded transition-colors group">
                           <span className="text-[var(--text)] text-sm">{labels.netSectionLabel(section.label)}</span>
                           <div className="flex items-center gap-4">
                             {isComparative && section.prev.total !== 0 && (
                                <span className={cn("text-[10px] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity", section.data.total >= section.prev.total ? "text-emerald-500" : "text-rose-500")}>
                                   {(((section.data.total - section.prev.total) / Math.abs(section.prev.total)) * 100).toFixed(1)}% vs Prior
                                </span>
                             )}
                             <span className="font-mono tabular-nums text-[var(--text)]">{formatCurrency(section.data.total)}</span>
                           </div>
                        </div>
                     </div>
                  </div>
              ))}
           </div>

           <div className="mt-12 p-6 bg-slate-900 text-white rounded-xl border border-slate-950 flex justify-between items-center shadow-lg">
               <div>
                 <span className="text-[12px] font-bold text-white/40 uppercase tracking-widest block mb-1">{labels.netChange}</span>
                 <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block">{labels.netChangeSub}</span>
               </div>
               <div className="flex items-center gap-6">
                 {isComparative && prevData.netChange !== 0 && (
                    <div className="text-right">
                       <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Prior Delta</span>
                       <span className="font-mono text-sm text-slate-400">{formatCurrency(prevData.netChange)}</span>
                    </div>
                 )}
                 <span className={cn("text-3xl font-black font-mono tracking-tighter", currentData.netChange >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {formatCurrency(currentData.netChange)}
                 </span>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
}
