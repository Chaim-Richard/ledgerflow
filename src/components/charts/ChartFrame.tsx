import React, { useMemo, useState } from 'react';
import { formatCurrency } from '../../lib/utils';
export interface ChartRow { id: string; label: string; [key: string]: string | number }
export interface ChartSeries { key: string; name: string; color?: string; unit?: 'money' | 'majorMoney' | 'percent' | 'days' | 'number' }
export interface ChartControls { rows: ChartRow[]; hidden: Set<string> }
export function ChartTooltip({ active, payload, label, currency, series }: { series?: ChartSeries[]; active?: boolean; label?: string | number; currency?: string; payload?: readonly { name?: string | number; value?: number | string; dataKey?: string | number; payload?: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg p-3 border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] shadow-lg"><p className="font-semibold"><bdi>{payload[0].payload?.label ?? label}</bdi></p>{payload.map(entry => <p key={`${entry.dataKey}:${entry.name}`}><bdi>{entry.name}</bdi>: {formatChartValue(entry.value, series?.find(item => item.key === entry.dataKey)?.unit ?? (entry.dataKey === 'days' ? 'days' : 'money'), currency)}</p>)}</div>;
}
function formatChartValue(value: unknown, unit: ChartSeries['unit'], currency?: string) {
  if (value === undefined || value === null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return '—';
  if (unit === 'majorMoney') return Number.isFinite(Number(value)) ? formatCurrency(Math.round(Number(value) * 100), currency) : '—';
  if (unit === 'percent') return Number.isFinite(Number(value)) ? `${value}%` : '—';
  if (unit === 'number') return String(value);
  if (unit === 'days') return `${value} days`;
  return Number.isFinite(Number(value)) ? formatCurrency(Number(value), currency) : '—';
}
export default function ChartFrame({ title, rows, series, currency, time = false, categories = false, children }: { title: string; rows: ChartRow[]; series: ChartSeries[]; currency?: string; time?: boolean; categories?: boolean; children: (controls: ChartControls) => React.ReactNode }) {
  const [table, setTable] = useState(false), [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [window, setWindow] = useState<[number, number]>([0, Number.MAX_SAFE_INTEGER]);
  const end = Math.min(window[1], Math.max(0, rows.length - 1)), start = Math.min(window[0], end);
  const shown = useMemo(() => rows.slice(start, end + 1).filter(row => !categories || !hidden.has(row.id)), [rows, start, end, categories, hidden]);
  const columns = series.filter(item => !hidden.has(item.key));
  const legends = categories ? rows.map(row => ({ key: row.id, name: row.label })) : series;
  const value = (row: ChartRow, column: ChartSeries) => formatChartValue(row[column.key], column.unit, currency);
  return <section aria-label={title} className="min-w-0 border border-[var(--line)] rounded-xl p-4 bg-[var(--panel)] text-[var(--text)] space-y-3"><h2 className="font-semibold">{title}</h2>
    <div className="flex flex-wrap gap-2"><button type="button" aria-pressed={!table} onClick={() => setTable(false)} className="min-h-11 px-3 border rounded-lg">Chart</button><button type="button" aria-pressed={table} onClick={() => setTable(true)} className="min-h-11 px-3 border rounded-lg">Table</button></div>
    <div aria-label={`${title} legend`} className="flex flex-wrap gap-2">{legends.map(item => <button key={item.key} type="button" aria-pressed={!hidden.has(item.key)} onClick={() => setHidden(previous => { const next = new Set(previous); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next; })} className="min-h-11 px-3 border rounded-lg"><bdi>{item.name}</bdi></button>)}</div>
    {time && rows.length > 1 && <fieldset className="space-y-2"><legend>Date range brush</legend><label className="block">From: {rows[start]?.label}<input aria-label={`${title} brush start`} type="range" min={0} max={rows.length - 1} value={start} onChange={event => setWindow([Math.min(Number(event.target.value), end), end])} className="block w-full min-h-11" /></label><label className="block">To: {rows[end]?.label}<input aria-label={`${title} brush end`} type="range" min={0} max={rows.length - 1} value={end} onChange={event => setWindow([start, Math.max(start, Number(event.target.value))])} className="block w-full min-h-11" /></label><button type="button" onClick={() => setWindow([0, Number.MAX_SAFE_INTEGER])} className="min-h-11 underline">Reset zoom</button></fieldset>}
    {shown.length === 0 || columns.length === 0 ? <p role="status">No visible data. Show a series or reset the date range.</p> : table ? <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{title} data</caption><thead><tr><th scope="col" className="text-left">{time ? 'Date' : 'Record'}</th>{columns.map(column => <th key={column.key} scope="col" className="text-right">{column.name}</th>)}</tr></thead><tbody>{shown.map(row => <tr key={row.id}><th scope="row" className="text-left font-normal"><bdi>{row.label}</bdi></th>{columns.map(column => <td key={column.key} className="text-right tabular-nums">{value(row, column)}</td>)}</tr>)}</tbody></table></div> : <div className="h-72 w-full min-w-0">{children({ rows: shown, hidden })}</div>}
  </section>;
}
