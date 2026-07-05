import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface TrendsViewProps {
  transactions: any[];
  formatCurrency: (val: number) => string;
  selectedYear?: number;
}

const TrendsView = React.memo(({ transactions, formatCurrency, selectedYear }: TrendsViewProps) => {
  const trendData = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Fallback to latest year of transactions if selectedYear not passed
    const currentYear = selectedYear ?? (transactions.length > 0 
      ? transactions.reduce((max, t) => {
          const y = new Date(t.date).getFullYear();
          return y > max ? y : max;
        }, 1900)
      : new Date().getFullYear()
    );
    
    const monthlyStats = months.map(m => ({ month: m, income: 0, expenses: 0, net: 0 }));
    
    for (const t of transactions) {
      if (t.deletedAt) continue;
      const d = new Date(t.date);
      if (d.getFullYear() !== currentYear) continue;
      const monthIdx = d.getMonth();
      
      for (const l of (t.lines || [])) {
        const accName = l.accountName?.toLowerCase() || '';
        if (accName.includes('income') || accName.includes('revenue')) {
          monthlyStats[monthIdx].income += Math.abs(l.amountCents);
        } else if (accName.includes('expense') || accName.includes('cost')) {
          monthlyStats[monthIdx].expenses += Math.abs(l.amountCents);
        }
      }
    }

    monthlyStats.forEach(m => m.net = m.income - m.expenses);
    return monthlyStats.filter(d => d.income > 0 || d.expenses > 0);
  }, [transactions]);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <div className="bg-white p-12 rounded-[48px] border border-zinc-200 shadow-xl">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">Revenue vs Expenses</h3>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-1">Monthly Performance</p>
          </div>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }}
                tickFormatter={(val) => `$${val/1000}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '16px', 
                  border: '1px solid #f4f4f5',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                formatter={(val: number) => [formatCurrency(val), '']}
              />
              <Area 
                type="monotone" 
                dataKey="income" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorIncome)" 
              />
              <Area 
                type="monotone" 
                dataKey="expenses" 
                stroke="#f43f5e" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorExpense)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-12 rounded-[48px] border border-zinc-200 shadow-xl">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">Net Profit Trend</h3>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-1">Monthly Bottom Line</p>
          </div>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }}
                tickFormatter={(val) => `$${val/1000}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '16px', 
                  border: '1px solid #f4f4f5'
                }}
                formatter={(val: number) => [formatCurrency(val), 'Net Profit']}
              />
              <Bar dataKey="net">
                {trendData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#10b981' : '#f43f5e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
});

export default TrendsView;
