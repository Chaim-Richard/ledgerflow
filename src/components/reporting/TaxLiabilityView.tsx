import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { computeTaxLiability } from '../../server/reports/computeReports';
import { Receipt, DollarSign, Calculator, Download } from 'lucide-react';

export default function TaxLiabilityView() {
  const invoices = useLedgerStore(s => s.invoices);
  const bills = useLedgerStore(s => s.bills);

  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(getLocalDateISO());

  const taxData = useMemo(() => {
    return computeTaxLiability(invoices, bills, startDate, endDate);
  }, [invoices, bills, startDate, endDate]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sales Tax Liability Report</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Output sales tax collected vs. Input purchase tax paid to determine net tax due
            </p>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold uppercase">
            <span>Sales Tax Collected (Output Tax)</span>
            <span className="p-1 rounded bg-emerald-500/10 text-emerald-600">Invoices</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(taxData.taxCollectedCents)}
          </div>
          <p className="text-xs text-slate-400">
            From {formatCurrency(taxData.taxableSalesCents)} in net taxable sales
          </p>
        </div>

        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold uppercase">
            <span>Purchase Tax Paid (Input Tax)</span>
            <span className="p-1 rounded bg-blue-500/10 text-blue-600">Bills</span>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {formatCurrency(taxData.taxPaidCents)}
          </div>
          <p className="text-xs text-slate-400">
            From {formatCurrency(taxData.taxablePurchasesCents)} in net taxable purchases
          </p>
        </div>

        <div className="p-6 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/50 shadow-2xs space-y-2">
          <div className="flex justify-between items-center text-xs text-amber-700 dark:text-amber-400 font-bold uppercase">
            <span>Net Tax Liability Payable</span>
            <Calculator className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black font-mono text-amber-700 dark:text-amber-300">
            {formatCurrency(taxData.netTaxLiabilityCents)}
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
            {taxData.netTaxLiabilityCents >= 0 ? 'Amount payable to tax authority' : 'Tax refund / credit due'}
          </p>
        </div>
      </div>
    </div>
  );
}
