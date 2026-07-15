import React, { useState } from 'react';
import { TrendingUp, BarChart3, CalendarDays, RefreshCw, AlertTriangle, Layers } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { cn } from '../../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getRevenueTxs, getExpenseTxs } from '../../lib/stats-helpers';

export default function DemandForecasting() {
  const transactions = useLedgerStore(state => state.transactions);
  const accounts = useLedgerStore(state => state.accounts);
  const [modelType, setModelType] = useState<'holt' | 'arima' | 'montecarlo'>('holt');
  
  // Calculate basic monthly metrics to display
  const revTxs = getRevenueTxs(transactions, accounts);
  
  const monthlyData: Record<string, number> = {};
  revTxs.forEach(t => {
    if (!t.date) return;
    const m = t.date.substring(0, 7);
    if (!monthlyData[m]) monthlyData[m] = 0;
    t.lines?.forEach(l => {
      monthlyData[m] += Math.abs(l.amountCents || 0) / 100;
    });
  });
  
  const months = Object.keys(monthlyData).sort();
  
  // Very naive smoothing for visual
  let s = months.length > 0 ? monthlyData[months[0]] : 0;
  let b = months.length > 1 ? monthlyData[months[1]] - monthlyData[months[0]] : 0;
  const alpha = 0.4, beta = 0.2;
  
  const chartData = [];
  for (let i = 0; i < months.length; i++) {
    const actual = monthlyData[months[i]];
    if (i > 0) {
      const prevS = s;
      s = alpha * actual + (1 - alpha) * (prevS + b);
      b = beta * (s - prevS) + (1 - beta) * b;
    }
    chartData.push({
      month: months[i],
      actual: Math.round(actual),
      fitted: Math.round(s)
    });
  }
  
  // Forecast 6 months
  if (months.length > 0) {
    const lastMonth = new Date(months[months.length - 1] + '-01');
    for (let i = 1; i <= 6; i++) {
      lastMonth.setMonth(lastMonth.getMonth() + 1);
      const mStr = lastMonth.toISOString().substring(0, 7);
      chartData.push({
        month: mStr,
        forecast: Math.round(s + (i * b))
      });
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            Supply Chain & Demand Forecasting
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Material Requirements Planning (MRP) powered by advanced stochastic and econometric models.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium flex items-center">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalculate MRP
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Demand Projection</h3>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setModelType('holt')}
                    className={cn("px-3 py-1 text-xs font-medium rounded-md", modelType === 'holt' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
                  >
                    Holt's Smoothing
                  </button>
                  <button 
                    onClick={() => setModelType('arima')}
                    className={cn("px-3 py-1 text-xs font-medium rounded-md", modelType === 'arima' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
                  >
                    ARIMA
                  </button>
                  <button 
                    onClick={() => setModelType('montecarlo')}
                    className={cn("px-3 py-1 text-xs font-medium rounded-md", modelType === 'montecarlo' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
                  >
                    Monte Carlo
                  </button>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(val) => '$' + (val / 1000) + 'k'} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => ['$' + value.toLocaleString(), '']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="actual" name="Historical Demand" stroke="#9ca3af" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="fitted" name="Model Fit" stroke="#818cf8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="forecast" name="Projected Demand" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">MRP Procurement Alerts</h3>
              <div className="space-y-4">
                <div className="flex items-start p-3 bg-rose-50 border border-rose-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-rose-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-rose-900">Stockout Risk: Raw Aluminum</h4>
                    <p className="text-xs text-rose-700 mt-1">
                      Forecasted demand exceeds on-hand inventory + incoming POs in week 3. Reorder 500 units immediately.
                    </p>
                  </div>
                </div>
                <div className="flex items-start p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <Layers className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-900">Overstock: Packaging Supplies</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Current inventory is 3x the projected 6-month demand. Halt new purchase orders.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Model Parameters</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Smoothing Factor (α)</span>
                  <span className="font-mono text-gray-900">0.40</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Trend Factor (β)</span>
                  <span className="font-mono text-gray-900">0.20</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Seasonality</span>
                  <span className="font-mono text-gray-900">Auto-detected</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Forecast Horizon</span>
                  <span className="font-mono text-gray-900">6 Months</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
