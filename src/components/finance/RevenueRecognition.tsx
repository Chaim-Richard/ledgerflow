import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, DollarSign, ArrowRight, Layers, FileText, CheckCircle2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function RevenueRecognition() {
  const [activeTab, setActiveTab] = useState<'schedules' | 'waterfall'>('schedules');

  const schedules: any[] = [];

  const waterfallData: any[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Layers className="text-purple-600 w-8 h-8" />
            ASC 606 Revenue Recognition
          </h1>
          <p className="text-slate-500 mt-2">Manage deferred revenue schedules, ratable amortization, and compliance waterfalls.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
          <button onClick={() => setActiveTab('schedules')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'schedules' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>Amortization Schedules</button>
          <button onClick={() => setActiveTab('waterfall')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'waterfall' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>Revenue Waterfall</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'schedules' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Deferred (Liability)</div>
                <div className="text-3xl font-black text-slate-900">$174,000</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Recognized YTD (Income)</div>
                <div className="text-3xl font-black text-purple-600">$42,500</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Active Contracts</div>
                <div className="text-3xl font-black text-slate-900">142</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-4">Contract ID</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Term</th>
                    <th className="p-4">Total Contract Value</th>
                    <th className="p-4">Recognized</th>
                    <th className="p-4">Deferred Balance</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {schedules.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="p-4 font-mono font-medium text-purple-600">{s.id}</td>
                      <td className="p-4 font-bold text-slate-800">{s.customer}</td>
                      <td className="p-4 text-slate-500">{s.months} mos</td>
                      <td className="p-4 font-bold text-slate-900">${s.total.toLocaleString()}</td>
                      <td className="p-4 text-emerald-600 font-medium">${s.recognized.toLocaleString()}</td>
                      <td className="p-4 font-bold text-slate-700">${s.deferred.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          s.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'waterfall' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="text-purple-500" /> Waterfall Projection (Deferred vs Recognized)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="recognized" name="Recognized Revenue" stackId="a" fill="#9333ea" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="deferred" name="Deferred Balance" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
