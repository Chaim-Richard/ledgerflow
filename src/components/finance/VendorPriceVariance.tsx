import React, { useState } from 'react';
import { ShoppingCart, TrendingUp, TrendingDown, AlertTriangle, Filter, Download } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { cn } from '../../lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { getExpenseTxs } from '../../lib/stats-helpers';

export default function VendorPriceVariance() {
  const transactions = useLedgerStore(state => state.transactions);
  const accounts = useLedgerStore(state => state.accounts);
  const [selectedVendor, setSelectedVendor] = useState('all');

  const vendorData: any[] = [];
  
  const chartData: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-amber-400" />
            Vendor Price Variance (PPV)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track inflation, supplier price drift, and calculate Purchase Price Variance impact on margins.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-md hover:bg-slate-700 text-sm font-medium flex items-center transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1">Total Margin Impact (YTD)</div>
            <div className="text-3xl font-semibold text-rose-600 flex items-center">
              -$40,100
              <TrendingDown className="w-5 h-5 ml-2 text-rose-500" />
            </div>
            <div className="text-xs text-gray-500 mt-2">Due to supplier price increases</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1">Avg Inflation Rate</div>
            <div className="text-3xl font-semibold text-gray-900">
              +6.8%
            </div>
            <div className="text-xs text-gray-500 mt-2">Across top 20 suppliers</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1">Negotiation Targets</div>
            <div className="text-3xl font-semibold text-gray-900">
              4
            </div>
            <div className="text-xs text-rose-600 mt-2 font-medium">High risk variances detected</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-medium text-gray-900">Top Variance Drivers</h3>
                  <button className="text-gray-500 hover:text-gray-700">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor & Item</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Historical Avg</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Price</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance (%)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Impact</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vendorData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{row.vendor}</div>
                          <div className="text-xs text-gray-500">{row.item}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${row.avgPriceLastYear.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">${row.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                            row.variance > 10 ? "bg-rose-100 text-rose-800" :
                            row.variance > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                          )}>
                            {row.variance > 0 ? '+' : ''}{row.variance}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                          <span className={row.impact > 0 ? "text-rose-600" : "text-green-600"}>
                            {row.impact > 0 ? `-$${row.impact.toLocaleString()}` : `+$${Math.abs(row.impact).toLocaleString()}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[400px] flex flex-col">
              <h3 className="font-medium text-gray-900 mb-6">Price Drift Analysis</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="Global Steel Supply" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="Packaging Pros" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
