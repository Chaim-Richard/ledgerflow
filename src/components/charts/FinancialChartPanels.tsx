import React from 'react';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import type { ChartsData } from '../../lib/chartsData';
import { formatCurrency } from '../../lib/utils';
import ChartFrame, { ChartTooltip } from './ChartFrame';
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
export default function FinancialChartPanels({ data, currency }: { data: ChartsData; currency?: string }) {
  const months = data.months.map(row => ({ id: row.month, label: row.month, revenue: row.revenueCents, expense: row.expenseCents }));
  const tooltip = <Tooltip content={<ChartTooltip currency={currency} />} />;
  const axes = <><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis width={85} tickFormatter={amount => formatCurrency(Number(amount), currency)} /></>;
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ChartFrame title="Monthly Profitability & Mix" rows={months} time currency={currency} series={[{ key: 'revenue', name: 'Revenue' }, { key: 'expense', name: 'Expense' }]}>{({ rows, hidden }) => <ResponsiveContainer width="100%" height="100%"><BarChart data={rows}>{axes}{tooltip}<Bar dataKey="revenue" name="Revenue" fill={COLORS[0]} hide={hidden.has('revenue')} /><Bar dataKey="expense" name="Expense" fill={COLORS[3]} hide={hidden.has('expense')} /></BarChart></ResponsiveContainer>}</ChartFrame>
    <ChartFrame title="Operating Expense Burn Rate" rows={months} time currency={currency} series={[{ key: 'expense', name: 'Monthly Burn' }]}>{({ rows, hidden }) => <ResponsiveContainer width="100%" height="100%"><AreaChart data={rows}>{axes}{tooltip}<Area hide={hidden.has('expense')} dataKey="expense" name="Monthly Burn" fill="#fee2e2" stroke={COLORS[3]} /></AreaChart></ResponsiveContainer>}</ChartFrame>
    {[{ title: 'Cash Balance Allocation', rows: data.cash.map(row => ({ id: row.id, label: row.name, cents: row.cents })) }, { title: 'Expense Category Mix', rows: data.expenses.map(row => ({ id: row.name, label: row.name, cents: row.cents })) }].map(chart => <ChartFrame key={chart.title} title={chart.title} rows={chart.rows} categories currency={currency} series={[{ key: 'cents', name: 'Amount' }]}>{({ rows }) => <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="cents" nameKey="label" innerRadius={50} outerRadius={80}>{rows.map(row => <Cell key={row.id} aria-label={`${row.label}: ${formatCurrency(Number(row.cents), currency)}`} fill={COLORS[chart.rows.findIndex(original => original.id === row.id) % COLORS.length]} />)}</Pie>{tooltip}</PieChart></ResponsiveContainer>}</ChartFrame>)}
  </div>;
}
