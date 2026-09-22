import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { 
  Users, 
  Building2,
  Download, 
  Search, 
  ArrowUpDown, 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  ChevronRight,
  Zap
} from 'lucide-react';

import { toast } from 'sonner';
import { cn, formatCurrency, parseLocalDate } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';
import { Money } from '../ui/Money';
import { PartySide, PARTY_SIDE_CONFIGS } from '../../config/partySides';

interface PartyAgingSummary {
  partyId: string;
  partyName: string;
  currentCents: number;      // 0-30 days
  days31To60Cents: number;  // 31-60 days
  days61To90Cents: number;  // 61-90 days
  days90PlusCents: number;  // 90+ days
  unappliedCreditCents: number;
  totalCents: number;
  dueThisWeekCents: number;
  oldestDocDays: number;
  documents: any[];
}

interface PartyAgingReportViewProps {
  side: PartySide;
}

export default function PartyAgingReportView({ side }: PartyAgingReportViewProps) {
  const config = PARTY_SIDE_CONFIGS[side];
  const invoices = useLedgerStore(s => s.invoices);
  const bills = useLedgerStore(s => s.bills);
  const creditNotes = useLedgerStore(s => s.creditNotes || []);
  const vendorCredits = useLedgerStore(s => s.vendorCredits || []);
  const customers = useLedgerStore(s => s.customers);
  const vendors = useLedgerStore(s => s.vendors);
  const isDataTruncated = useLedgerStore(s => (s.isDataTruncated || s.truncatedCollections?.[side === 'customer' ? 'invoices' : 'bills']));

  const [searchTerm, setSearchTerm] = useState('');
  const [payThisWeekOnly, setPayThisWeekOnly] = useState(false);
  const [sortField, setSortField] = useState<'partyName' | 'totalCents' | 'days90PlusCents' | 'dueThisWeekCents'>('totalCents');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedParty, setSelectedParty] = useState<PartyAgingSummary | null>(null);

  const asOfDate = useMemo(() => new Date(), []);
  const nextWeekDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const agingData = useMemo(() => {
    const partyMap = new Map<string, PartyAgingSummary>();

    if (side === 'customer') {
      customers.forEach(c => {
        partyMap.set(c.id, {
          partyId: c.id,
          partyName: c.name || 'Unnamed Customer',
          currentCents: 0,
          days31To60Cents: 0,
          days61To90Cents: 0,
          days90PlusCents: 0,
          unappliedCreditCents: 0,
          totalCents: 0,
          dueThisWeekCents: 0,
          oldestDocDays: 0,
          documents: []
        });
      });

      const openInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'rejected' && inv.status !== 'void');

      openInvoices.forEach(inv => {
        const pId = inv.customerId || 'unknown';
        const pName = inv.customerName || customers.find(c => c.id === pId)?.name || 'Unassigned Customer';

        if (!partyMap.has(pId)) {
          partyMap.set(pId, {
            partyId: pId,
            partyName: pName,
            currentCents: 0,
            days31To60Cents: 0,
            days61To90Cents: 0,
            days90PlusCents: 0,
            unappliedCreditCents: 0,
            totalCents: 0,
            dueThisWeekCents: 0,
            oldestDocDays: 0,
            documents: []
          });
        }

        const summary = partyMap.get(pId)!;
        summary.documents.push(inv);

        const amt = inv.amountCents || 0;
        const dueDate = inv.dueDate ? parseLocalDate(inv.dueDate) : (inv.date ? parseLocalDate(inv.date) : asOfDate);
        const diffTime = asOfDate.getTime() - dueDate.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        if (daysOverdue > summary.oldestDocDays) {
          summary.oldestDocDays = daysOverdue;
        }

        summary.totalCents += amt;
        if (dueDate <= nextWeekDate) {
          summary.dueThisWeekCents += amt;
        }

        if (daysOverdue <= 30) summary.currentCents += amt;
        else if (daysOverdue <= 60) summary.days31To60Cents += amt;
        else if (daysOverdue <= 90) summary.days61To90Cents += amt;
        else summary.days90PlusCents += amt;
      });

      const openCreditNotes = creditNotes.filter(cn => cn.status === 'open' || cn.status === 'partially_applied');
      openCreditNotes.forEach(cn => {
        const pId = cn.customerId || 'unknown';
        if (partyMap.has(pId)) {
          const summary = partyMap.get(pId)!;
          const unapplied = cn.remainingCents ?? cn.amountCents ?? 0;
          summary.unappliedCreditCents += unapplied;
          summary.totalCents -= unapplied;
        }
      });
    } else {
      vendors.forEach(v => {
        partyMap.set(v.id, {
          partyId: v.id,
          partyName: v.name || 'Unnamed Vendor',
          currentCents: 0,
          days31To60Cents: 0,
          days61To90Cents: 0,
          days90PlusCents: 0,
          unappliedCreditCents: 0,
          totalCents: 0,
          dueThisWeekCents: 0,
          oldestDocDays: 0,
          documents: []
        });
      });

      const openBills = bills.filter(b => b.status !== 'paid' && b.status !== 'void');

      openBills.forEach(bill => {
        const vId = bill.vendorId || 'unknown';
        const vName = bill.vendorName || vendors.find(v => v.id === vId)?.name || 'Unassigned Vendor';

        if (!partyMap.has(vId)) {
          partyMap.set(vId, {
            partyId: vId,
            partyName: vName,
            currentCents: 0,
            days31To60Cents: 0,
            days61To90Cents: 0,
            days90PlusCents: 0,
            unappliedCreditCents: 0,
            totalCents: 0,
            dueThisWeekCents: 0,
            oldestDocDays: 0,
            documents: []
          });
        }

        const summary = partyMap.get(vId)!;
        summary.documents.push(bill);

        const amt = bill.amountCents || 0;
        const dueDate = bill.dueDate ? parseLocalDate(bill.dueDate) : (bill.date ? parseLocalDate(bill.date) : asOfDate);
        const diffTime = asOfDate.getTime() - dueDate.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        if (daysOverdue > summary.oldestDocDays) {
          summary.oldestDocDays = daysOverdue;
        }

        summary.totalCents += amt;
        if (dueDate <= nextWeekDate) {
          summary.dueThisWeekCents += amt;
        }

        if (daysOverdue <= 30) summary.currentCents += amt;
        else if (daysOverdue <= 60) summary.days31To60Cents += amt;
        else if (daysOverdue <= 90) summary.days61To90Cents += amt;
        else summary.days90PlusCents += amt;
      });

      const openVendorCredits = vendorCredits.filter(vc => vc.status === 'open' || vc.status === 'partially_applied');
      openVendorCredits.forEach(vc => {
        const vId = vc.vendorId || 'unknown';
        if (partyMap.has(vId)) {
          const summary = partyMap.get(vId)!;
          const unapplied = vc.remainingCents ?? vc.amountCents ?? 0;
          summary.unappliedCreditCents += unapplied;
          summary.totalCents -= unapplied;
        }
      });
    }

    return Array.from(partyMap.values()).filter(p => p.totalCents !== 0 || p.unappliedCreditCents > 0 || p.documents.length > 0);
  }, [side, invoices, bills, creditNotes, vendorCredits, customers, vendors, asOfDate, nextWeekDate]);

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

  const filteredData = useMemo(() => {
    const list = agingData.filter(item => {
      const matchesSearch = item.partyName.toLowerCase().includes(searchTerm.toLowerCase());
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
      { header: `${config.partySingular} Name`, key: 'partyName', width: 30 },
      { header: 'Current (0-30d)', key: 'current', width: 20 },
      { header: '31-60 Days', key: 'days31To60', width: 20 },
      { header: '61-90 Days', key: 'days61To90', width: 20 },
      { header: '90+ Days', key: 'days90Plus', width: 20 },
      { header: 'Due This Week', key: 'dueThisWeek', width: 20 },
      { header: 'Total Due', key: 'total', width: 20 },
    ];

    const rows = filteredData.map(p => ({
      partyName: p.partyName,
      current: (p.currentCents / 100).toFixed(2),
      days31To60: (p.days31To60Cents / 100).toFixed(2),
      days61To90: (p.days61To90Cents / 100).toFixed(2),
      days90Plus: (p.days90PlusCents / 100).toFixed(2),
      dueThisWeek: (p.dueThisWeekCents / 100).toFixed(2),
      total: (p.totalCents / 100).toFixed(2)
    }));

    rows.push({
      partyName: `TOTAL ${config.agingAccountLabel.toUpperCase()}`,
      current: (overallTotals.current / 100).toFixed(2),
      days31To60: (overallTotals.days31To60 / 100).toFixed(2),
      days61To90: (overallTotals.days61To90 / 100).toFixed(2),
      days90Plus: (overallTotals.days90Plus / 100).toFixed(2),
      dueThisWeek: (overallTotals.dueThisWeek / 100).toFixed(2),
      total: (overallTotals.total / 100).toFixed(2)
    });

    await exportToExcel(columns, rows, {
      sheetName: `${config.side.toUpperCase()} Aging Summary`,
      fileName: `${config.exportPrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`
    });
    
    toast.success(`${config.agingAccountLabel} report exported successfully`);
  };

  const HeaderIcon = side === 'customer' ? Users : Building2;

  return (
    <div className="space-y-6">
      {isDataTruncated && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            Data Truncation Warning: The dataset has exceeded the active query limit (2,000 records). Aging totals and obligations may reflect partial ledger history.
          </span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[var(--color-ledger-line)] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <HeaderIcon className="w-5 h-5 text-indigo-600" />
            {config.agingAccountLabel} Aging Summary
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track {side === 'customer' ? 'unpaid customer receivables' : 'vendor obligations'} categorized by days past due date.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {side === 'vendor' && (
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
          )}

          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder={`Search ${config.partySingular.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
            aria-label="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Aging KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {side === 'vendor' ? (
          <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl shadow-3xs">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-600" /> Due This Week
            </span>
            <p className="text-lg font-bold font-mono text-amber-900 mt-1 tabular-nums">
              <Money cents={overallTotals.dueThisWeek} />
            </p>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current (0-30d)</span>
            <p className="text-lg font-bold font-mono text-emerald-600 mt-1 tabular-nums">
              <Money cents={overallTotals.current} />
            </p>
          </div>
        )}

        {side === 'vendor' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current (0-30d)</span>
            <p className="text-lg font-bold font-mono text-slate-900 mt-1 tabular-nums">
              <Money cents={overallTotals.current} />
            </p>
          </div>
        )}

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
                  onClick={() => handleSort('partyName')}
                  className="py-3.5 px-5 cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{config.partySingular}</span>
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
                {side === 'vendor' && (
                  <th 
                    onClick={() => handleSort('dueThisWeekCents')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors bg-amber-50/50"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Due This Week</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
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
                  key={item.partyId}
                  onClick={() => setSelectedParty(item)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 px-5 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{item.partyName}</span>
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
                  {side === 'vendor' && (
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-800 bg-amber-50/30 tabular-nums">
                      {item.dueThisWeekCents > 0 ? <Money cents={item.dueThisWeekCents} /> : '-'}
                    </td>
                  )}
                  <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                    <Money cents={item.totalCents} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedParty(item); }}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 group-hover:text-slate-700 transition-colors"
                      title={`View ${config.documentPlural.toLowerCase()} breakdown`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={side === 'vendor' ? 8 : 7} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-slate-700">No Outstanding Balances</p>
                    <p className="text-xs text-slate-400 mt-0.5">All {config.documentPlural.toLowerCase()} are settled up to date.</p>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-900">
                  <td className="py-4 px-5 uppercase tracking-wider text-[11px]">Total {config.agingAccountLabel}</td>
                  <td className="py-4 px-4 text-right font-mono tabular-nums"><Money cents={overallTotals.current} /></td>
                  <td className="py-4 px-4 text-right font-mono text-amber-300 tabular-nums"><Money cents={overallTotals.days31To60} /></td>
                  <td className="py-4 px-4 text-right font-mono text-orange-300 tabular-nums"><Money cents={overallTotals.days61To90} /></td>
                  <td className="py-4 px-4 text-right font-mono text-rose-300 tabular-nums"><Money cents={overallTotals.days90Plus} /></td>
                  {side === 'vendor' && (
                    <td className="py-4 px-4 text-right font-mono text-amber-300 bg-slate-800 tabular-nums"><Money cents={overallTotals.dueThisWeek} /></td>
                  )}
                  <td className="py-4 px-5 text-right font-mono text-white text-sm tabular-nums"><Money cents={overallTotals.total} /></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Party Documents Detail Modal */}
      {selectedParty && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{selectedParty.partyName}</h3>
                <p className="text-xs text-slate-500">Unpaid & Open {config.documentPlural} Breakdown</p>
              </div>
              <button 
                onClick={() => setSelectedParty(null)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 space-y-2">
              {selectedParty.documents.map(doc => {
                const dueDate = doc.dueDate ? parseLocalDate(doc.dueDate) : (doc.date ? parseLocalDate(doc.date) : asOfDate);
                const diffTime = asOfDate.getTime() - dueDate.getTime();
                const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

                return (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono font-bold text-xs text-slate-900">{doc.number || 'DOC-UNASSIGNED'}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3" /> Due: {doc.dueDate || doc.date || 'N/A'}
                        <span className={cn(
                          "px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase",
                          daysOverdue > 60 ? "bg-rose-100 text-rose-700" : daysOverdue > 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {daysOverdue > 0 ? `${daysOverdue}d overdue` : 'Current'}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-slate-900 tabular-nums"><Money cents={doc.amountCents || 0} /></p>
                      <span className="text-[10px] font-semibold text-slate-400 capitalize">{doc.status}</span>
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
