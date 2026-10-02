import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency } from '../../lib/utils';
import { computeChartsData } from '../../lib/chartsData';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, Legend, CartesianGrid 
} from 'recharts';
import { TrendingUp, Flame, Clock, PieChart as PieIcon, BarChart2, DollarSign } from 'lucide-react';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function FinancialChartsDashboard() {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const [timeRange, setTimeRange] = useState<'6m' | '12m'>('6m');

  // Compute monthly revenue, expenses, burn rate, and profit
  // all amounts in cents of the base currency (src/lib/chartsData.ts, tested; L-155)
  const data = useMemo(() => computeChartsData(transactions, accounts, timeRange === '6m' ? 6 : 12), [transactions, accounts, timeRange]);
  const monthlyData = data.months.map(m => ({ month: m.month, revenue: m.revenueCents, expense: m.expenseCents }));
  const money = (v: number | string | readonly (number | string)[]) => formatCurrency(Number(v));
  const empty = (text: string) => <p className="text-sm text-[var(--muted)] text-center px-6">{text}</p>;

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

      {/* Main Bar/Area Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Revenue vs Expense */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-indigo-600" />
            <span>Monthly Profitability & Mix</span>
          </h2>
          <div className="h-72 w-full">
            {monthlyData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(Number(v)).replace(/\.00$/, '')} width={80} />
                <Tooltip formatter={money} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#4f46e5" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>) : empty('No posted income or expenses in this period yet.')}
          </div>
        </div>

        {/* Burn Rate Trend Area Chart */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Flame size={16} className="text-rose-600" />
            <span>Operating Expense Burn Rate</span>
          </h2>
          <div className="h-72 w-full">
            {monthlyData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(Number(v)).replace(/\.00$/, '')} width={80} />
                <Tooltip formatter={money} />
                <Area type="monotone" dataKey="expense" fill="#fee2e2" stroke="#ef4444" strokeWidth={2} name="Monthly Burn" />
              </AreaChart>
            </ResponsiveContainer>) : empty('No posted expenses in this period yet.')}
          </div>
        </div>
      </div>

      {/* Donut Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cash Distribution Donut */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600" />
            <span>Cash Balance Allocation</span>
          </h2>
          <div className="h-64 w-full flex items-center justify-center">
            {data.cash.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.cash} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="cents" nameKey="name">
                  {data.cash.map((entry, index) => (
                    <Cell key={entry.id} fill={COLORS[index % COLORS.length]} aria-label={`${entry.name}: ${formatCurrency(entry.cents)}`} />
                  ))}
                </Pie>
                <Tooltip formatter={money} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>) : empty('No cash or bank account has a positive balance yet.')}
          </div>
        </div>

        {/* Category Expense Donut */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PieIcon size={16} className="text-amber-600" />
            <span>Expense Category Mix</span>
          </h2>
          <div className="h-64 w-full flex items-center justify-center">
            {data.expenses.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.expenses} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="cents" nameKey="name">
                  {data.expenses.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} aria-label={`${entry.name}: ${formatCurrency(entry.cents)}`} />
                  ))}
                </Pie>
                <Tooltip formatter={money} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>) : empty('No posted expenses in this period yet.')}
          </div>
        </div>
      </div>
    </div>
  );
}
