import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency } from '../../lib/utils';
import { computeChartsData } from '../../lib/chartsData';
import ChartExploration from '../charts/ChartExploration';
import FinancialChartPanels from '../charts/FinancialChartPanels';
import { useAuthStore } from '../../stores/useAuthStore';
import { TrendingUp, Flame, Clock } from 'lucide-react';

export default function FinancialChartsDashboard() {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const [timeRange, setTimeRange] = useState<'6m' | '12m'>('6m');

  // Compute monthly revenue, expenses, burn rate, and profit
  // all amounts in cents of the base currency (src/lib/chartsData.ts, tested; L-155)
  const data = useMemo(() => computeChartsData(transactions, accounts, timeRange === '6m' ? 6 : 12), [transactions, accounts, timeRange]);
  const currency = useAuthStore(state => state.getCurrentWorkspace()?.currency);
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Financial Visualizer</h1>
          <p className="text-xs text-[var(--muted)] font-medium">Real-time burn rate, cash runway, income trends, and category distribution</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setTimeRange('6m')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              timeRange === '6m' ? 'bg-white text-slate-900 shadow-xs' : 'text-[var(--muted)] hover:text-slate-800'
            }`}
          >
            Last 6 Months
          </button>
          <button
            onClick={() => setTimeRange('12m')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              timeRange === '12m' ? 'bg-white text-slate-900 shadow-xs' : 'text-[var(--muted)] hover:text-slate-800'
            }`}
          >
            Last 12 Months
          </button>
        </div>
      </div>

      {/* Metric Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted)] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash Runway</span>
            <Clock size={18} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{data.runwayMonths ?? '—'}</span>
            <span className="text-xs font-semibold text-[var(--muted)]">months remaining</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2">{data.runwayMonths === null ? 'Needs a cash balance and some spending in the period' : `Based on a cash balance of ${formatCurrency(data.totalCashCents)}`}</p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted)] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Monthly Burn</span>
            <Flame size={18} className="text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(data.avgBurnCents)}</span>
            <span className="text-xs font-semibold text-[var(--muted)]">/ mo</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2">Average operating expenses over selected period</p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted)] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Profit Trend</span>
            <TrendingUp size={18} className="text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {formatCurrency(data.months.reduce((sum, m) => sum + m.profitCents, 0))}
            </span>
            <span className="text-xs font-semibold text-emerald-600">net total</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2">Cumulative net margin for period</p>
        </div>
      </div>

      <ChartExploration months={data.months.map(month => month.month)} currency={currency} />
      <FinancialChartPanels key={timeRange} data={data} currency={currency} />
    </div>
  );
}
