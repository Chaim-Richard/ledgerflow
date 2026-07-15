import React, { useState } from 'react';
import { Factory, Cog, Timer, Activity, AlertCircle, TrendingDown, Users, Settings2, PlayCircle, StopCircle, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Cell } from 'recharts';

export default function WorkCenterRouting() {
  const [activeCenter, setActiveCenter] = useState<string>('all');
  
  const workCenters: any[] = [];
  
  const activeOrders: any[] = [];
  
  const performanceData: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-indigo-400" />
            Work Center Routing & OEE
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track manufacturing floor operations, measure Overall Equipment Effectiveness (OEE), and optimize production routing.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-md hover:bg-slate-700 text-sm font-medium transition-colors">
            Configure Centers
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center">
            <PlayCircle className="w-4 h-4 mr-2" />
            Launch Production Run
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white px-8">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {workCenters.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCenter(tab.id)}
              className={cn(
                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2",
                activeCenter === tab.id
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1">Global OEE Score</div>
            <div className="text-3xl font-semibold text-gray-900 flex items-center">
              78.4%
            </div>
            <div className="text-xs text-indigo-600 font-medium mt-2">Target: 85.0%</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1">Availability</div>
            <div className="text-3xl font-semibold text-gray-900">82.1%</div>
            <div className="text-xs text-gray-500 mt-2">Downtime: 4.2 hours/wk</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1">Performance</div>
            <div className="text-3xl font-semibold text-gray-900">96.5%</div>
            <div className="text-xs text-gray-500 mt-2">Operating near max capacity</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-gray-500 text-sm font-medium mb-1">Quality Yield</div>
            <div className="text-3xl font-semibold text-gray-900">98.9%</div>
            <div className="text-xs text-gray-500 mt-2">Scrap rate: 1.1%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Production Volume (Units)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend />
                    <Bar dataKey="actual" name="Actual Yield" stackId="a" fill="#4f46e5" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="lost" name="Lost to Downtime" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-medium text-gray-900">Active Routing Operations</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {activeOrders.map((order, idx) => (
                    <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{order.id}</span>
                          <h4 className="text-sm font-medium text-gray-900 mt-2">{order.product}</h4>
                        </div>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'Blocked' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                        )}>
                          {order.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center text-xs text-gray-500 mb-3">
                        <Cog className="w-3 h-3 mr-1" />
                        {order.center}
                        <span className="mx-2">•</span>
                        <Timer className="w-3 h-3 mr-1" />
                        Due: {order.targetEnd}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700">Completion</span>
                          <span className="text-gray-500">{order.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={cn(
                              "h-1.5 rounded-full",
                              order.status === 'Blocked' ? "bg-rose-500" :
                              order.status === 'Completed' ? "bg-green-500" : "bg-indigo-500"
                            )} 
                            style={{ width: `${order.progress}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
