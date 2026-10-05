import type { Transaction } from '../../types';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatCurrency } from '../../lib/utils';
import ChartFrame, { ChartTooltip } from '../charts/ChartFrame';

// Preserve the original sample and amounts: last 20 loaded records, in their existing order.
// This is document volume, not a posted cash-flow statement.
export const D3LedgerVisualizer = ({ data }: { data: (Transaction & { category?: string })[] }) => {
  const currency = useAuthStore(state => state.getCurrentWorkspace()?.currency);
  const uid = useAuthStore(state => state.user?.uid);
  const workspace = useAuthStore(state => state.currentWorkspaceId);
  const sample = data.slice(-20);
  const rows = sample.map((record, index) => ({
    id: record.id,
    label: `${record.date || 'Date unavailable'} — ${record.description || 'System Ledger'}`,
    operation: `T-${sample.length - index}`,
    cents: Math.abs(record.totalAmountCents),
  }));
  return <div className="min-w-0 space-y-2">
    <p className="text-sm text-[var(--muted)]">Last 20 loaded transaction records, in their existing order. Amounts are absolute document totals, not net cash flow. Use Table for dates, descriptions and exact amounts.</p>
    <p className="text-sm text-[var(--muted)]">Hover series peaks to scope ledger context</p>
    <ChartFrame key={`${uid}:${workspace}`} title="Recent Transaction Volume" rows={rows} currency={currency} series={[{key:'cents',name:'Transaction amount'}]}>
      {({rows:visible,hidden}) => <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={visible}>
          <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="operation" />
          <YAxis width={85} tickFormatter={value => formatCurrency(Number(value),currency)} />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Bar dataKey="cents" name="Transaction amount" fill="#6366f1" hide={hidden.has('cents')} />
          <Line type="monotone" dataKey="cents" name="Transaction trend" stroke="#10b981" hide={hidden.has('cents')} tooltipType="none" />
        </ComposedChart>
      </ResponsiveContainer>}
    </ChartFrame>
  </div>;
};
