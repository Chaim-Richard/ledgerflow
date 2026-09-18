import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { Bill, Vendor } from '../../types';
import { 
  Building2, 
  Download, 
  Search, 
  ArrowUpDown, 
  AlertCircle, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  ChevronRight,
  Filter,
  CreditCard,
  Zap
} from 'lucide-react';

import { toast } from 'sonner';
import { cn, formatCurrency, parseLocalDate } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';

interface VendorAgingSummary {
  vendorId: string;
  vendorName: string;
  currentCents: number;      // 0-30 days
  days31To60Cents: number;  // 31-60 days
  days61To90Cents: number;  // 61-90 days
  days90PlusCents: number;  // 90+ days
  unappliedCreditCents: number; // Open Vendor Credits
  totalCents: number;       // Net A/P Outstanding (Bills - Vendor Credits)
  dueThisWeekCents: number;
  oldestBillDays: number;
  bills: Bill[];
}

export default function APAgingReportView() {
  const bills = useLedgerStore(s => s.bills);
  const vendorCredits = useLedgerStore(s => s.vendorCredits || []);
  const vendors = useLedgerStore(s => s.vendors);
  const isDataTruncated = useLedgerStore(s => s.isDataTruncated || s.truncatedCollections?.bills);

  const [searchTerm, setSearchTerm] = useState('');
  const [payThisWeekOnly, setPayThisWeekOnly] = useState(false);
  const [sortField, setSortField] = useState<'vendorName' | 'totalCents' | 'days90PlusCents' | 'dueThisWeekCents'>('totalCents');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorAgingSummary | null>(null);

  const asOfDate = useMemo(() => new Date(), []);
  const nextWeekDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  // Compute aging buckets per vendor
  const agingData = useMemo(() => {
    const vendorMap = new Map<string, VendorAgingSummary>();

    vendors.forEach(v => {
      vendorMap.set(v.id, {
        vendorId: v.id,
        vendorName: v.name || 'Unnamed Vendor',
        currentCents: 0,
        days31To60Cents: 0,
        days61To90Cents: 0,
        days90PlusCents: 0,
        unappliedCreditCents: 0,
        totalCents: 0,
        dueThisWeekCents: 0,
        oldestBillDays: 0,
        bills: []
      });
    });

    const openBills = bills.filter(b => b.status !== 'paid' && b.status !== 'void');

    openBills.forEach(bill => {
      const vId = bill.vendorId || 'unknown';
      const vName = bill.vendorName || vendors.find(v => v.id === vId)?.name || 'Unassigned Vendor';

      if (!vendorMap.has(vId)) {
        vendorMap.set(vId, {
          vendorId: vId,
          vendorName: vName,
          currentCents: 0,
          days31To60Cents: 0,
          days61To90Cents: 0,
          days90PlusCents: 0,
          unappliedCreditCents: 0,
          totalCents: 0,
          dueThisWeekCents: 0,
          oldestBillDays: 0,
          bills: []
        });
      }

      const summary = vendorMap.get(vId)!;
      summary.bills.push(bill);

      const billAmount = bill.amountCents || 0;
      const dueDate = bill.dueDate ? parseLocalDate(bill.dueDate) : (bill.date ? parseLocalDate(bill.date) : asOfDate);
      const diffTime = asOfDate.getTime() - dueDate.getTime();
      const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      if (daysOverdue > summary.oldestBillDays) {
        summary.oldestBillDays = daysOverdue;
      }

      summary.totalCents += billAmount;

      // Check if due this week or overdue
      if (dueDate <= nextWeekDate) {
        summary.dueThisWeekCents += billAmount;
      }

      if (daysOverdue <= 30) {
        summary.currentCents += billAmount;
      } else if (daysOverdue <= 60) {
        summary.days31To60Cents += billAmount;
      } else if (daysOverdue <= 90) {
        summary.days61To90Cents += billAmount;
      } else {
        summary.days90PlusCents += billAmount;
      }
    });

    // Account for open Vendor Credits without corrupting bill aging days
    const openVendorCredits = vendorCredits.filter(vc => vc.status === 'open' || vc.status === 'partially_applied');
    openVendorCredits.forEach(vc => {
      const vId = vc.vendorId || 'unknown';
      if (vendorMap.has(vId)) {
        const summary = vendorMap.get(vId)!;
        const unapplied = vc.remainingCents ?? vc.amountCents ?? 0;
        summary.unappliedCreditCents += unapplied;
        summary.totalCents -= unapplied;
      }
    });

    return Array.from(vendorMap.values()).filter(v => v.totalCents !== 0 || v.unappliedCreditCents > 0 || v.bills.length > 0);
  }, [bills, vendors, asOfDate, nextWeekDate]);

  // Overall totals
  const overallTotals = useMemo(() => {
    return agingData.reduce((acc, curr) => ({
      current: acc.current + curr.currentCents,
      days31To60: acc.days31To60 + curr.days31To60Cents,
      days61To90: acc.days61To90 + curr.days61To90Cents,
      days90Plus: acc.days90Plus + curr.days90PlusCents,
      dueThisWeek: acc.dueThisWeek + curr.dueThisWeekCents,
      total: acc.total + curr.totalCents,
    }), { current: 0, days31To60: 0, days61To90: 0, days90Plus: 0, dueThisWeek: 0, total: 0 });
  }, [agingData]);

  // Filter & Sort
  const filteredData = useMemo(() => {
    const list = agingData.filter(item => {
      const matchesSearch = item.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPayThisWeek = !payThisWeekOnly || item.dueThisWeekCents > 0;
      return matchesSearch && matchesPayThisWeek;
    });

    list.sort((a, b) => {
      const aVal: any = a[sortField];
      const bVal: any = b[sortField];
      if (typeof aVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [agingData, searchTerm, payThisWeekOnly, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExport = async () => {
    const columns = [
      { header: 'Vendor Name', key: 'vendorName', width: 30 },
      { header: 'Current (0-30d)', key: 'current', width: 20 },
      { header: '31-60 Days', key: 'days31To60', width: 20 },
      { header: '61-90 Days', key: 'days61To90', width: 20 },
      { header: '90+ Days', key: 'days90Plus', width: 20 },
      { header: 'Due This Week', key: 'dueThisWeek', width: 20 },
      { header: 'Total Due', key: 'total', width: 20 },
    ];

    const rows = filteredData.map(v => ({
      vendorName: v.vendorName,
      current: (v.currentCents / 100).toFixed(2),
      days31To60: (v.days31To60Cents / 100).toFixed(2),
      days61To90: (v.days61To90Cents / 100).toFixed(2),
      days90Plus: (v.days90PlusCents / 100).toFixed(2),
      dueThisWeek: (v.dueThisWeekCents / 100).toFixed(2),
      total: (v.totalCents / 100).toFixed(2)
    }));

    rows.push({
      vendorName: 'TOTAL ACCOUNTS PAYABLE',
      current: (overallTotals.current / 100).toFixed(2),
      days31To60: (overallTotals.days31To60 / 100).toFixed(2),
      days61To90: (overallTotals.days61To90 / 100).toFixed(2),
      days90Plus: (overallTotals.days90Plus / 100).toFixed(2),
      dueThisWeek: (overallTotals.dueThisWeek / 100).toFixed(2),
      total: (overallTotals.total / 100).toFixed(2)
    });

    await exportToExcel(columns, rows, {
      sheetName: 'AP Aging Summary',
      fileName: `AP_Aging_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
    });
    
    toast.success('A/P Aging report exported successfully');
  };

  return (
    <div className="space-y-6">
      {isDataTruncated && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            Data Truncation Warning: The dataset has exceeded the active query limit (2,000 records). Aging totals and vendor obligations may reflect partial ledger history. Please filter by a narrower window for full completeness.
          </span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[var(--color-ledger-line)] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Accounts Payable (A/P) Aging Summary
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track vendor obligations and prioritize weekly cash disbursements across aging brackets.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setPayThisWeekOnly(!payThisWeekOnly)}
            className={cn(
              "px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border",
              payThisWeekOnly 
                ? "bg-amber-500 text-white border-amber-600 shadow-xs" 
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            Pay This Week ({formatCurrency(overallTotals.dueThisWeek)})
          </button>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
           aria-label="Export CSV">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Aging KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl shadow-3xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-600" /> Due This Week
          </span>
          <p className="text-lg font-bold font-mono text-amber-900 mt-1 tabular-nums">{formatCurrency(overallTotals.dueThisWeek)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current (0-30d)</span>
          <p className="text-lg font-bold font-mono text-slate-900 mt-1 tabular-nums">{formatCurrency(overallTotals.current)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">31 - 60 Days</span>
          <p className="text-lg font-bold font-mono text-amber-600 mt-1 tabular-nums">{formatCurrency(overallTotals.days31To60)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">61 - 90 Days</span>
          <p className="text-lg font-bold font-mono text-orange-600 mt-1 tabular-nums">{formatCurrency(overallTotals.days61To90)}</p>
        </div>
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Payables</span>
          <p className="text-lg font-bold font-mono text-white mt-1 tabular-nums">{formatCurrency(overallTotals.total)}</p>
        </div>
      </div>

      {/* Main Aging Table */}
      <div className="bg-white rounded-3xl border border-[var(--color-ledger-line)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th 
                  onClick={() => handleSort('vendorName')}
                  className="py-3.5 px-5 cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Vendor</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Current (0-30d)</th>
                <th className="py-3.5 px-4 text-right">31-60 Days</th>
                <th className="py-3.5 px-4 text-right">61-90 Days</th>
                <th className="py-3.5 px-4 text-right">90+ Days</th>
                <th 
                  onClick={() => handleSort('dueThisWeekCents')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors bg-amber-50/50"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Due This Week</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('totalCents')}
                  className="py-3.5 px-5 text-right cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total Due</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map(item => (
                <tr 
                  key={item.vendorId}
                  onClick={() => setSelectedVendor(item)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 px-5 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{item.vendorName}</span>
                      {item.dueThisWeekCents > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full">Due</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                    {item.currentCents > 0 ? formatCurrency(item.currentCents) : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-amber-700 tabular-nums">
                    {item.days31To60Cents > 0 ? formatCurrency(item.days31To60Cents) : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-orange-700 tabular-nums">
                    {item.days61To90Cents > 0 ? formatCurrency(item.days61To90Cents) : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 tabular-nums">
                    {item.days90PlusCents > 0 ? formatCurrency(item.days90PlusCents) : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-800 bg-amber-50/30 tabular-nums">
                    {item.dueThisWeekCents > 0 ? formatCurrency(item.dueThisWeekCents) : '-'}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatCurrency(item.totalCents)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedVendor(item); }}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 group-hover:text-slate-700 transition-colors"
                      title="View vendor bills"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-slate-700">No Open Vendor Payables</p>
                    <p className="text-xs text-slate-400 mt-0.5">All bills have been settled or no matching items found.</p>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-900">
                  <td className="py-4 px-5 uppercase tracking-wider text-[11px]">Total Accounts Payable</td>
                  <td className="py-4 px-4 text-right font-mono tabular-nums">{formatCurrency(overallTotals.current)}</td>
                  <td className="py-4 px-4 text-right font-mono text-amber-300 tabular-nums">{formatCurrency(overallTotals.days31To60)}</td>
                  <td className="py-4 px-4 text-right font-mono text-orange-300 tabular-nums">{formatCurrency(overallTotals.days61To90)}</td>
                  <td className="py-4 px-4 text-right font-mono text-rose-300 tabular-nums">{formatCurrency(overallTotals.days90Plus)}</td>
                  <td className="py-4 px-4 text-right font-mono text-amber-300 bg-slate-800 tabular-nums">{formatCurrency(overallTotals.dueThisWeek)}</td>
                  <td className="py-4 px-5 text-right font-mono text-white text-sm tabular-nums">{formatCurrency(overallTotals.total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Vendor Bills Detail Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{selectedVendor.vendorName}</h3>
                <p className="text-xs text-slate-500">Unpaid Vendor Bills & Disbursements</p>
              </div>
              <button 
                onClick={() => setSelectedVendor(null)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 space-y-2">
              {selectedVendor.bills.map(bill => (
                <div key={bill.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono font-bold text-xs text-slate-900">{bill.number || 'BILL-UNASSIGNED'}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3 h-3" /> Due: {bill.dueDate || bill.date || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm text-slate-900 tabular-nums">{formatCurrency(bill.amountCents || 0)}</p>
                    <span className="text-[10px] font-semibold text-slate-400 capitalize">{bill.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
