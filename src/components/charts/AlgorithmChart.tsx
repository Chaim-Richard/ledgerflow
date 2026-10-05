import React from 'react';
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import type { AlgoResult } from '../../lib/algorithms/types';
import ChartFrame, { ChartTooltip, type ChartRow } from './ChartFrame';

export default function AlgorithmChart({ chart }: { chart: AlgoResult['charts'][number] }) {
  const occurrences = new Map<string, number>();
  const originals = new Map<string, AlgoResult['charts'][number]['data'][number]>();
  const rows: ChartRow[] = chart.data.map(original => {
    const content = JSON.stringify(original);
    const occurrence = occurrences.get(content) ?? 0;
    occurrences.set(content, occurrence + 1);
    const id = `${content}:${occurrence}`;
    originals.set(id, original);
    const label = typeof original === 'string' ? original : String(original[chart.config.xKey] ?? '—');
    const values = Object.fromEntries(chart.config.yKeys.map(series => {
      const value = typeof original === 'string' ? undefined : original[series.key];
      return [series.key, typeof value === 'number' || typeof value === 'string' ? value : '—'];
    }));
    return { ...values, id, label };
  });
  const series = chart.config.yKeys.map(item => ({ ...item, unit: 'number' as const }));
  // Algorithm outputs use varied native units. Never reinterpret them as currency cents.
  return <ChartFrame title="Operational Topology Projection" rows={rows} series={series}>
    {({ rows: visible, hidden }) => <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={visible.map(row => originals.get(row.id))} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={chart.config.xKey} fontSize={10} tickLine={false} />
        <YAxis fontSize={10} tickLine={false} />
        <Tooltip content={<ChartTooltip series={series} />} />
        {series.map(item => item.type === 'bar' ? <Bar key={item.key} dataKey={item.key} fill={item.color} name={item.name} hide={hidden.has(item.key)} /> : <Line key={item.key} type="monotone" dataKey={item.key} stroke={item.color} name={item.name} hide={hidden.has(item.key)} />)}
      </ComposedChart>
    </ResponsiveContainer>}
  </ChartFrame>;
}
