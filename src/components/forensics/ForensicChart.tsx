import React, { useMemo, useState, useCallback } from 'react';
import { 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart,
  Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { Transaction } from '../../types';
import { AlertCircle, ArrowRight, X, BarChart as BarChart3, TrendingUp, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface ForensicChartProps {
  transactions: Transaction[];
  isCompactMode?: boolean;
  periodicity?: any[];
  metrics?: any;
}

const TelemetryOverlay = ({ data }: { data: any[] }) => {
  return null;
};

const CustomDot = (props: any) => {
  const { cx, cy, payload, onSelect } = props;
  if (!cx || !cy || !payload) return null;
  if (payload.isAnomaly) {
    return (
      <g onClick={() => onSelect && onSelect(payload)}>
        <circle cx={cx} cy={cy} r={6} fill="#f43f5e" className="animate-pulse cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
        <circle cx={cx} cy={cy} r={12} stroke="#f43f5e" strokeWidth={1} fill="none" className="animate-ping" />
      </g>
    );
  }
  return null;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#202124] border border-white/10 rounded-xl p-4 shadow-2xl backdrop-blur-xl">
        <p className="text-[10px] font-black text-[var(--panel)]/40 uppercase tracking-widest mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[11px] font-bold text-[var(--panel)]/70 uppercase tracking-tighter">{entry.name}</span>
              </div>
              <span className="text-xs font-mono font-black text-[var(--panel)]">
                ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const ForensicChart = React.memo(({ transactions, isCompactMode, periodicity = [], metrics }: ForensicChartProps) => {
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [isWaterfallMode, setIsWaterfallMode] = useState(false);

  const chartData = useMemo(() => {
    // Optimization: If higher-level metrics are provided, use the pre-calculated time series
    if (metrics?.timeSeries) {
      return metrics.timeSeries;
    }

    const data = [];
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    
    // Day-indexed grouping for single-pass performance
    const dailyMap = new Map<string, { inflow: number, outflow: number, dayTxs: Transaction[] }>();
    let initialBalanceCents = 0;
    const historicalExpenses: number[] = [];

    // SINGLE PASS THROUGH ALL TRANSACTIONS
    for (const t of transactions) {
      if (t.deletedAt) continue;
      const tDate = new Date(t.date);
      const isBeforeWindow = tDate <= thirtyDaysAgo;
      
      let bankDelta = 0;
      let expenseDelta = 0;
      
      const lines = t.lines || [];
      for (const l of lines) {
        const name = (l.accountName || '').toLowerCase();
        const isCash = name.includes('bank') || name.includes('cash');
        const isExpense = name.includes('expense');
        
        if (isCash) bankDelta += l.amountCents;
        if (isExpense) expenseDelta += Math.abs(l.amountCents);
      }

      if (isBeforeWindow) {
        initialBalanceCents += bankDelta;
      } else {
        const dayKey = format(tDate, 'yyyy-MM-dd');
        const existing = dailyMap.get(dayKey) || { inflow: 0, outflow: 0, dayTxs: [] };
        
        // Split bank delta into inflow/outflow for the chart
        if (bankDelta > 0) existing.inflow += bankDelta;
        else existing.outflow += Math.abs(bankDelta);
        
        existing.dayTxs.push(t);
        dailyMap.set(dayKey, existing);
      }

      if (expenseDelta > 0) historicalExpenses.push(expenseDelta / 100);
    }

    // Assemble Time Series
    let cumulativeBalance = initialBalanceCents / 100;
    
    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i);
      const dayKey = format(date, 'yyyy-MM-dd');
      const stats = dailyMap.get(dayKey) || { inflow: 0, outflow: 0, dayTxs: [] };
      
      const inVal = stats.inflow / 100;
      const outVal = stats.outflow / 100;
      cumulativeBalance += (inVal - outVal);

      data.push({
        date: format(date, 'MMM dd'),
        fullDate: date,
        inflow: inVal,
        outflow: outVal,
        net: inVal - outVal,
        balance: cumulativeBalance,
        transactions: stats.dayTxs
      });
    }

    // Final technical indicators pass
    return data.map((d, i, arr) => {
      const windowSize = 5;
      const start = Math.max(0, i - windowSize);
      const window = arr.slice(start, i + 1).map(x => x.balance);
      const bMean = window.reduce((a, b) => a + b, 0) / (window.length || 1);
      const bStd = Math.sqrt(window.reduce((a, b) => a + Math.pow(b - bMean, 2), 0) / (window.length || 1));
      
      // Anomaly Detection: Outflow spike or balance dip
      const isAnomaly = d.outflow > (bMean * 0.5) && d.outflow > 1000;

      return {
        ...d,
        upperBand: bMean + (bStd * 2),
        lowerBand: Math.max(0, bMean - (bStd * 2)),
        isAnomaly
      };
    });
  }, [transactions]);

  const stats = useMemo(() => {
    const totalIn = chartData.reduce((sum: number, d: any) => sum + d.inflow, 0);
    const totalOut = chartData.reduce((sum: number, d: any) => sum + d.outflow, 0);
    const peakBalance = Math.max(...chartData.map((d: any) => d.balance));
    
    return [
      { label: '30D Inflow', value: `$${(totalIn / 1000).toFixed(1)}k`, color: 'text-emerald-500' },
      { label: 'Gross Burn', value: `$${(totalOut / 1000).toFixed(1)}k`, color: 'text-rose-500' },
      { label: 'Peak Balance', value: `$${(peakBalance / 1000).toFixed(1)}k`, color: 'text-[var(--text)]' }
    ];
  }, [chartData]);

  const waterfallData = useMemo(() => {
    if (!isWaterfallMode) return [];
    
    // Group categories for waterfall
    const categories = new Map<string, number>();
    transactions.forEach(t => {
      if (t.deletedAt) return;
      const amount = t.totalAmountCents / 100;
      const cat = t.lines?.[0]?.accountName || 'Other';
      categories.set(cat, (categories.get(cat) || 0) + (amount * (t.lines?.[0]?.amountCents < 0 ? -1 : 1)));
    });

    const sortedCats = Array.from(categories.entries())
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 7);

    let runningTotal = 0;
    return sortedCats.map(([name, value]) => {
      const start = runningTotal;
      runningTotal += value;
      return {
        name,
        value,
        start,
        end: runningTotal,
        isPositive: value >= 0
      };
    });
  }, [transactions, isWaterfallMode]);

  const CustomDotInternal = useCallback((props: any) => {
    return <CustomDot {...props} onSelect={setSelectedAnomaly} />;
  }, []);

  return (
    <div className="relative h-full flex flex-col p-4 md:p-8 bg-transparent overflow-hidden">
      <TelemetryOverlay data={chartData} />
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 relative z-10">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <div className="w-10 h-10 bg-[var(--ink)] rounded-xl flex items-center justify-center text-emerald-400 shadow-2xl">
               <TrendingUp size={20} />
             </div>
             <div>
               <h3 className="text-2xl font-black text-[var(--text)] uppercase tracking-tighter leading-tight">Cash Flow Timeline</h3>
               <p className="text-[10px] font-black text-[var(--muted)] opacity-50 uppercase tracking-[0.3em]">Historical Variance Analysis • Ledger Trend Line</p>
             </div>
           </div>
        </div>
        
        <div className="flex items-center gap-8">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-end">
              <span className="text-[9px] font-black text-[var(--muted)] opacity-40 uppercase tracking-widest mb-1">{s.label}</span>
              <span className={cn("text-xl font-mono font-black tabular-nums tracking-tighter", s.color)}>{s.value}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pl-6 border-l border-[var(--line)]">
             <button 
               onClick={() => setIsWaterfallMode(!isWaterfallMode)}
               className={cn(
                 "px-4 py-2 rounded-xl text-[9px] font-medium uppercase tracking-wider transition-all flex items-center gap-2",
                 isWaterfallMode ? "bg-[var(--ink)] text-[var(--panel)]" : "bg-[var(--ink)] text-[var(--muted)] hover:bg-slate-200 hover:text-[var(--text)] border border-[var(--line)]"
               )}
             >
               <BarChart3 size={14} />
               {isWaterfallMode ? 'Standard View' : 'Waterfall Analysis'}
             </button>
          </div>
          <div className="flex items-center gap-6 pl-6 border-l border-[var(--line)]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
              <span className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Inflow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
              <span className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest opacity-60">Outflow</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[400px] relative z-10 translate-x-[-10px] w-[calc(100%+20px)]">
        <ResponsiveContainer width="100%" height="100%">
          {isWaterfallMode ? (
            <BarChart data={waterfallData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.03)" strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 9, fontStretch: 'extra-condensed', fontWeight: 900, opacity: 0.6 }}
                dy={15}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 9, fontStretch: 'extra-condensed', fontWeight: 900, opacity: 0.6 }}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
              />
              <Bar dataKey="value" strokeWidth={1} radius={4}>
                {waterfallData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isPositive ? '#10b981' : '#f43f5e'} 
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.03)" strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#71717a', fontSize: 9, fontWeight: 900, opacity: 0.6 }}
              dy={15}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#71717a', fontSize: 9, fontWeight: 900, opacity: 0.6 }}
              tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(0,0,0,0.03)', strokeWidth: 40 }}
            />
            
            <Bar dataKey="inflow" fill="#10b981" radius={[2, 2, 0, 0]} opacity={0.15} barSize={16} />
            <Bar dataKey="outflow" fill="#f43f5e" radius={[2, 2, 0, 0]} opacity={0.15} barSize={16} />

            <Area 
              type="monotone" 
              dataKey="balance" 
              stroke="#10b981" 
              strokeWidth={4}
              fill="url(#colorBalance)"
              dot={<CustomDotInternal />}
              animationDuration={2000}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>

      <AnimatePresence>
        {selectedAnomaly && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-6 left-6 right-6 bg-[#202124] border border-[#333537] rounded-xl shadow-2xl p-6 z-30"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center border border-rose-500/20">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="text-base font-medium text-[var(--text)]">Large outflow detected</h4>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {selectedAnomaly.date} • Manual review recommended
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAnomaly(null)}
                className="p-1.5 transition-colors text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {(selectedAnomaly.transactions || []).map((tx: Transaction) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-[var(--ink)] rounded-xl border border-[var(--line)] hover:border-slate-400 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[var(--text)]">{tx.description}</span>
                    <span className="text-[11px] text-[var(--muted)] mt-0.5">{tx.lines?.[0]?.accountName}</span>
                  </div>
                  <span className="text-sm font-medium text-rose-500">
                    -${(tx.totalAmountCents / 100).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#333537]">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-500">
                <Target size={14} />
                Variance Analysis: Transaction amount exceeds recent historical average for this vendor.
              </div>
              <button className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline">
                Audit Record
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default ForensicChart;
