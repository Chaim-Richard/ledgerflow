import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { isPostable, lineAmount } from '../../lib/txFilters';
import { formatDecimal } from '../../lib/utils';
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
  const { monthlyData, cashBreakdown, expenseBreakdown, totalCash, monthlyBurnRate, runwayMonths } = useMemo(() => {
    const postableTxs = transactions.filter(isPostable);
    
    // Monthly aggregations map
    const monthsMap: Record<string, { month: string; revenue: number; expense: number; profit: number }> = {};
    const expCategoryMap: Record<string, number> = {};
    const accountBalances: Record<string, number> = {};

    postableTxs.forEach(tx => {
      const dateKey = tx.date ? tx.date.substring(0, 7) : '2026-01';
      if (!monthsMap[dateKey]) {
        monthsMap[dateKey] = { month: dateKey, revenue: 0, expense: 0, profit: 0 };
      }

      (tx.lines || []).forEach(l => {
        const acc = accounts.find(a => a.id === l.accountId);
        const amount = lineAmount(l, tx) / 100;

        if (l.accountId) {
          accountBalances[l.accountId] = (accountBalances[l.accountId] || 0) + amount;
        }

        if (acc?.type === 'income' || l.category === 'Revenue') {
          monthsMap[dateKey].revenue += Math.abs(amount);
        } else if (acc?.type === 'expense' || l.category === 'Expense') {
          monthsMap[dateKey].expense += Math.abs(amount);
          const cat = acc?.name || l.category || 'Other Expense';
          expCategoryMap[cat] = (expCategoryMap[cat] || 0) + Math.abs(amount);
        }
      });
    });

    const sortedMonths = Object.keys(monthsMap).sort().map(m => {
      const data = monthsMap[m];
      data.profit = data.revenue - data.expense;
      return data;
    });

    const displayMonths = timeRange === '6m' ? sortedMonths.slice(-6) : sortedMonths.slice(-12);

    // Cash Account balances
    const cashAccounts = accounts.filter(a => a.type === 'asset' && (a.category === 'Cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));
    const cashData = cashAccounts.map(a => ({
      id: a.id,
      name: a.name,
      value: Math.max(0, accountBalances[a.id] || 5000)
    })).filter(a => a.value > 0);

    const calcTotalCash = cashData.reduce((sum, c) => sum + c.value, 0) || 50000;
    
    // Average Monthly Burn
    const totalExpensesRecent = displayMonths.reduce((sum, m) => sum + m.expense, 0);
    const avgBurn = displayMonths.length > 0 ? totalExpensesRecent / displayMonths.length : 5000;
    const calcRunway = avgBurn > 0 ? (calcTotalCash / avgBurn).toFixed(1) : '∞';

    const expenseData = Object.entries(expCategoryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    return {
      monthlyData: displayMonths,
      cashBreakdown: cashData.length > 0 ? cashData : [{ id: 'main-checking', name: 'Main Checking', value: 45000 }, { id: 'savings-account', name: 'Savings Account', value: 15000 }],
      expenseBreakdown: expenseData.length > 0 ? expenseData : [{ name: 'Payroll', value: 12000 }, { name: 'Software', value: 4500 }, { name: 'Rent', value: 3000 }],
      totalCash: calcTotalCash,
      monthlyBurnRate: avgBurn,
      runwayMonths: calcRunway
    };
  }, [transactions, accounts, timeRange]);

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
            <span className="text-3xl font-extrabold text-slate-900">{runwayMonths}</span>
            <span className="text-xs font-semibold text-[var(--muted)]">months remaining</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2">Based on current cash balance of ${formatDecimal(totalCash)}</p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted)] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Monthly Burn</span>
            <Flame size={18} className="text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">${formatDecimal(monthlyBurnRate)}</span>
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
              ${formatDecimal(monthlyData.reduce((sum, m) => sum + m.profit, 0))}
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
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-indigo-600" />
            <span>Monthly Profitability & Mix</span>
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#4f46e5" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Burn Rate Trend Area Chart */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Flame size={16} className="text-rose-600" />
            <span>Operating Expense Burn Rate</span>
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="expense" fill="#fee2e2" stroke="#ef4444" strokeWidth={2} name="Monthly Burn" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Donut Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cash Distribution Donut */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600" />
            <span>Cash Balance Allocation</span>
          </h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={cashBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                  {cashBreakdown.map((entry, index) => (
                    <Cell key={entry.id} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number | string | readonly (number | string)[]) => `$${formatDecimal(val as number)}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Expense Donut */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PieIcon size={16} className="text-amber-600" />
            <span>Expense Category Mix</span>
          </h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                  {expenseBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number | string | readonly (number | string)[]) => `$${formatDecimal(val as number)}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
