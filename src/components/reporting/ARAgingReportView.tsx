import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { Invoice, Customer } from '../../types';
import { 
  Users, 
  Download, 
  Search, 
  ArrowUpDown, 
  AlertCircle, 
  Clock, 
  Calendar, 
  FileSpreadsheet, 
  ChevronRight,
  Filter,
  CheckCircle2
} from 'lucide-react';

import { toast } from 'sonner';
import { cn, formatCurrency, parseLocalDate } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';
import DrillDownModal from '../layout/DrillDownModal';
import { Money } from '../ui/Money';

interface CustomerAgingSummary {
  customerId: string;
  customerName: string;
  currentCents: number;      // 0-30 days
  days31To60Cents: number;  // 31-60 days
  days61To90Cents: number;  // 61-90 days
  days90PlusCents: number;  // 90+ days
  unappliedCreditCents: number; // Open Credit Notes
  totalCents: number;       // Net A/R Outstanding (Invoices - Unapplied Credit Notes)
  oldestInvoiceDays: number;
  invoices: Invoice[];
}

export default function ARAgingReportView() {
  const invoices = useLedgerStore(s => s.invoices);
  const creditNotes = useLedgerStore(s => s.creditNotes || []);
  const customers = useLedgerStore(s => s.customers);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'customerName' | 'totalCents' | 'days90PlusCents' | 'oldestInvoiceDays'>('totalCents');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAgingSummary | null>(null);
  const [drillDownAccount, setDrillDownAccount] = useState<string | null>(null);

  const asOfDate = useMemo(() => new Date(), []);

  // Compute aging buckets per customer
  const agingData = useMemo(() => {
    const customerMap = new Map<string, CustomerAgingSummary>();

    // Initialize all customers or just ones with invoices
    customers.forEach(c => {
      customerMap.set(c.id, {
        customerId: c.id,
        customerName: c.name || 'Unnamed Customer',
        currentCents: 0,
        days31To60Cents: 0,
        days61To90Cents: 0,
        days90PlusCents: 0,
        unappliedCreditCents: 0,
        totalCents: 0,
        oldestInvoiceDays: 0,
        invoices: []
      });
    });

    const openInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'rejected');

    openInvoices.forEach(inv => {
      const custId = inv.customerId || 'unknown';
      const custName = inv.customerName || customers.find(c => c.id === custId)?.name || 'Unassigned Customer';

      if (!customerMap.has(custId)) {
        customerMap.set(custId, {
          customerId: custId,
          customerName: custName,
          currentCents: 0,
          days31To60Cents: 0,
          days61To90Cents: 0,
          days90PlusCents: 0,
          unappliedCreditCents: 0,
          totalCents: 0,
          oldestInvoiceDays: 0,
          invoices: []
        });
      }

      const summary = customerMap.get(custId)!;
      summary.invoices.push(inv);

      const invAmount = inv.amountCents || 0;
      const dueDate = inv.dueDate ? parseLocalDate(inv.dueDate) : (inv.date ? parseLocalDate(inv.date) : asOfDate);
      const diffTime = asOfDate.getTime() - dueDate.getTime();
      const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      if (daysOverdue > summary.oldestInvoiceDays) {
        summary.oldestInvoiceDays = daysOverdue;
      }

      summary.totalCents += invAmount;

      if (daysOverdue <= 30) {
        summary.currentCents += invAmount;
      } else if (daysOverdue <= 60) {
        summary.days31To60Cents += invAmount;
      } else if (daysOverdue <= 90) {
        summary.days61To90Cents += invAmount;
      } else {
        summary.days90PlusCents += invAmount;
      }
    });

    // Account for open Customer Credit Notes without corrupting invoice aging days
    const openCreditNotes = creditNotes.filter(cn => cn.status === 'open' || cn.status === 'partially_applied');
    openCreditNotes.forEach(cn => {
      const custId = cn.customerId || 'unknown';
      if (customerMap.has(custId)) {
        const summary = customerMap.get(custId)!;
        const unapplied = cn.remainingCents ?? cn.amountCents ?? 0;
        summary.unappliedCreditCents += unapplied;
        summary.totalCents -= unapplied;
      }
    });

    // Only keep customers with outstanding balances or search matches
    return Array.from(customerMap.values()).filter(c => c.totalCents !== 0 || c.unappliedCreditCents > 0 || c.invoices.length > 0);
  }, [invoices, customers, asOfDate]);

  // Totals summary across all customers
  const overallTotals = useMemo(() => {
    return agingData.reduce((acc, curr) => ({
      current: acc.current + curr.currentCents,
      days31To60: acc.days31To60 + curr.days31To60Cents,
      days61To90: acc.days61To90 + curr.days61To90Cents,
      days90Plus: acc.days90Plus + curr.days90PlusCents,
      total: acc.total + curr.totalCents,
    }), { current: 0, days31To60: 0, days61To90: 0, days90Plus: 0, total: 0 });
  }, [agingData]);

  // Filter & Sort
  const filteredData = useMemo(() => {
    const list = agingData.filter(item => 
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    list.sort((a, b) => {
      const aVal: any = a[sortField];
      const bVal: any = b[sortField];
      if (typeof aVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [agingData, searchTerm, sortField, sortAsc]);

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
      { header: 'Customer Name', key: 'customerName', width: 30 },
      { header: 'Current (0-30d)', key: 'current', width: 20 },
      { header: '31-60 Days', key: 'days31To60', width: 20 },
      { header: '61-90 Days', key: 'days61To90', width: 20 },
      { header: '90+ Days Overdue', key: 'days90Plus', width: 20 },
      { header: 'Total Outstanding', key: 'total', width: 20 },
      { header: 'Max Days Overdue', key: 'oldestDays', width: 20 },
    ];

    const rows: Array<Record<string, any>> = filteredData.map(c => ({
      customerName: c.customerName,
      current: (c.currentCents / 100).toFixed(2),
      days31To60: (c.days31To60Cents / 100).toFixed(2),
      days61To90: (c.days61To90Cents / 100).toFixed(2),
      days90Plus: (c.days90PlusCents / 100).toFixed(2),
      total: (c.totalCents / 100).toFixed(2),
      oldestDays: c.oldestInvoiceDays
    }));

    rows.push({
      customerName: 'TOTAL ACCOUNTS RECEIVABLE',
      current: (overallTotals.current / 100).toFixed(2),
      days31To60: (overallTotals.days31To60 / 100).toFixed(2),
      days61To90: (overallTotals.days61To90 / 100).toFixed(2),
      days90Plus: (overallTotals.days90Plus / 100).toFixed(2),
      total: (overallTotals.total / 100).toFixed(2),
      oldestDays: '-'
    });

    await exportToExcel(columns, rows, {
      sheetName: 'AR Aging Summary',
      fileName: `AR_Aging_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
    });
    
    toast.success('A/R Aging report exported successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[var(--color-ledger-line)] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-600" />
            Accounts Receivable (A/R) Aging Summary
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track unpaid customer receivables categorized by days past invoice due date.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search customer..."
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
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current (0-30d)</span>
          <p className="text-lg font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            <Money cents={overallTotals.current} />
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">31 - 60 Days</span>
          <p className="text-lg font-bold font-mono text-amber-600 mt-1 tabular-nums">
            <Money cents={overallTotals.days31To60} />
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">61 - 90 Days</span>
          <p className="text-lg font-bold font-mono text-orange-600 mt-1 tabular-nums">
            <Money cents={overallTotals.days61To90} />
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">90+ Days Overdue</span>
          <p className="text-lg font-bold font-mono text-rose-600 mt-1 tabular-nums">
            <Money cents={overallTotals.days90Plus} />
          </p>
        </div>
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outstanding</span>
          <p className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
            <Money cents={overallTotals.total} />
          </p>
        </div>
      </div>

      {/* Main Aging Table */}
      <div className="bg-white rounded-3xl border border-[var(--color-ledger-line)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th 
                  onClick={() => handleSort('customerName')}
                  className="py-3.5 px-5 cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Customer</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Current (0-30d)</th>
                <th className="py-3.5 px-4 text-right">31-60 Days</th>
                <th className="py-3.5 px-4 text-right">61-90 Days</th>
                <th 
                  onClick={() => handleSort('days90PlusCents')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>90+ Days</span>
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
                  key={item.customerId}
                  onClick={() => setSelectedCustomer(item)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 px-5 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{item.customerName}</span>
                      {item.days90PlusCents > 0 && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Severe delinquency (>90 days)" />
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                    {item.currentCents > 0 ? <Money cents={item.currentCents} /> : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-amber-700 tabular-nums">
                    {item.days31To60Cents > 0 ? <Money cents={item.days31To60Cents} /> : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-orange-700 tabular-nums">
                    {item.days61To90Cents > 0 ? <Money cents={item.days61To90Cents} /> : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 tabular-nums">
                    {item.days90PlusCents > 0 ? <Money cents={item.days90PlusCents} /> : '-'}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                    <Money cents={item.totalCents} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedCustomer(item); }}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 group-hover:text-slate-700 transition-colors"
                      title="View invoices breakdown"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-slate-700">No Outstanding Receivables</p>
                    <p className="text-xs text-slate-400 mt-0.5">All customer invoices are settled up to date.</p>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-900">
                  <td className="py-4 px-5 uppercase tracking-wider text-[11px]">Total Accounts Receivable</td>
                  <td className="py-4 px-4 text-right font-mono tabular-nums"><Money cents={overallTotals.current} /></td>
                  <td className="py-4 px-4 text-right font-mono text-amber-300 tabular-nums"><Money cents={overallTotals.days31To60} /></td>
                  <td className="py-4 px-4 text-right font-mono text-orange-300 tabular-nums"><Money cents={overallTotals.days61To90} /></td>
                  <td className="py-4 px-4 text-right font-mono text-rose-300 tabular-nums"><Money cents={overallTotals.days90Plus} /></td>
                  <td className="py-4 px-5 text-right font-mono text-white text-sm tabular-nums"><Money cents={overallTotals.total} /></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Customer Invoices Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{selectedCustomer.customerName}</h3>
                <p className="text-xs text-slate-500">Unpaid & Open Invoices Breakdown</p>
              </div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 space-y-2">
              {selectedCustomer.invoices.map(inv => {
                const dueDate = inv.dueDate ? parseLocalDate(inv.dueDate) : (inv.date ? parseLocalDate(inv.date) : asOfDate);
                const diffTime = asOfDate.getTime() - dueDate.getTime();
                const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

                return (
                  <div key={inv.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono font-bold text-xs text-slate-900">{inv.number || 'INV-UNASSIGNED'}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3" /> Due: {inv.dueDate || inv.date || 'N/A'}
                        <span className={cn(
                          "px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase",
                          daysOverdue > 60 ? "bg-rose-100 text-rose-700" : daysOverdue > 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {daysOverdue > 0 ? `${daysOverdue}d overdue` : 'Current'}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-slate-900 tabular-nums"><Money cents={inv.amountCents || 0} /></p>
                      <span className="text-[10px] font-semibold text-slate-400 capitalize">{inv.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
