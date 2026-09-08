import React, { useState, useMemo } from 'react';
import { ChartAccount } from '../../types';
import { format, subMonths, endOfMonth, endOfQuarter, subQuarters, subYears, endOfYear } from 'date-fns';
import { 
  Scale, CheckCircle2, AlertCircle, Activity, 
  ArrowUpDown, ArrowUp, ArrowDown, Download, 
  Calendar, FileSpreadsheet, RefreshCw 
} from 'lucide-react';
import { formatDecimal, sanitizeCsvCell, cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { isPostable, lineAmount, isTransactionInDateRange } from '../../lib/txFilters';

interface TrialBalanceViewProps {
  accounts: ChartAccount[];
  formatCurrency: (val: number) => string;
  onDrillDown: (accountId: string) => void;
}

type SortField = 'code' | 'name' | 'type' | 'debit' | 'credit';
type SortDir = 'asc' | 'desc';

export default function TrialBalanceView({ accounts, formatCurrency, onDrillDown }: TrialBalanceViewProps) {
  const transactions = useLedgerStore(s => s.transactions || []);
  
  const [asOfDate, setAsOfDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const setPresetDate = (preset: 'today' | 'last_month' | 'last_quarter' | 'last_year') => {
    const now = new Date();
    if (preset === 'today') {
      setAsOfDate(format(now, 'yyyy-MM-dd'));
    } else if (preset === 'last_month') {
      setAsOfDate(format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'));
    } else if (preset === 'last_quarter') {
      setAsOfDate(format(endOfQuarter(subQuarters(now, 1)), 'yyyy-MM-dd'));
    } else if (preset === 'last_year') {
      setAsOfDate(format(endOfYear(subYears(now, 1)), 'yyyy-MM-dd'));
    }
  };

  // Compute live, accurate balances as of the chosen asOfDate
  const trialBalance = useMemo(() => {
    // 1. Build map of accounts for O(1) lookups
    const accountById = new Map(accounts.map(a => [a.id, a]));
    const accountByName = new Map(accounts.map(a => [a.name, a]));

    // 2. Calculate running balances per account up to asOfDate
    const accountTotals: Record<string, { debitCents: number; creditCents: number; netSigned: number }> = {};
    
    // Initialize with opening balances
    accounts.forEach(acc => {
      const isDebitNature = ['asset', 'expense', 'cost_of_goods'].includes(acc.type);
      const opening = acc.openingBalanceCents || 0;
      accountTotals[acc.id] = {
        debitCents: isDebitNature && opening > 0 ? opening : (!isDebitNature && opening < 0 ? Math.abs(opening) : 0),
        creditCents: !isDebitNature && opening > 0 ? opening : (isDebitNature && opening < 0 ? Math.abs(opening) : 0),
        netSigned: opening
      };
    });

    // Accumulate standard transactions
    transactions.forEach(tx => {
      if (!isPostable(tx) || !isTransactionInDateRange(tx, undefined, asOfDate)) return;
      tx.lines?.forEach(line => {
        const acc = accountById.get(line.accountId) || accountByName.get(line.accountName || '');
        if (!acc) return;
        
        if (!accountTotals[acc.id]) {
          accountTotals[acc.id] = { debitCents: 0, creditCents: 0, netSigned: 0 };
        }
        
        const isDebitNature = ['asset', 'expense', 'cost_of_goods'].includes(acc.type);
        const amount = lineAmount(line, tx);
        
        // In standard double-entry journal/tx lines:
        // Positive is debit, negative is credit (or vice versa depending on nature)
        if (amount > 0) {
          accountTotals[acc.id].debitCents += amount;
        } else {
          accountTotals[acc.id].creditCents += Math.abs(amount);
        }
        accountTotals[acc.id].netSigned += (isDebitNature ? amount : -amount);
      });
    });

    const lines = accounts.map(acc => {
      const isDebitNature = ['asset', 'expense', 'cost_of_goods'].includes(acc.type);
      const totals = accountTotals[acc.id];
      
      let debit = 0;
      let credit = 0;

      if (totals) {
        // Compute net column placement
        const net = totals.debitCents - totals.creditCents;
        if (isDebitNature) {
          if (net >= 0) debit = net;
          else credit = Math.abs(net);
        } else {
          const netCredit = totals.creditCents - totals.debitCents;
          if (netCredit >= 0) credit = netCredit;
          else debit = Math.abs(netCredit);
        }
      } else {
        // Fallback to stored/computed balanceCents if no transaction lines matched
        const bal = acc.balanceCents || 0;
        if (isDebitNature) {
          if (bal >= 0) debit = bal;
          else credit = Math.abs(bal);
        } else {
          if (bal >= 0) credit = bal;
          else debit = Math.abs(bal);
        }
      }

      return {
        ...acc,
        debit,
        credit,
        netBalance: isDebitNature ? (debit - credit) : (credit - debit)
      };
    });

    const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

    // Apply Sorting
    lines.sort((a, b) => {
      let comp = 0;
      if (sortField === 'code') comp = (a.code || '').localeCompare(b.code || '');
      else if (sortField === 'name') comp = (a.name || '').localeCompare(b.name || '');
      else if (sortField === 'type') comp = (a.type || '').localeCompare(b.type || '');
      else if (sortField === 'debit') comp = a.debit - b.debit;
      else if (sortField === 'credit') comp = a.credit - b.credit;

      return sortDir === 'asc' ? comp : -comp;
    });

    const isBalanced = Math.abs(totalDebits - totalCredits) < 1; // within 1 cent tolerance

    return { lines, totalDebits, totalCredits, isBalanced };
  }, [accounts, transactions, asOfDate, sortField, sortDir]);

  const handleExportCSV = () => {
    const headers = ['Account Code', 'Account Name', 'Classification', 'Debit ($)', 'Credit ($)'];
    const rows = trialBalance.lines.map(line => [
      sanitizeCsvCell(line.code || ''),
      sanitizeCsvCell(line.name || ''),
      sanitizeCsvCell(line.type || ''),
      formatDecimal(line.debit),
      formatDecimal(line.credit)
    ]);
    rows.push([
      sanitizeCsvCell('TOTAL'),
      '',
      '',
      formatDecimal(trialBalance.totalDebits),
      formatDecimal(trialBalance.totalCredits)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trial_balance_as_of_${asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Trial Balance');

    worksheet.columns = [
      { header: 'Account Code', key: 'code', width: 15 },
      { header: 'Account Name', key: 'name', width: 35 },
      { header: 'Classification', key: 'type', width: 18 },
      { header: 'Debit ($)', key: 'debit', width: 16 },
      { header: 'Credit ($)', key: 'credit', width: 16 },
    ];

    trialBalance.lines.forEach(line => {
      worksheet.addRow({
        code: line.code || '',
        name: line.name || '',
        type: line.type || '',
        debit: line.debit / 100,
        credit: line.credit / 100
      });
    });

    worksheet.addRow({
      code: 'TOTAL',
      name: '',
      type: '',
      debit: trialBalance.totalDebits / 100,
      credit: trialBalance.totalCredits / 100
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trial_balance_as_of_${asOfDate}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={11} className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-emerald-400" /> : <ArrowDown size={11} className="text-emerald-400" />;
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/80 shadow-3xs overflow-hidden relative group">
      <div className="absolute technical-grid inset-0 opacity-[0.015] pointer-events-none" />
      
      {/* Header & Controls */}
      <div className="p-5 border-b border-[var(--line)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate mb-1">
             <Scale size={12} className="shrink-0" />
             Double-Entry Stability Protocol
          </div>
          <h3 className="text-xl font-bold text-[var(--text)] tracking-tight">Trial Balance</h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 bg-[var(--ink)] px-2.5 py-1 rounded-lg border border-[var(--line)]">
              <Calendar size={13} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">As of:</span>
              <input 
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-[var(--text)] focus:outline-none cursor-pointer"
              />
            </div>
            
            {/* Quick Presets */}
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase">
              <button 
                onClick={() => setPresetDate('today')}
                className="px-2 py-1 bg-[var(--ink)] hover:bg-[var(--line)] text-slate-400 hover:text-[var(--text)] rounded border border-[var(--line)] transition-colors"
              >
                Today
              </button>
              <button 
                onClick={() => setPresetDate('last_month')}
                className="px-2 py-1 bg-[var(--ink)] hover:bg-[var(--line)] text-slate-400 hover:text-[var(--text)] rounded border border-[var(--line)] transition-colors"
              >
                Last Month
              </button>
              <button 
                onClick={() => setPresetDate('last_quarter')}
                className="px-2 py-1 bg-[var(--ink)] hover:bg-[var(--line)] text-slate-400 hover:text-[var(--text)] rounded border border-[var(--line)] transition-colors"
              >
                Last Qtr
              </button>
              <button 
                onClick={() => setPresetDate('last_year')}
                className="px-2 py-1 bg-[var(--ink)] hover:bg-[var(--line)] text-slate-400 hover:text-[var(--text)] rounded border border-[var(--line)] transition-colors"
              >
                Last Year
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Debits</p>
            <p className="text-base font-bold font-mono text-[var(--text)]">{formatCurrency(trialBalance.totalDebits)}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Credits</p>
            <p className="text-base font-bold font-mono text-[var(--text)]">{formatCurrency(trialBalance.totalCredits)}</p>
          </div>
          <motion.div 
            animate={trialBalance.isBalanced ? {} : { x: [0, -4, 4, -4, 4, 0] }}
            className={cn(
              "px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider border shadow-3xs transition-all w-full sm:w-auto",
              trialBalance.isBalanced 
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                : "bg-rose-500 text-white border-rose-400"
            )}
          >
            {trialBalance.isBalanced ? <CheckCircle2 size={12} className="shrink-0 text-emerald-500" /> : <AlertCircle size={12} className="shrink-0" />}
            {trialBalance.isBalanced ? "Balanced Double-Entry" : "System Imbalance"}
          </motion.div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="px-5 py-2.5 bg-[var(--ink)]/40 border-b border-[var(--line)] flex items-center justify-between gap-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {trialBalance.lines.length} Active Ledger Accounts
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] rounded-lg text-[9px] font-bold uppercase tracking-wider hover:text-[var(--text)] transition-all cursor-pointer"
           aria-label="CSV">
            <Download size={11} /> CSV
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600/10 text-emerald-600 border border-emerald-500/30 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-600/20 transition-all cursor-pointer"
           aria-label="Excel">
            <FileSpreadsheet size={11} /> Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto relative z-10 custom-scrollbar">
        <table className="w-full text-left min-w-[700px] text-xs">
          <thead>
            <tr className="bg-slate-900 text-white whitespace-nowrap select-none">
              <th 
                onClick={() => handleSort('code')}
                className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>Account Code</span>
                  {renderSortIcon('code')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('name')}
                className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>Account Name & Classification</span>
                  {renderSortIcon('name')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('debit')}
                className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  <span>Debit Balance</span>
                  {renderSortIcon('debit')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('credit')}
                className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  <span>Credit Balance</span>
                  {renderSortIcon('credit')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trialBalance.lines.map((line) => (
              <motion.tr 
                key={line.id} 
                whileHover={{ backgroundColor: "var(--ink)" }}
                onClick={() => onDrillDown(line.id)}
                className="group/row cursor-pointer transition-colors"
              >
                <td className="px-5 py-3 font-mono">
                  <span className="font-mono text-[9px] font-bold text-slate-400 bg-[var(--ink)] px-2 py-0.5 rounded border border-[var(--line)]">
                    {line.code || '—'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div>
                    <p className="text-xs font-bold text-[var(--text)] group-hover/row:text-indigo-600 transition-colors uppercase">
                      {line.name}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                      {line.type} Classification • {line.category || 'Standard'}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-mono text-[var(--text)] font-bold">
                  {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                </td>
                <td className="px-5 py-3 text-right font-mono text-[var(--text)] font-bold">
                  {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                </td>
              </motion.tr>
            ))}
            {trialBalance.lines.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400 text-xs">
                  No accounts found in current ledger configuration.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-slate-250">
            <tr className="bg-[var(--ink)]/50 whitespace-nowrap">
              <td colSpan={2} className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-slate-500 shrink-0" />
                  <span className="text-sm font-bold text-[var(--text)] uppercase">Total Trial Balance</span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-sm font-bold text-[var(--text)]">
                {formatCurrency(trialBalance.totalDebits)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-sm font-bold text-[var(--text)]">
                {formatCurrency(trialBalance.totalCredits)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
