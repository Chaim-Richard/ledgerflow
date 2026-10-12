import React from 'react';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import type { ChartsData } from '../../lib/chartsData';
import { formatCurrency } from '../../lib/utils';
import ChartFrame, { ChartTooltip } from './ChartFrame';
import FinancialSeriesPlot from './FinancialSeriesPlot';
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
export default function FinancialChartPanels({ data, currency, selectionRange, onRangeChange, onRangeReset, emptyPeriod }: { data: ChartsData; currency?: string; selectionRange?: [number, number]; onRangeChange?: (range: [number, number]) => void; onRangeReset?: () => void; emptyPeriod?: boolean }) {
  const months = (emptyPeriod ? [] : data.months).map(row => ({ id: row.month, label: row.month, revenue: row.revenueCents, expense: row.expenseCents }));
  const mix = [{ key: 'revenue', name: 'Revenue', color: COLORS[0] }, { key: 'expense', name: 'Expense', color: COLORS[3] }];
  const burn = [{ key: 'expense', name: 'Monthly Burn', color: COLORS[3] }];
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ChartFrame chartId="financial-monthly-mix" title="Monthly Profitability & Mix" rows={months} time selectionRange={selectionRange ?? (onRangeChange ? null : undefined)} onRangeChange={onRangeChange} onRangeReset={onRangeReset} currency={currency} series={mix}>{controls => <FinancialSeriesPlot {...controls} series={mix} currency={currency} />}</ChartFrame>
    <ChartFrame chartId="financial-expense-burn" defaultKind="area" title="Operating Expense Burn Rate" rows={months} time selectionRange={selectionRange ?? (onRangeChange ? null : undefined)} onRangeChange={onRangeChange} onRangeReset={onRangeReset} currency={currency} series={burn}>{controls => <FinancialSeriesPlot {...controls} series={burn} currency={currency} />}</ChartFrame>
    {[{ title: 'Cash Balance Allocation', rows: data.cash.map(row => ({ id: row.id, label: row.name, cents: row.cents })) }, { title: 'Expense Category Mix', rows: data.expenses.map(row => ({ id: row.name, label: row.name, cents: row.cents })) }].map(chart => <ChartFrame key={chart.title} title={chart.title} rows={chart.rows} categories currency={currency} series={[{ key: 'cents', name: 'Amount' }]}>{({ rows }) => <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="cents" nameKey="label" innerRadius={50} outerRadius={80}>{rows.map(row => <Cell key={row.id} aria-label={`${row.label}: ${formatCurrency(Number(row.cents), currency)}`} fill={COLORS[chart.rows.findIndex(original => original.id === row.id) % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip currency={currency} series={[{ key: 'cents', name: 'Amount' }]} shareTotal={chart.rows.reduce((sum, row) => sum + row.cents, 0)} />} /></PieChart></ResponsiveContainer>}</ChartFrame>)}
  </div>;
}
